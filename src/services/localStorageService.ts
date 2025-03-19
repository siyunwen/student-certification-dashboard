
import { Student, CertificationSettings, ParsedFile } from '@/types/student';
import { v4 as uuidv4 } from 'uuid';
import { normalizeScore, parseScoreValue } from '@/utils/scoreUtils';

// Local storage keys
const STUDENTS_KEY = 'certification_students';
const SETTINGS_KEY = 'certification_settings';

// Fetch students from localStorage
export async function fetchStudents(): Promise<Student[]> {
  try {
    const storedStudents = localStorage.getItem(STUDENTS_KEY);
    if (!storedStudents) return [];
    
    return JSON.parse(storedStudents);
  } catch (error) {
    console.error('Error fetching students from localStorage:', error);
    return [];
  }
}

// Save certification settings to localStorage
export async function saveCertificationSettings(settings: CertificationSettings): Promise<void> {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
    throw error;
  }
}

// Fetch certification settings from localStorage
export async function fetchCertificationSettings(): Promise<CertificationSettings> {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (!storedSettings) {
      // Return default settings if none found
      return {
        passThreshold: 70,
        dateSince: null
      };
    }
    
    return JSON.parse(storedSettings);
  } catch (error) {
    console.error('Error fetching settings from localStorage:', error);
    // Return default settings if error
    return {
      passThreshold: 70,
      dateSince: null
    };
  }
}

// Process and store parsed files
export async function processFiles(parsedFiles: ParsedFile[]): Promise<{ parsedFiles: ParsedFile[], students: Student[] }> {
  console.log('Processing parsed files:', parsedFiles);
  
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
      
      // Now process the student data
      const studentFile = files.studentFile!;
      const quizFile = files.quizFile!;
      
      console.log(`Student file has ${studentFile.data.length} records`);
      console.log(`Quiz file has ${quizFile.data.length} records`);
      
      // Map of email to student data for linking quizzes
      const emailToStudent: Record<string, any> = {};
      
      // Process all students
      for (const studentData of studentFile.data) {
        const firstName = studentData.firstName || 'Unknown';
        const lastName = studentData.lastName || 'Unknown';
        const email = studentData.email?.toLowerCase() || `unknown-${uuidv4()}@example.com`;
        const enrollmentDate = studentData.enrollmentDate || new Date().toISOString().split('T')[0];
        const lastActivityDate = studentData.lastActivityDate || new Date().toISOString().split('T')[0];
        
        // Skip CMU emails
        if (email.includes('@andrew.cmu.edu') || email.includes('@cmu.edu') || email.includes('@example.com')) {
          console.log(`Skipping CMU or example student: ${firstName} ${lastName}, ${email}`);
          continue;
        }
        
        // Skip students without proper name or email
        if ((firstName === 'Unknown' && lastName === 'Unknown') || !email || email.startsWith('unknown-')) {
          console.log(`Skipping student with incomplete data: ${firstName} ${lastName}, ${email}`);
          continue;
        }
        
        const studentId = uuidv4();
        
        // Create student object (without quiz scores yet)
        emailToStudent[email] = {
          id: studentId,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          email,
          enrollmentDate,
          lastActivityDate,
          courseName,
          quizScores: [],
          courseCompleted: false,
          score: 0
        };
      }
      
      // Process all quizzes
      for (const quizData of quizFile.data) {
        const email = quizData.email?.toLowerCase() || '';
        const studentObj = emailToStudent[email];
        
        if (!studentObj) {
          console.warn(`No student found for email: ${email}`);
          continue;
        }
        
        const quizName = quizData.quizName || 'Unknown Quiz';
        
        // Parse score
        let score = parseScoreValue(quizData.score || 0);
        
        const completedAt = quizData.completedAt || new Date().toISOString().split('T')[0];
        
        console.log(`Processing quiz: ${quizName} for student ${studentObj.firstName} with score ${score}`);
        
        // Add quiz score to student
        studentObj.quizScores.push({
          quizName,
          score
        });
        
        // Mark as completed
        studentObj.courseCompleted = true;
      }
      
      // Calculate average scores and add students to final list
      Object.values(emailToStudent).forEach((student: any) => {
        if (student.quizScores.length > 0) {
          const totalScore = student.quizScores.reduce((sum: number, quiz: any) => sum + quiz.score, 0);
          student.score = normalizeScore(totalScore / student.quizScores.length, true);
          allStudents.push(student as Student);
        }
      });
    }
    
    // Save the processed students to localStorage
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(allStudents));
    
    return {
      parsedFiles,
      students: allStudents
    };
  } catch (error) {
    console.error('Error processing files:', error);
    throw error;
  }
}

// Clear all stored data
export async function clearStoredData(): Promise<void> {
  localStorage.removeItem(STUDENTS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
}
