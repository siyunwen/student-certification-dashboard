
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
    
    // We need to use REST API directly to create the function
    const response = await fetch(`${supabase.supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabase.supabaseKey,
        'Authorization': `Bearer ${supabase.supabaseKey}`
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
