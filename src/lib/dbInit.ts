
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
    
    // Only create sample data if explicitly requested
    if (createSampleData) {
      await createSampleDataFn();
    } else {
      console.log('Skipping sample data creation');
    }
    
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

// Function to create sample data for testing, separated for clarity
const createSampleDataFn = async (): Promise<void> => {
  try {
    // Check if we already have data
    const { data: existingCourses, error: checkError } = await supabase
      .from('courses')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('Error checking existing courses:', checkError);
      return;
    }
    
    if (existingCourses && existingCourses.length > 0) {
      console.log('Sample data already exists');
      return;
    }
    
    // Create a sample course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert([
        { name: 'AI Fundamentals 101' },
        { name: 'Data Science Basics' },
        { name: 'Web Development' }
      ])
      .select();
    
    if (courseError) {
      console.error('Error creating sample course:', courseError);
      return;
    }
    
    if (!course || course.length === 0) {
      console.error('Failed to create sample courses');
      return;
    }
    
    // Current date and dates for sample data
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);
    
    // Format dates as ISO strings
    const todayISO = today.toISOString().split('T')[0];
    const lastMonthISO = lastMonth.toISOString().split('T')[0];
    
    // Create sample students
    const students = [
      { 
        first_name: 'John', 
        last_name: 'Doe', 
        email: 'john.doe@example.com',
        enrollment_date: lastMonthISO,
        last_activity_date: todayISO,
        course_id: course[0].id 
      },
      { 
        first_name: 'Jane', 
        last_name: 'Smith', 
        email: 'jane.smith@example.com',
        enrollment_date: lastMonthISO,
        last_activity_date: todayISO,
        course_id: course[0].id 
      },
      { 
        first_name: 'Alice', 
        last_name: 'Johnson', 
        email: 'alice.johnson@example.com',
        enrollment_date: lastMonthISO,
        last_activity_date: todayISO,
        course_id: course[1].id 
      },
      { 
        first_name: 'Bob', 
        last_name: 'Brown', 
        email: 'bob.brown@example.com',
        enrollment_date: lastMonthISO,
        last_activity_date: todayISO,
        course_id: course[1].id 
      },
      { 
        first_name: 'Emma', 
        last_name: 'Wilson', 
        email: 'emma.wilson@example.com',
        enrollment_date: lastMonthISO,
        last_activity_date: todayISO,
        course_id: course[2].id 
      }
    ];
    
    const { data: createdStudents, error: studentError } = await supabase
      .from('students')
      .insert(students)
      .select();
    
    if (studentError) {
      console.error('Error creating sample students:', studentError);
      return;
    }
    
    if (!createdStudents || createdStudents.length === 0) {
      console.error('Failed to create sample students');
      return;
    }
    
    // Create sample quiz scores for each student
    const quizzes = [];
    
    for (const student of createdStudents) {
      // Add two quizzes per student with different scores
      quizzes.push({
        student_id: student.id,
        quiz_name: 'Introduction Quiz',
        score: Math.floor(Math.random() * 30) + 70, // Random score between 70-99
        completed_at: todayISO,
        course_id: student.course_id
      });
      
      quizzes.push({
        student_id: student.id,
        quiz_name: 'Midterm Assessment',
        score: Math.floor(Math.random() * 40) + 60, // Random score between 60-99
        completed_at: todayISO,
        course_id: student.course_id
      });
    }
    
    const { error: quizError } = await supabase
      .from('quizzes')
      .insert(quizzes);
    
    if (quizError) {
      console.error('Error creating sample quizzes:', quizError);
      return;
    }
    
    console.log('Sample data created successfully');
    
  } catch (error) {
    console.error('Error creating sample data:', error);
  }
};
