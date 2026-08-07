import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabaseClient';
import {
  getTodayFormatted,
  getCurrentStreak,
  getTodayGoal,
  getPredictions,
  completeReminder,
} from '@/lib/dateHelpers';

type Reminder = {
  id: string;
  todo: string;
  due_at: string | null;
  completed: boolean;
};

export default function TodayScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState({ completed: 0, target: 5 });
  const [predictions, setPredictions] = useState<Awaited<ReturnType<typeof getPredictions>>>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const todayLabel = getTodayFormatted();

  const loadData = useCallback(async () => {
    const [streakCount, goalData, predictionData, remindersResult] = await Promise.all([
      getCurrentStreak(),
      getTodayGoal(),
      getPredictions(),
      supabase
        .from('reminders')
        .select('id, todo, due_at, completed')
        .order('due_at', { ascending: true })
        .limit(5),
    ]);

    setStreak(streakCount);
    setGoal(goalData);
    setPredictions(predictionData);
    if (remindersResult.data) setReminders(remindersResult.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh whenever this screen comes back into focus (e.g. after logging something elsewhere)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const goalPercent = Math.min(100, Math.round((goal.completed / goal.target) * 100));

  const handleCheckReminder = async (reminderId: string) => {
    // Optimistically update the UI immediately
    setReminders((prev) =>
      prev.map((r) => (r.id === reminderId ? { ...r, completed: true } : r))
    );
    setGoal((prev) => ({
      ...prev,
      completed: Math.min(prev.completed + 1, prev.target),
    }));

    // Then actually save it
    await completeReminder(reminderId);

    // Refresh streak in the background since it may have just changed
    const newStreak = await getCurrentStreak();
    setStreak(newStreak);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Greeting header */}
        <View style={styles.greetRow}>
          <View>
            <Text style={styles.hello}>Morning, super hot babe</Text>
            <Text style={styles.sub}>{todayLabel}</Text>
          </View>
          <View style={styles.iconBtn} />
        </View>

        {/* Streak + Goal row */}
        <View style={styles.twoRow}>
          <View style={styles.streakCard}>
            <View style={styles.petPlaceholder} />
            <Text style={styles.streakLabel}>Streak</Text>
            <Text style={styles.streakNum}>{streak} {streak === 1 ? 'day' : 'days'}</Text>
            <Text style={styles.petCaption}>view "insert pet name!"</Text>
          </View>
          <View style={styles.goalCard}>
            <Text style={styles.goalLabel}>Today's Goal</Text>
            <Text style={styles.goalNum}>
              {goal.completed} / {goal.target}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${goalPercent}%` }]} />
            </View>
          </View>
        </View>

        {/* Period foid */}
        <LinearGradient
          colors={[Colors.navy, Colors.deep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.periodFoid}>
          <Text style={styles.foidLabel}>Period:</Text>
          <Text style={styles.foidDay}>day 1</Text>
          <Text style={styles.foidSub}>i poop in my pants</Text>

          {predictions ? (
            <>
              <Text style={styles.foidOvulLine}>
                {predictions.daysUntilOvulation > 0
                  ? `Next ovulation: `
                  : 'Ovulation was: '}
                <Text style={styles.foidOvulBold}>
                  {Math.abs(predictions.daysUntilOvulation)} day
                  {Math.abs(predictions.daysUntilOvulation) === 1 ? '' : 's'}{' '}
                  {predictions.daysUntilOvulation > 0 ? 'from now' : 'ago'}
                </Text>
              </Text>
              <Text style={styles.foidOvul}>
                {predictions.isLowChancePregnancy
                  ? 'Low chance of pregnancy'
                  : 'Higher chance of pregnancy'}
              </Text>
            </>
          ) : (
            <Text style={styles.foidOvul}>
              Log at least two periods to see predictions
            </Text>
          )}

          <View style={styles.vitaminsBlock}>
            <Text style={styles.foidVLabel}>Take today</Text>
            <View style={styles.vitaminItem}>
              <View style={styles.bullet} />
              <Text style={styles.vitaminText}>Iron</Text>
            </View>
            <View style={styles.vitaminItem}>
              <View style={styles.bullet} />
              <Text style={styles.vitaminText}>Magnesium</Text>
            </View>
            <View style={styles.vitaminItem}>
              <View style={styles.bullet} />
              <Text style={styles.vitaminText}>Vitamin B6</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Reminders */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Reminders</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>

        {reminders.length === 0 && !loading && (
          <Text style={styles.emptyText}>no reminders rn</Text>
        )}

        {reminders.map((reminder) => (
          <View key={reminder.id} style={styles.reminder}>
            <Pressable
              onPress={() => !reminder.completed && handleCheckReminder(reminder.id)}
              style={[styles.checkbox, reminder.completed && styles.checkboxDone]}>
              {reminder.completed && (
                <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>✓</Text>
              )}
            </Pressable>
            <View>
              <Text style={[styles.rTitle, reminder.completed && styles.rTitleStrike]}>
                {reminder.todo}
              </Text>
              <Text style={styles.rTime}>
                {reminder.due_at
                  ? new Date(reminder.due_at).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : 'No due time'}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  content: {
    padding: 18,
    gap: 13,
  },
  greetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hello: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 22,
    color: Colors.deep,
  },
  sub: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11,
    color: '#7C8D97',
    marginTop: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white,
  },
  twoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  streakCard: {
    flex: 1.15,
    backgroundColor: Colors.navy,
    borderRadius: 20,
    padding: 14,
  },
  petPlaceholder: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
  },
  streakLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.white,
    opacity: 0.75,
  },
  streakNum: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 26,
    color: Colors.white,
    marginTop: 2,
  },
  petCaption: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 9.5,
    color: Colors.white,
    opacity: 0.75,
    marginTop: 22,
  },
  goalCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
  },
  goalLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8CA0AB',
  },
  goalNum: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 24,
    color: Colors.deep,
    marginTop: 2,
  },
  barTrack: {
    width: '100%',
    height: 6,
    borderRadius: 6,
    backgroundColor: Colors.paler,
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.coral,
    borderRadius: 6,
  },
  periodFoid: {
    borderRadius: 22,
    padding: 22,
  },
  foidLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.white,
    opacity: 0.85,
  },
  foidDay: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 52,
    color: Colors.white,
    marginTop: 2,
  },
  foidSub: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: Colors.white,
    opacity: 0.85,
    marginTop: 10,
  },
  foidOvulLine: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: Colors.white,
    opacity: 0.85,
    marginTop: 14,
  },
  foidOvulBold: {
    fontFamily: 'Manrope_700Bold',
    opacity: 1,
  },
  foidOvul: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11.5,
    color: Colors.white,
    opacity: 0.8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  vitaminsBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  foidVLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.white,
    opacity: 0.7,
    marginBottom: 8,
  },
  vitaminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  vitaminText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.white,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.deep,
  },
  seeAll: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10,
    color: Colors.navy,
  },
  emptyText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11,
    color: '#8CA0AB',
    fontStyle: 'italic',
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  rTitle: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: Colors.deep,
  },
  rTitleStrike: {
    textDecorationLine: 'line-through',
    color: '#B4C0C7',
  },
  rTime: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 10,
    color: '#8CA0AB',
    marginTop: 1,
  },
});