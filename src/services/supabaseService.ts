
import { supabase } from '@/lib/supabase';
import { Student, CertificationSettings, ParsedFile } from '@/types/student';
import { StudentRecord, CourseRecord, QuizRecord, CertificationSettingsRecord } from '@/types/database';
import { normalizeScore } from '@/utils/scoreUtils';
import { v4 as uuidv4 } from 'uuid';

// Fetch students from Supabase
export async function fetchStudents(): Promise<Student[]> {
  const { data: studentRecords, error: studentsError } = await supabase
    .from('students')
    .select('*');

  if (studentsError) {
    console.error('Error fetching students:', studentsError);
    throw studentsError;
  }

  const { data: quizRecords, error: quizzesError } = await supabase
    .from('quizzes')
    .select('*');

  if (quizzesError) {
    console.error('Error fetching quizzes:', quizzesError);
    throw quizzesError;
  }

  const { data: courseRecords, error: coursesError } = await supabase
    .from('courses')
    .select('*');

  if (coursesError) {
    console.error('Error fetching courses:', coursesError);
    throw coursesError;
  }

  return transformStudentData(studentRecords as StudentRecord[], quizRecords as QuizRecord[], courseRecords as CourseRecord[]);
}

// Transform database records to application model
function transformStudentData(
  studentRecords: StudentRecord[], 
  quizRecords: QuizRecord[], 
  courseRecords: CourseRecord[]
): Student[] {
  const courseMap = new Map<string, string>();
  courseRecords.forEach(course => {
    courseMap.set(course.id, course.name);
  });

  // Filter out CMU emails at the transformation stage
  const filteredStudentRecords = studentRecords.filter(student => {
    const email = student.email.toLowerCase();
    return !email.includes('@andrew.cmu.edu') && !email.includes('@cmu.edu');
  });

  console.log(`Filtered out ${studentRecords.length - filteredStudentRecords.length} CMU email addresses`);

  return filteredStudentRecords.map(student => {
    // Find all quizzes for this student
    const studentQuizzes = quizRecords.filter(quiz => quiz.student_id === student.id);
    
    // Calculate average score
    const totalScore = studentQuizzes.reduce((sum, quiz) => sum + quiz.score, 0);
    const averageScore = studentQuizzes.length > 0 ? totalScore / studentQuizzes.length : 0;
    
    // Map quiz records to quiz scores
    const quizScores = studentQuizzes.map(quiz => ({
      quizName: quiz.quiz_name,
      score: quiz.score
    }));

    const courseName = courseMap.get(student.course_id) || 'Unknown Course';

    return {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      fullName: `${student.first_name} ${student.last_name}`,
      email: student.email,
      score: normalizeScore(averageScore, true),
      quizScores,
      courseCompleted: studentQuizzes.length > 0,
      enrollmentDate: student.enrollment_date,
      lastActivityDate: student.last_activity_date,
      courseName
    };
  });
}

// Save certification settings to Supabase
export async function saveCertificationSettings(settings: CertificationSettings): Promise<void> {
  // Get user ID from session
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Check if settings already exist for this user
  const { data: existingSettings } = await supabase
    .from('certification_settings')
    .select('id')
    .eq('user_id', userId)
    .single();

  const settingsRecord: Partial<CertificationSettingsRecord> = {
    pass_threshold: settings.passThreshold,
    date_since: settings.dateSince,
    user_id: userId,
    updated_at: new Date().toISOString()
  };

  if (existingSettings?.id) {
    // Update existing settings
    const { error } = await supabase
      .from('certification_settings')
      .update(settingsRecord)
      .eq('id', existingSettings.id);

    if (error) {
      console.error('Error updating certification settings:', error);
      throw error;
    }
  } else {
    // Create new settings
    settingsRecord.id = uuidv4();
    settingsRecord.created_at = new Date().toISOString();

    const { error } = await supabase
      .from('certification_settings')
      .insert([settingsRecord]);

    if (error) {
      console.error('Error creating certification settings:', error);
      throw error;
    }
  }
}

// Fetch certification settings
export async function fetchCertificationSettings(): Promise<CertificationSettings> {
  // Get user ID from session
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    // Return default settings if not authenticated
    return {
      passThreshold: 70,
      dateSince: null
    };
  }

  const { data, error } = await supabase
    .from('certification_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
    console.error('Error fetching certification settings:', error);
    throw error;
  }

  if (!data) {
    // Return default settings if none found
    return {
      passThreshold: 70,
      dateSince: null
    };
  }

  return {
    passThreshold: data.pass_threshold,
    dateSince: data.date_since
  };
}

