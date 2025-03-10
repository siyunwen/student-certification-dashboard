
import { createClient } from '@supabase/supabase-js';

// Use the provided Supabase URL and API key
const supabaseUrl = 'https://tobscknzwwmqijpxaowj.supabase.co';
// Try to use environment variable if available, otherwise fall back to the anon key
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYnNja256d3dtcWlqcHhhb3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1ODAxMTcsImV4cCI6MjA1NzE1NjExN30.mNTCvpY_nlv5ItdP-q5GYA6Z82vsJaSTvlqiBi57zE0';

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseKey;
};
