import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kwmxuzlxwikfiyygoalb.supabase.co';
const supabaseAnonKey = 'sb_publishable_IWHIt-uwD4dEgJBVJdW9YA_FHAxFyTb';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);