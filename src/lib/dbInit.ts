
import { supabase } from './supabase';

// Function to initialize database tables
export const initDatabase = async (createSampleData = false): Promise<void> => {
  console.log('Starting database initialization...');
  
  try {
    // First check if the exec_sql function works
    const { data: testResult, error: testError } = await supabase.rpc('exec_sql', {
      sql_query: 'SELECT 1 as test'
    });
    
    if (testError) {
      console.error('The exec_sql function does not exist or is not working:', testError);
      throw new Error('SQL function setup required');
    }
    
    console.log('SQL function is working, proceeding with database setup');
    
    // Create courses table if it doesn't exist
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id')
      .limit(1);
      
    if (coursesError) {
      console.log('Creating courses table...');
      try {
        // Using raw SQL via the rpc method
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: `
            CREATE TABLE IF NOT EXISTS courses (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              name TEXT NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
            );
          `
        });
        
        if (error) throw error;
      } catch (err) {
        console.error('Failed to create courses table:', err);
        throw err;
      }
    }

    // Create students table if it doesn't exist
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .limit(1);
      
    if (studentsError) {
      console.log('Creating students table...');
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: `
            CREATE TABLE IF NOT EXISTS students (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              first_name TEXT NOT NULL,
              last_name TEXT NOT NULL,
              email TEXT NOT NULL,
              enrollment_date DATE NOT NULL,
              last_activity_date DATE NOT NULL,
              course_id UUID REFERENCES courses(id) NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
            );
          `
        });
        
        if (error) throw error;
      } catch (err) {
        console.error('Failed to create students table:', err);
        throw err;
      }
    }

    // Create quizzes table if it doesn't exist
    const { error: quizzesError } = await supabase
      .from('quizzes')
      .select('id')
      .limit(1);
      
    if (quizzesError) {
      console.log('Creating quizzes table...');
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS quizzes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            student_id UUID REFERENCES students(id) NOT NULL,
            quiz_name TEXT NOT NULL,
            score NUMERIC NOT NULL,
            completed_at DATE NOT NULL,
            course_id UUID REFERENCES courses(id) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
          );
        `
      });
      
      if (error) throw error;
    }

    // Create certification settings table if it doesn't exist
    const { error: certificationError } = await supabase
      .from('certification_settings')
      .select('id')
      .limit(1);
      
    if (certificationError) {
      console.log('Creating certification_settings table...');
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS certification_settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            pass_threshold NUMERIC NOT NULL,
            date_since DATE,
            user_id UUID NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
          );
        `
      });
      
      if (error) throw error;
    }
    
    console.log('Database tables created successfully');
    
    // Never create sample data - this was causing problems
    console.log('Skipping sample data creation');
    
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

// Removed the createSampleDataFn function completely to prevent any accidental sample data creation
