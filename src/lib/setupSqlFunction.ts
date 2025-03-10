
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
    
    // Create the SQL function using raw SQL directly
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: `
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
      `
    }).single();
    
    if (error) {
      // If the function doesn't exist yet, create it using a SQL query
      console.log('Function not found, creating it via SQL...');
      
      // We need to use a direct SQL query to create the function
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
      
      // Execute the SQL directly using the REST API
      const supabaseUrl = 'https://tobscknzwwmqijpxaowj.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYnNja256d3dtcWlqcHhhb3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1ODAxMTcsImV4cCI6MjA1NzE1NjExN30.mNTCvpY_nlv5ItdP-q5GYA6Z82vsJaSTvlqiBi57zE0';
      
      // Try to create the function using the SQL API
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            query: createFunctionQuery
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create exec_sql function: ${await response.text()}`);
        }
        
        console.log('exec_sql function created successfully');
      } catch (sqlError) {
        console.error('SQL error creating function:', sqlError);
        
        // If we can't create the function with SQL API, we need to tell the user
        console.error(`
          Unable to create the exec_sql function automatically.
          
          Please run the following SQL in the Supabase SQL Editor:
          
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
        `);
      }
    } else {
      console.log('exec_sql function already exists or was created successfully');
    }
  } catch (error) {
    console.error('Error setting up SQL function:', error);
    throw error;
  }
};
