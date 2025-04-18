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
    console.log('Fetching students from localStorage:', storedStudents ? 'Found data' : 'No data found');
    
    if (!storedStudents) return [];
    
    const parsedStudents = JSON.parse(storedStudents);
    console.log(`Parsed ${parsedStudents.length} students from localStorage`);
    return parsedStudents;
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
    // Group files by course with support for course merging
    const courseMap: Record<string, { studentFile?: ParsedFile, quizFile?: ParsedFile }> = {};
    
    // First detect course prefixes for merging
    const coursePrefixes = detectCoursePrefixes(parsedFiles);
    console.log('Detected course prefixes for merging:', coursePrefixes);
    
    parsedFiles.forEach(file => {
      if (!file.courseName) return;
      
      // Extract course name consistently
      const courseName = file.courseName.trim();
      
      // Check if this course should be merged based on prefix
      const coursePrefix = getCoursePrefixForFile(courseName, coursePrefixes);
      const finalCourseName = coursePrefix || courseName;
      
      if (!courseMap[finalCourseName]) {
        courseMap[finalCourseName] = {};
      }
      
      if (file.type === 'student') {
        // For student files, merge if there's an existing student file
        if (courseMap[finalCourseName].studentFile) {
          console.log(`Merging student data for course prefix: ${finalCourseName}`);
          courseMap[finalCourseName].studentFile = mergeFiles(
            courseMap[finalCourseName].studentFile!, 
            file,
            finalCourseName
          );
        } else {
          // First student file for this course
          const newFile = { ...file };
          // If we're using a prefix, update the courseName in the file to be the prefix
          if (coursePrefix) {
            newFile.courseName = finalCourseName;
          }
          courseMap[finalCourseName].studentFile = newFile;
          console.log(`Added first student file for course: ${finalCourseName}`);
        }
      } else if (file.type === 'quiz') {
        // For quiz files, merge if there's an existing quiz file
        if (courseMap[finalCourseName].quizFile) {
          console.log(`Merging quiz data for course prefix: ${finalCourseName}`);
          courseMap[finalCourseName].quizFile = mergeFiles(
            courseMap[finalCourseName].quizFile!, 
            file,
            finalCourseName
          );
        } else {
          // First quiz file for this course
          const newFile = { ...file };
          // If we're using a prefix, update the courseName in the file to be the prefix
          if (coursePrefix) {
            newFile.courseName = finalCourseName;
          }
          courseMap[finalCourseName].quizFile = newFile;
          console.log(`Added first quiz file for course: ${finalCourseName}`);
        }
      }
    });
    
    console.log('Courses mapped with merging:', Object.keys(courseMap));
    
    // Process only courses that have both student and quiz files
    const completeCourses = Object.entries(courseMap).filter(
      ([_, files]) => files.studentFile && files.quizFile
    );
    
    console.log(`Found ${completeCourses.length} complete courses to process (needs both student and quiz files)`);
    
    if (completeCourses.length === 0) {
      console.warn('No complete courses found (need both student and quiz files for at least one course)');
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
      
      // Map of student identifiers to student data for linking quizzes
      const studentMap: Record<string, any> = {};
      
      // Process all students first
      for (const studentData of studentFile.data) {
        const firstName = studentData.firstName || studentData.first_name || studentData.given_name || 'Unknown';
        const lastName = studentData.lastName || studentData.last_name || studentData.family_name || 'Unknown';
        const email = (studentData.email || '').toLowerCase();
        const enrollmentDate = studentData.enrollmentDate || studentData.enrollment_date || new Date().toISOString().split('T')[0];
        const lastActivityDate = studentData.lastActivityDate || studentData.last_interaction || new Date().toISOString().split('T')[0];
        
        // Skip CMU emails
        if (email.includes('@andrew.cmu.edu') || email.includes('@cmu.edu') || email.includes('@example.com')) {
          console.log(`Skipping CMU or example student: ${firstName} ${lastName}, ${email}`);
          continue;
        }
        
        // Skip students without proper name or email
        if ((firstName === 'Unknown' && lastName === 'Unknown') || !email) {
          console.log(`Skipping student with incomplete data: ${firstName} ${lastName}, ${email}`);
          continue;
        }
        
        const studentId = uuidv4();
        
        // Create student object (without quiz scores yet)
        const studentObj = {
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
          score: 0,
          allCourses: [courseName]
        };
        
        // Add student to the map with multiple keys for matching:
        // 1. By email (primary key if available)
        if (email) {
          studentMap[email.toLowerCase()] = studentObj;
          console.log(`Added student email key: ${email.toLowerCase()}`);
        }
        
        // 2. By various name formats for matching
        const nameFormats = [
          `${firstName.toLowerCase()} ${lastName.toLowerCase()}`,         // First Last
          `${lastName.toLowerCase()}, ${firstName.toLowerCase()}`,        // Last, First
          `${firstName.toLowerCase()}${lastName.toLowerCase()}`,          // FirstLast
          `${lastName.toLowerCase()}${firstName.toLowerCase()}`,          // LastFirst
          firstName.toLowerCase(),                                        // Just First (fallback)
          lastName.toLowerCase()                                          // Just Last (fallback)
        ];
        
        nameFormats.forEach(format => {
          studentMap[format] = studentObj;
        });
        
        console.log(`Added student: ${firstName} ${lastName} with matching keys for quiz matching`);
      }
      
      // Map of processed students to avoid duplicates after matching
      const processedStudents = new Set<string>();
      
      // Now process all quizzes and try to match to students
      for (const quizData of quizFile.data) {
        // Extract quiz name and score
        const quizName = quizData.quizName || '';
        const rawScore = quizData.score;
        
        // Log more details about the quiz data
        console.log(`Processing quiz: ${quizName}, raw score: ${rawScore} (${typeof rawScore})`);
        
        // Gather all possible student identifiers from quiz data
        const studentEmail = quizData.email || '';
        const studentFirstName = quizData.firstName || '';
        const studentLastName = quizData.lastName || '';
        
        // Try to match by email first (most reliable)
        if (studentEmail) {
          const email = studentEmail.toLowerCase();
          const studentObj = studentMap[email];
          
          if (studentObj) {
            console.log(`Matched quiz ${quizName} to student by email: ${email}`);
            addQuizToStudent(studentObj, quizName, rawScore);
            processedStudents.add(studentObj.id);
            continue;
          }
        }
        
        // Try to match by full name
        if (studentFirstName && studentLastName) {
          // Try multiple name formats
          const nameFormats = [
            `${studentFirstName.toLowerCase()} ${studentLastName.toLowerCase()}`,
            `${studentLastName.toLowerCase()}, ${studentFirstName.toLowerCase()}`,
            `${studentFirstName.toLowerCase()}${studentLastName.toLowerCase()}`,
            `${studentLastName.toLowerCase()}${studentFirstName.toLowerCase()}`,
          ];
          
          let found = false;
          for (const format of nameFormats) {
            if (studentMap[format]) {
              console.log(`Matched quiz ${quizName} to student by name format: ${format}`);
              addQuizToStudent(studentMap[format], quizName, rawScore);
              processedStudents.add(studentMap[format].id);
              found = true;
              break;
            }
          }
          
          if (found) continue;
        }
        
        // Try individual names
        if (studentFirstName) {
          const key = studentFirstName.toLowerCase();
          if (studentMap[key]) {
            console.log(`Matched quiz ${quizName} to student by first name: ${key}`);
            addQuizToStudent(studentMap[key], quizName, rawScore);
            processedStudents.add(studentMap[key].id);
            continue;
          }
        }
        
        if (studentLastName) {
          const key = studentLastName.toLowerCase();
          if (studentMap[key]) {
            console.log(`Matched quiz ${quizName} to student by last name: ${key}`);
            addQuizToStudent(studentMap[key], quizName, rawScore);
            processedStudents.add(studentMap[key].id);
            continue;
          }
        }
        
        console.log(`Could not match quiz ${quizName} for student: ${studentFirstName} ${studentLastName}`);
      }
      
      // Add all matched students to the final list
      for (const studentId of processedStudents) {
        const student = Object.values(studentMap).find(s => s.id === studentId);
        if (student && student.quizScores.length > 0) {
          // Calculate average score for the student
          const totalScore = student.quizScores.reduce((sum: number, quiz: any) => {
            return sum + (typeof quiz.score === 'number' ? quiz.score : 0);
          }, 0);
          
          const averageScore = totalScore / student.quizScores.length;
          student.score = averageScore;
          console.log(`Student ${student.firstName} ${student.lastName}: Calculated average score ${student.score} from ${student.quizScores.length}`);
          
          allStudents.push(student);
          console.log(`Adding student ${student.firstName} ${student.lastName} with ${student.quizScores.length} quizzes and score ${student.score}`);
        }
      }
    }
    
    console.log(`Processed ${allStudents.length} students with matched quiz scores`);
    
    // Save the processed students to localStorage
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(allStudents));
    console.log(`Saved ${allStudents.length} students to localStorage with key ${STUDENTS_KEY}`);
    
    return {
      parsedFiles,
      students: allStudents
    };
  } catch (error) {
    console.error('Error processing files:', error);
    throw error;
  }
}

