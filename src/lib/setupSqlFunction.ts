
import { supabase } from './supabase';

// Function to create the exec_sql function in Supabase
export const setupSqlFunction = async (): Promise<void> => {
  try {
    console.log('Setting up exec_sql function...');
    
    // For security, we'll check if we're in development mode
    // We don't want to expose this in production
    if (import.meta.env.MODE === 'production') {
      console.error('Cannot create exec_sql function in production');
      return;
    }
    
    // First check if the function already exists by trying to call it
    const { error: testError } = await supabase.rpc('exec_sql', {
      sql_query: 'SELECT 1 as test'
    });
    
    // If no error, the function exists and works
    if (!testError) {
      console.log('exec_sql function already exists and works properly');
      return;
    }
    
    console.log('Function test failed, attempting to create it...', testError);
    
    // Try to create the function using a direct SQL query
    // This requires elevated permissions (service_role key)
    const createFunctionQuery = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        result JSONB;
      BEGIN
        EXECUTE sql_query;
        result := '{"success": true}'::JSONB;
        RETURN result;
      EXCEPTION WHEN OTHERS THEN
        result := json_build_object('error', SQLERRM, 'success', false)::JSONB;
        RETURN result;
      END;
      $$;
    `;
    
    try {
      // Attempt to create the function by calling the RPC
      // This might work if the user has already created the function
      const { error: rpcError } = await supabase.rpc('exec_sql', {
        sql_query: createFunctionQuery
      });
      
      if (!rpcError) {
        console.log('exec_sql function created successfully via RPC');
        return;
      }
      
      console.log('RPC method failed, trying REST API...', rpcError);
      
      // Get the Supabase URL and key from the environment or configuration
      const supabaseUrl = 'https://tobscknzwwmqijpxaowj.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYnNja256d3dtcWlqcHhhb3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1ODAxMTcsImV4cCI6MjA1NzE1NjExN30.mNTCvpY_nlv5ItdP-q5GYA6Z82vsJaSTvlqiBi57zE0';
      
      // Execute the SQL directly using the REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          sql_query: createFunctionQuery
        })
      });
      
      if (response.ok) {
        console.log('exec_sql function created successfully via REST API');
        return;
      }
      
      throw new Error(`REST API call failed: ${await response.text()}`);
    } catch (apiError) {
      console.error('Failed to create function via API:', apiError);
      
      // Last attempt - try using the SQL HTTP endpoint directly
      try {
        // Use the same URL and key as above
        const supabaseUrl = 'https://tobscknzwwmqijpxaowj.supabase.co';
        const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYnNja256d3dtcWlqcHhhb3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1ODAxMTcsImV4cCI6MjA1NzE1NjExN30.mNTCvpY_nlv5ItdP-q5GYA6Z82vsJaSTvlqiBi57zE0';
        
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            query: createFunctionQuery
          })
        });
        
        if (response.ok) {
          console.log('exec_sql function created successfully via SQL endpoint');
          return;
        }
        
        // If we get here, we need to let the user create the function manually
        console.error('All automatic methods failed, manual setup required');
        throw new Error('Could not automatically create the exec_sql function');
      } catch (sqlError) {
        console.error('SQL error creating function:', sqlError);
        throw new Error('Manual setup required');
      }
    }
  } catch (error) {
    console.error('Error setting up SQL function:', error);
    throw error;
  }
};
