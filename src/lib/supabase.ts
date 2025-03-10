
import { createClient } from '@supabase/supabase-js';

// Use the provided Supabase URL and API key
const supabaseUrl = 'https://tobscknzwwmqijpxaowj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYnNja256d3dtcWlqcHhhb3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1ODAxMTcsImV4cCI6MjA1NzE1NjExN30.mNTCvpY_nlv5ItdP-q5GYA6Z82vsJaSTvlqiBi57zE0';

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
};