// Helper functions for course prefix detection and file merging

// Detect course prefixes for potential merging (e.g., "aifi" from "aifi_301", "aifi_302")
function detectCoursePrefixes(files: ParsedFile[]): string[] {
  const courseNames = files.map(file => file.courseName);
  const prefixMap: Record<string, number> = {};
  
  // Updated to consider the first 4 characters
  courseNames.forEach(name => {
    if (!name || name.length < 4) return;
    
    // Get first 4 characters as the prefix
    const prefix = name.substring(0, 4);
    prefixMap[prefix] = (prefixMap[prefix] || 0) + 1;
  });
  
  // Only consider prefixes that appear more than once
  return Object.entries(prefixMap)
    .filter(([_, count]) => count > 1)
    .map(([prefix]) => prefix);
}

// Get the appropriate course prefix for a filename, if it should be merged
function getCoursePrefixForFile(courseName: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (courseName.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}

// Merge two parsed files (same type) into one
function mergeFiles(file1: ParsedFile, file2: ParsedFile, courseName: string): ParsedFile {
  // Make sure the files are of the same type
  if (file1.type !== file2.type) {
    throw new Error(`Cannot merge files of different types: ${file1.type} and ${file2.type}`);
  }
  
  // Create a new file with merged data
  return {
    type: file1.type,
    courseName: courseName,
    data: [...file1.data, ...file2.data]
  };
}

// Helper function to parse name from quiz file (usually in "Last, First" format)
function parseNameFromQuizFile(name: string): { firstName: string; lastName: string } {
  if (!name || typeof name !== 'string') {
    return { firstName: 'Unknown', lastName: 'Unknown' };
  }
  
  name = name.trim();
  
  // Format: "Last, First"
  if (name.includes(',')) {
    const parts = name.split(',').map(part => part.trim());
    return {
      firstName: parts.length > 1 ? parts[1] : 'Unknown',
      lastName: parts[0] || 'Unknown'
    };
  }
  // Format: "First Last"
  else if (name.includes(' ')) {
    const parts = name.split(' ');
    return {
      firstName: parts[0] || 'Unknown',
      lastName: parts.slice(1).join(' ') || 'Unknown'
    };
  }
  // Just a single name
  else {
    return { firstName: name, lastName: 'Unknown' };
  }
}

// Helper function to add a quiz to a student
function addQuizToStudent(student: any, quizName: string, score: number | string | null): void {
  // Make sure we properly parse the score
  const parsedScore = score !== null ? parseScoreValue(score) : null;
  
  console.log(`Adding quiz "${quizName}" to ${student.firstName} ${student.lastName} with score: ${parsedScore}%`);
  
  student.quizScores.push({
    quizName,
    score: parsedScore,
    completedAt: new Date().toISOString().split('T')[0]
  });
  
  student.courseCompleted = true;
}

// Clear all stored data
export async function clearStoredData(): Promise<void> {
  console.log('Clearing all stored data...');
  localStorage.removeItem(STUDENTS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  console.log('Storage cleared.');
}
