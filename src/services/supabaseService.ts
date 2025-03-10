
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

  return studentRecords.map(student => {
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
      
      if (!courseMap[file.courseName]) {
        courseMap[file.courseName] = {};
      }
      
      if (file.type === 'student') {
        courseMap[file.courseName].studentFile = file;
      } else if (file.type === 'quiz') {
        courseMap[file.courseName].quizFile = file;
      }
    });
    
    // Process only courses that have both student and quiz files
    const completeCourses = Object.entries(courseMap).filter(
      ([_, files]) => files.studentFile && files.quizFile
    );
    
    if (completeCourses.length === 0) {
      console.warn('No complete courses found (need both student and quiz files)');
      return { parsedFiles, students: [] };
    }
    
    const allStudents: Student[] = [];
    
    // Process each complete course
    for (const [courseName, files] of completeCourses) {
      // First, check if the course already exists
      const { data: existingCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('name', courseName);
      
      let courseId: string;
      
      if (existingCourses && existingCourses.length > 0) {
        courseId = existingCourses[0].id;
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
      }
      
      // Now process the student data
      const studentFile = files.studentFile!;
      const quizFile = files.quizFile!;
      
      // Map of email to student ID for linking quizzes
      const emailToStudentId: Record<string, string> = {};
      
      // Insert all students
      for (const studentData of studentFile.data) {
        const firstName = studentData.firstName || 'Unknown';
        const lastName = studentData.lastName || 'Unknown';
        const email = studentData.email || `unknown-${uuidv4()}@example.com`;
        const enrollmentDate = studentData.enrollmentDate || new Date().toISOString().split('T')[0];
        const lastActivityDate = studentData.lastActivityDate || new Date().toISOString().split('T')[0];
        
        // Check if student already exists
        const { data: existingStudents } = await supabase
          .from('students')
          .select('id')
          .eq('email', email)
          .eq('course_id', courseId);
        
        let studentId: string;
        
        if (existingStudents && existingStudents.length > 0) {
          studentId = existingStudents[0].id;
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
        const score = quizData.score || 0;
        const completedAt = quizData.completedAt || new Date().toISOString().split('T')[0];
        
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
        } else {
          // Create new quiz
          await supabase
            .from('quizzes')
            .insert({
              student_id: studentId,
              quiz_name: quizName,
              score: score,
              completed_at: completedAt,
              course_id: courseId
            });
        }
      }
    }
    
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