// Upload and process file data
export async function uploadAndProcessFiles(parsedFiles: ParsedFile[]): Promise<{ parsedFiles: ParsedFile[], students: Student[] }> {
  console.log('Processing and storing parsed files in Supabase:', parsedFiles);
  
  try {
    // Group files by course
    const courseMap: Record<string, { studentFile?: ParsedFile, quizFile?: ParsedFile }> = {};
    
    parsedFiles.forEach(file => {
      if (!file.courseName) return;
      
      // Extract course name consistently
      const courseName = file.courseName.trim();
      
      if (!courseMap[courseName]) {
        courseMap[courseName] = {};
      }
      
      if (file.type === 'student') {
        courseMap[courseName].studentFile = file;
      } else if (file.type === 'quiz') {
        courseMap[courseName].quizFile = file;
      }
    });
    
    console.log('Courses mapped:', Object.keys(courseMap));
    
    // Process only courses that have both student and quiz files
    const completeCourses = Object.entries(courseMap).filter(
      ([_, files]) => files.studentFile && files.quizFile
    );
    
    if (completeCourses.length === 0) {
      console.warn('No complete courses found (need both student and quiz files)');
      return { parsedFiles, students: [] };
    }
    
    console.log(`Found ${completeCourses.length} complete courses to process`);
    
    const allStudents: Student[] = [];
    
    // Process each complete course
    for (const [courseName, files] of completeCourses) {
      console.log(`Processing course: ${courseName}`);
      
      // First, check if the course already exists
      const { data: existingCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('name', courseName);
      
      let courseId: string;
      
      if (existingCourses && existingCourses.length > 0) {
        courseId = existingCourses[0].id;
        console.log(`Using existing course ID: ${courseId}`);
      } else {
        // Create new course
        const { data: newCourse, error: courseError } = await supabase
          .from('courses')
          .insert({ name: courseName })
          .select('id')
          .single();
        
        if (courseError || !newCourse) {
          console.error('Error creating course:', courseError);
          continue;
        }
        
        courseId = newCourse.id;
        console.log(`Created new course with ID: ${courseId}`);
      }
      
      // Now process the student data
      const studentFile = files.studentFile!;
      const quizFile = files.quizFile!;
      
      console.log(`Student file has ${studentFile.data.length} records`);
      console.log(`Quiz file has ${quizFile.data.length} records`);
      
      // Map of email to student ID for linking quizzes
      const emailToStudentId: Record<string, string> = {};
      
      // Insert all students
      for (const studentData of studentFile.data) {
        const firstName = studentData.firstName || 'Unknown';
        const lastName = studentData.lastName || 'Unknown';
        const email = studentData.email || `unknown-${uuidv4()}@example.com`;
        const enrollmentDate = studentData.enrollmentDate || new Date().toISOString().split('T')[0];
        const lastActivityDate = studentData.lastActivityDate || new Date().toISOString().split('T')[0];
        
        console.log(`Processing student: ${firstName} ${lastName}, ${email}`);
        
        // Skip CMU emails
        if (email.toLowerCase().includes('@andrew.cmu.edu') || email.toLowerCase().includes('@cmu.edu')) {
          console.log(`Skipping CMU student: ${firstName} ${lastName}, ${email}`);
          continue;
        }
        
        // Skip students without proper name or email
        if ((firstName === 'Unknown' && lastName === 'Unknown') || !email || email.startsWith('unknown-')) {
          console.log(`Skipping student with incomplete data: ${firstName} ${lastName}, ${email}`);
          continue;
        }
        
        // Check if student already exists
        const { data: existingStudents } = await supabase
          .from('students')
          .select('id')
          .eq('email', email)
          .eq('course_id', courseId);
        
        let studentId: string;
        
        if (existingStudents && existingStudents.length > 0) {
          studentId = existingStudents[0].id;
          console.log(`Using existing student ID: ${studentId}`);
        } else {
          // Create new student
          const { data: newStudent, error: studentError } = await supabase
            .from('students')
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: email,
              enrollment_date: enrollmentDate,
              last_activity_date: lastActivityDate,
              course_id: courseId
            })
            .select('id')
            .single();
          
          if (studentError || !newStudent) {
            console.error('Error creating student:', studentError);
            continue;
          }
          
          studentId = newStudent.id;
          console.log(`Created new student with ID: ${studentId}`);
        }
        
        emailToStudentId[email] = studentId;
      }
      
      // Insert all quizzes
      for (const quizData of quizFile.data) {
        const email = quizData.email || '';
        const studentId = emailToStudentId[email];
        
        if (!studentId) {
          console.warn(`No student ID found for email: ${email}`);
          continue;
        }
        
        const quizName = quizData.quizName || 'Unknown Quiz';
        // Convert score to number - handling text scores
        let score: number;
        if (typeof quizData.score === 'string') {
          // Try to parse percentage or decimal value
          const scoreStr = quizData.score.trim();
          if (scoreStr.endsWith('%')) {
            score = parseFloat(scoreStr.replace('%', ''));
          } else {
            score = parseFloat(scoreStr) * 100; // Assume decimal if no % sign
          }
          
          // Handle parsing errors
          if (isNaN(score)) {
            score = 0;
            console.warn(`Could not parse score "${quizData.score}" for quiz ${quizName}, defaulting to 0`);
          }
        } else {
          score = quizData.score || 0;
        }
        
        const completedAt = quizData.completedAt || new Date().toISOString().split('T')[0];
        
        console.log(`Processing quiz: ${quizName} for student ${studentId} with score ${score}`);
        
        // Check if this quiz already exists
        const { data: existingQuizzes } = await supabase
          .from('quizzes')
          .select('id')
          .eq('student_id', studentId)
          .eq('quiz_name', quizName);
        
        if (existingQuizzes && existingQuizzes.length > 0) {
          // Update existing quiz
          await supabase
            .from('quizzes')
            .update({
              score: score,
              completed_at: completedAt
            })
            .eq('id', existingQuizzes[0].id);
          
          console.log(`Updated existing quiz ID: ${existingQuizzes[0].id}`);
        } else {
          // Create new quiz
          const { data: newQuiz, error: quizError } = await supabase
            .from('quizzes')
            .insert({
              student_id: studentId,
              quiz_name: quizName,
              score: score,
              completed_at: completedAt,
              course_id: courseId
            })
            .select('id')
            .single();
          
          if (quizError) {
            console.error('Error creating quiz:', quizError);
          } else if (newQuiz) {
            console.log(`Created new quiz with ID: ${newQuiz.id}`);
          }
        }
      }
    }
    
    // Remove any sample data that might exist from previous initializations
    await cleanupSampleData();
    
    // Fetch the updated student data
    const updatedStudents = await fetchStudents();
    
    return {
      parsedFiles,
      students: updatedStudents
    };
  } catch (error) {
    console.error('Error processing and storing files:', error);
    throw error;
  }
}

