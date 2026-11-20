import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rtjgcpklpyolzsdjjtdb.supabase.co';
const supabaseAnonKey = 'sb_publishable_A7FAGajsfdfQEQiKGBJHUg_D8zIsY_0';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;