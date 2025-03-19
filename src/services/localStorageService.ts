
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
    // Group files by course with support for course merging
    const courseMap: Record<string, { studentFile?: ParsedFile, quizFile?: ParsedFile }> = {};
    
    // First detect course prefixes for merging (e.g., "aifi_" in "aifi_301", "aifi_302")
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
        }
      }
    });
    
    console.log('Courses mapped with merging:', Object.keys(courseMap));
    
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
      
      // Map of student identifiers to student data for linking quizzes
      const studentMap: Record<string, any> = {};
      
      // Process all students first
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
          score: 0
        };
        
        // Add student to the map with multiple keys for matching:
        // 1. By email (primary key if available)
        if (email && !email.startsWith('unknown-')) {
          studentMap[email.toLowerCase()] = studentObj;
        }
        
        // 2. By "firstName lastName" format
        studentMap[`${firstName.toLowerCase()} ${lastName.toLowerCase()}`] = studentObj;
        
        // 3. By "lastName, firstName" format (for quizzes)
        studentMap[`${lastName.toLowerCase()}, ${firstName.toLowerCase()}`] = studentObj;
        
        // 4. By just firstName + lastName (without space) - helps with some formats
        studentMap[`${firstName.toLowerCase()}${lastName.toLowerCase()}`] = studentObj;
        
        console.log(`Added student: ${firstName} ${lastName} with keys: 
          - ${email.toLowerCase()}
          - ${firstName.toLowerCase()} ${lastName.toLowerCase()}
          - ${lastName.toLowerCase()}, ${firstName.toLowerCase()}
          - ${firstName.toLowerCase()}${lastName.toLowerCase()}`);
      }
      
      // Map of processed students to avoid duplicates after matching
      const processedStudents = new Set<string>();
      
      // Now process all quizzes and try to match to students
      for (const quizData of quizFile.data) {
        const quizName = quizData.quizName || 'Unknown Quiz';
        const score = parseScoreValue(quizData.score || 0);
        const completedAt = quizData.completedAt || new Date().toISOString().split('T')[0];
        
        // First try to match by email if available
        if (quizData.email) {
          const email = quizData.email.toLowerCase();
          const studentObj = studentMap[email];
          
          if (studentObj) {
            console.log(`Matched quiz ${quizName} to student by email: ${email}`);
            addQuizToStudent(studentObj, quizName, score, completedAt);
            processedStudents.add(studentObj.id);
            continue;
          }
        }
        
        // Try to match by full name
        if (quizData.firstName && quizData.lastName) {
          // Try both formats: "First Last" and "Last, First"
          const formatName1 = `${quizData.firstName.toLowerCase()} ${quizData.lastName.toLowerCase()}`;
          const formatName2 = `${quizData.lastName.toLowerCase()}, ${quizData.firstName.toLowerCase()}`;
          const formatName3 = `${quizData.firstName.toLowerCase()}${quizData.lastName.toLowerCase()}`;
          
          const studentObj = studentMap[formatName1] || studentMap[formatName2] || studentMap[formatName3];
          
          if (studentObj) {
            console.log(`Matched quiz ${quizName} to student by name formats: ${formatName1} or ${formatName2}`);
            addQuizToStudent(studentObj, quizName, score, completedAt);
            processedStudents.add(studentObj.id);
            continue;
          }
        }
        
        // Last resort: try to match by studentName (original string) if available
        if (quizData.studentName) {
          // Get the parsed firstName, lastName from the studentName
          const { firstName, lastName } = parseNameFromQuizFile(quizData.studentName);
          
          // Try both formats again
          const formatName1 = `${firstName.toLowerCase()} ${lastName.toLowerCase()}`;
          const formatName2 = `${lastName.toLowerCase()}, ${firstName.toLowerCase()}`;
          const formatName3 = `${firstName.toLowerCase()}${lastName.toLowerCase()}`;
          
          const studentObj = studentMap[formatName1] || studentMap[formatName2] || studentMap[formatName3];
          
          if (studentObj) {
            console.log(`Matched quiz ${quizName} to student by parsed name: ${formatName1} or ${formatName2}`);
            addQuizToStudent(studentObj, quizName, score, completedAt);
            processedStudents.add(studentObj.id);
          } else {
            console.log(`Could not match quiz for student: ${quizData.studentName}`);
          }
        }
      }
      
      // Add all matched students to the final list
      for (const studentId of processedStudents) {
        const student = Object.values(studentMap).find(s => s.id === studentId);
        if (student && student.quizScores.length > 0) {
          // Calculate average score for the student
          const totalScore = student.quizScores.reduce((sum: number, quiz: any) => sum + quiz.score, 0);
          student.score = normalizeScore(totalScore / student.quizScores.length, true);
          allStudents.push(student);
        }
      }
    }
    
    console.log(`Processed ${allStudents.length} students with matched quiz scores`);
    
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

// Helper functions for course prefix detection and file merging

// Detect course prefixes for potential merging (e.g., "aifi_" from "aifi_301", "aifi_302")
function detectCoursePrefixes(files: ParsedFile[]): string[] {
  const courseNames = files.map(file => file.courseName);
  const prefixMap: Record<string, number> = {};
  
  // Detect potential prefixes by looking for patterns like "prefix_number"
  courseNames.forEach(name => {
    if (!name) return;
    
    // Look for patterns like "aifi_301" where "aifi_" is the prefix
    const match = name.match(/^([a-zA-Z]+_)\d+/);
    if (match && match[1]) {
      const prefix = match[1]; // e.g., "aifi_"
      prefixMap[prefix] = (prefixMap[prefix] || 0) + 1;
    }
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
function addQuizToStudent(student: any, quizName: string, score: number, completedAt: string): void {
  student.quizScores.push({
    quizName,
    score
  });
  student.courseCompleted = true;
}

// Clear all stored data
export async function clearStoredData(): Promise<void> {
  localStorage.removeItem(STUDENTS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
}