// Function to cleanup any sample data that might have been created during initialization
async function cleanupSampleData() {
  try {
    console.log('Checking for sample data to clean up...');
    
    // Get sample emails
    const sampleEmails = [
      'john.doe@example.com',
      'jane.smith@example.com',
      'alice.johnson@example.com',
      'bob.brown@example.com',
      'emma.wilson@example.com'
    ];
    
    // Find students with these emails
    const { data: sampleStudents } = await supabase
      .from('students')
      .select('id')
      .in('email', sampleEmails);
    
    if (sampleStudents && sampleStudents.length > 0) {
      const studentIds = sampleStudents.map(s => s.id);
      console.log(`Found ${studentIds.length} sample students to remove`);
      
      // Delete quizzes for these students
      const { error: quizDeleteError } = await supabase
        .from('quizzes')
        .delete()
        .in('student_id', studentIds);
      
      if (quizDeleteError) {
        console.error('Error deleting sample quizzes:', quizDeleteError);
      } else {
        console.log('Sample quizzes deleted successfully');
      }
      
      // Delete the students
      const { error: studentDeleteError } = await supabase
        .from('students')
        .delete()
        .in('id', studentIds);
      
      if (studentDeleteError) {
        console.error('Error deleting sample students:', studentDeleteError);
      } else {
        console.log('Sample students deleted successfully');
      }
    } else {
      console.log('No sample students found');
    }
    
    // Check for sample courses (only if they have no real students)
    const sampleCourseNames = [
      'AI Fundamentals 101',
      'Data Science Basics',
      'Web Development'
    ];
    
    for (const courseName of sampleCourseNames) {
      // Get course
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('name', courseName)
        .single();
      
      if (course) {
        // Check if course has any non-sample students
        const { data: nonSampleStudents, error: countError } = await supabase
          .from('students')
          .select('id')
          .eq('course_id', course.id)
          .not('email', 'in', sampleEmails);
        
        if (!countError && (!nonSampleStudents || nonSampleStudents.length === 0)) {
          // No real students, safe to delete this course
          const { error: courseDeleteError } = await supabase
            .from('courses')
            .delete()
            .eq('id', course.id);
          
          if (courseDeleteError) {
            console.error(`Error deleting sample course ${courseName}:`, courseDeleteError);
          } else {
            console.log(`Sample course ${courseName} deleted successfully`);
          }
        } else {
          console.log(`Course ${courseName} has real students, preserving it`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error cleaning up sample data:', error);
  }
}
