import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true';

export const isSupabaseEnabled = Boolean(useSupabase && supabaseUrl && supabaseAnonKey);

// The app defaults to demo mode unless VITE_USE_SUPABASE=true is set.
// A placeholder client keeps type imports simple; all data access is gated by isSupabaseEnabled.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://demo-project.supabase.co',
  supabaseAnonKey || 'demo-anon-key'
);
