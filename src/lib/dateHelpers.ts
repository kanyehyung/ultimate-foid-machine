import { supabase } from './supabaseClient';

// Formats today's date using the phone's local timezone, e.g. "Tuesday, March 21"
export function getTodayFormatted(): string {
  const today = new Date();
  return today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// Returns today's date as YYYY-MM-DD in local time (matches Postgres `date` columns)
export function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Counts consecutive logged days backward from today (or yesterday, if today isn't logged yet)
export async function getCurrentStreak(): Promise<number> {
  const { data, error } = await supabase
    .from('streaks')
    .select('log_date')
    .order('log_date', { ascending: false });

  if (error || !data || data.length === 0) return 0;
  
  type StreakRow = { log_date: string };
  const loggedDates = new Set(data.map((row: StreakRow) => row.log_date));
  let streak = 0;
  const cursor = new Date();

  // If today isn't logged yet, start counting from yesterday instead
  const todayISO = getTodayISO();
  if (!loggedDates.has(todayISO)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    const iso = `${year}-${month}-${day}`;

    if (loggedDates.has(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Fetches (or creates) today's goal progress row
export async function getTodayGoal(): Promise<{ completed: number; target: number }> {
  const todayISO = getTodayISO();

  const { data, error } = await supabase
    .from('daily_goals')
    .select('completed_count, target_count')
    .eq('goal_date', todayISO)
    .maybeSingle();

  if (error || !data) {
    // No row yet for today — that's normal, means 0 progress so far
    return { completed: 0, target: 5 };
  }

  return { completed: data.completed_count, target: data.target_count };
}

// Predicts next period start + ovulation, based on cycle_logs history.
// Returns null if there isn't enough data yet (needs at least 2 period starts).
export async function getPredictions(): Promise<{
  nextPeriodDate: Date;
  daysUntilOvulation: number;
  isLowChancePregnancy: boolean;
} | null> {
  const { data, error } = await supabase
    .from('cycle_logs')
    .select('log_date')
    .eq('period_day1', true)
    .order('log_date', { ascending: false })
    .limit(6);

  if (error || !data || data.length < 2) return null;

  // Calculate gaps between consecutive period starts
  type CycleLogRow = { log_date: string };
  const dates = data.map((row: CycleLogRow) => new Date(row.log_date));
  const gaps: number[] = [];
  for (let i = 0; i < dates.length - 1; i++) {
    const diffMs = dates[i].getTime() - dates[i + 1].getTime();
    gaps.push(Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }

  const avgCycleLength = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const lastPeriodStart = dates[0];

  const nextPeriodDate = new Date(lastPeriodStart);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + avgCycleLength);

  const ovulationDate = new Date(nextPeriodDate);
  ovulationDate.setDate(ovulationDate.getDate() - 14);

  const today = new Date();
  const daysUntilOvulation = Math.round(
    (ovulationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Rough fertile window: ~5 days before ovulation to ~1 day after
  const daysSinceOvulation = -daysUntilOvulation;
  const isLowChancePregnancy = daysSinceOvulation < -5 || daysSinceOvulation > 1;

  return { nextPeriodDate, daysUntilOvulation, isLowChancePregnancy };
}

// Marks a reminder as completed, bumps today's goal count, and logs today's streak.
export async function completeReminder(reminderId: string): Promise<void> {
  // 1. Mark the reminder as completed
  const { error: reminderError } = await supabase
    .from('reminders')
    .update({ completed: true })
    .eq('id', reminderId);

  if (reminderError) {
    console.log('Error completing reminder:', reminderError);
    return;
  }

  const todayISO = getTodayISO();

  // 2. Bump today's goal count (insert row if it doesn't exist yet)
  const { data: existingGoal } = await supabase
    .from('daily_goals')
    .select('completed_count, target_count')
    .eq('goal_date', todayISO)
    .maybeSingle();

  if (existingGoal) {
    const newCount = Math.min(existingGoal.completed_count + 1, existingGoal.target_count);
    await supabase
      .from('daily_goals')
      .update({ completed_count: newCount })
      .eq('goal_date', todayISO);
  } else {
    await supabase.from('daily_goals').insert({
      goal_date: todayISO,
      completed_count: 1,
      target_count: 5,
    });
  }

  // 3. Log today in the streaks table (upsert-style: ignore if already logged today)
  const { data: existingStreak } = await supabase
    .from('streaks')
    .select('id')
    .eq('log_date', todayISO)
    .maybeSingle();

  if (!existingStreak) {
    await supabase.from('streaks').insert({ log_date: todayISO });
  }
}