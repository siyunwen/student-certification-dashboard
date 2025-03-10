
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
export async function uploadAndProcessFiles(files: File[]): Promise<{ parsedFiles: ParsedFile[], students: Student[] }> {
  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append(`file-${index}`, file);
  });

  // First, upload files to Supabase storage
  const uploadPromises = files.map(async (file) => {
    const fileName = `${uuidv4()}-${file.name}`;
    const { error } = await supabase.storage
      .from('course-files')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading file:', error);
      throw error;
    }

    return fileName;
  });

  const uploadedFileNames = await Promise.all(uploadPromises);
  
  // Here we would typically call a Supabase Edge Function to process the files
  // Since we don't have that set up yet, we'll return empty data
  // In a real implementation, you would create and call an Edge Function

  // Mock the response for now
  return {
    parsedFiles: [],
    students: []
  };
}
