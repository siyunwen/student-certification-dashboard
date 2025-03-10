
import { supabase } from './supabase';

// Function to create the exec_sql function in Supabase
export const setupSqlFunction = async (): Promise<void> => {
  try {
    // Check if the function already exists
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' }).single();
    
    // If function exists, we're good
    if (!error) {
      console.log('exec_sql function already exists');
      return;
    }
    
    console.log('Creating exec_sql function...');
    
    // For security, we'll check if we're in development mode
    // We don't want to expose this in production
    if (import.meta.env.MODE === 'production') {
      console.error('Cannot create exec_sql function in production');
      return;
    }
    
    // Get the URL and key from env vars or fallback to values in supabase.ts
    const supabaseUrl = 'https://tobscknzwwmqijpxaowj.supabase.co';
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYnNja256d3dtcWlqcHhhb3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1ODAxMTcsImV4cCI6MjA1NzE1NjExN30.mNTCvpY_nlv5ItdP-q5GYA6Z82vsJaSTvlqiBi57zE0';
    
    // We need to use REST API directly to create the function
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        sql_query: `
          CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
          RETURNS VOID
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            EXECUTE sql_query;
          END;
          $$;
        `
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create exec_sql function: ${await response.text()}`);
    }
    
    console.log('exec_sql function created successfully');
  } catch (error) {
    console.error('Error setting up SQL function:', error);
    throw error;
  }
};
