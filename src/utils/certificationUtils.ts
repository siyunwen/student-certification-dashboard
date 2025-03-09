
import { Student, CertificationSettings, CertificationStats, ParsedFile, CourseData } from '../types/student';

export const isEligibleForCertification = (
  student: Student,
  settings: CertificationSettings
): boolean => {
  // Check if student passed the threshold
  const passedThreshold = student.score >= settings.passThreshold;
  
  // Check if student completed the course
  const completedCourse = student.courseCompleted;
  
  // Check if student activity is after the dateSince filter
  const meetsDateRequirement = settings.dateSince 
    ? new Date(student.lastActivityDate) >= new Date(settings.dateSince)
    : true;
  
  return passedThreshold && completedCourse && meetsDateRequirement;
};

export const getEligibleStudents = (
  students: Student[],
  settings: CertificationSettings
): Student[] => {
  return students.filter(student => isEligibleForCertification(student, settings));
};

export const calculateCertificationStats = (
  students: Student[],
  settings: CertificationSettings
): CertificationStats => {
  const totalStudents = students.length;
  
  if (totalStudents === 0) {
    return {
      totalStudents: 0,
      eligibleStudents: 0,
      averageScore: 0,
      passRate: 0
    };
  }
  
  const eligibleStudents = getEligibleStudents(students, settings).length;
  
  // Calculate average score
  const totalScore = students.reduce((sum, student) => sum + student.score, 0);
  const averageScore = totalScore / totalStudents;
  
  // Calculate pass rate
  const passRate = (eligibleStudents / totalStudents) * 100;
  
  return {
    totalStudents,
    eligibleStudents,
    averageScore,
    passRate
  };
};

export const extractCourseNameFromFilename = (filename: string): string => {
  // Remove file extension if present
  let name = filename.replace(/\.(csv|txt|xlsx|xls)$/i, '');
  
  // Check for common file patterns
  const studentPattern = /_students$/i;
  const quizPattern = /_quiz_scores$/i;
  
  // Remove the suffix patterns
  name = name.replace(studentPattern, '').replace(quizPattern, '');
  
  // Clean up any remaining underscores at the end
  name = name.replace(/_+$/, '');
  
  return name;
};

export const parseFileContent = (filename: string, content: string): ParsedFile => {
  const lines = content.trim().split('\n');
  if (lines.length <= 1) {
    return { type: 'student', courseName: '', data: [] };
  }
  
  const headers = lines[0].split(',');
  
  // Determine file type based on the headers or filename
  const isQuizFile = filename.toLowerCase().includes('quiz') || headers.includes('student');
  const type = isQuizFile ? 'quiz' : 'student';
  
  // Extract course name from filename
  const courseName = extractCourseNameFromFilename(filename);
  
  // Parse data based on file type
  const data = lines.slice(1).map(line => {
    const values = line.split(',');
    const row: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      if (index < values.length) {
        row[header.trim()] = values[index].trim();
      }
    });
    
    return row;
  });
  
  return { type, courseName, data };
};

export const parseStudentName = (name: string, isLastFirstFormat: boolean): { firstName: string, lastName: string } => {
  if (!name || name.trim() === '') {
    return { firstName: '', lastName: '' };
  }
  
  if (isLastFirstFormat) {
    // Format: "Last, First"
    const parts = name.split(',').map(part => part.trim());
    return {
      firstName: parts[1] || '',
      lastName: parts[0] || ''
    };
  } else {
    // Format: "First Last"
    const parts = name.split(' ');
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || ''
    };
  }
};

// Convert string value to number, handling various formats
export const parseScoreValue = (value: string | number): number => {
  if (typeof value === 'number') return value;
  
  // Handle empty values
  if (!value || value.trim() === '') return 0;
  
  // Handle "not finished" or similar non-numeric indicators
  if (value.toString().toLowerCase().includes('not') || 
      value.toString().toLowerCase().includes('n/a') ||
      value.toString().toLowerCase().includes('incomplete')) {
    return 0;
  }
  
  // Remove any non-numeric characters except decimal point
  const cleanValue = value.toString().replace(/[^\d.]/g, '');
  
  // Parse the clean value as a number
  const numberValue = parseFloat(cleanValue);
  
  // Return 0 if NaN
  return isNaN(numberValue) ? 0 : numberValue;
};

// Group files by course name and check if both student and quiz files are present
export const groupFilesByCourse = (files: ParsedFile[]): Record<string, CourseData> => {
  const courseMap: Record<string, CourseData> = {};
  
  files.forEach(file => {
    if (!file.courseName) return;
    
    if (!courseMap[file.courseName]) {
      courseMap[file.courseName] = {
        isComplete: false
      };
    }
    
    if (file.type === 'student') {
      courseMap[file.courseName].studentFile = file;
    } else if (file.type === 'quiz') {
      courseMap[file.courseName].quizFile = file;
    }
    
    // Check if course has both files
    courseMap[file.courseName].isComplete = 
      !!courseMap[file.courseName].studentFile && 
      !!courseMap[file.courseName].quizFile;
  });
  
  return courseMap;
};

// Filter out test accounts and invalid data
export const isValidStudent = (student: any): boolean => {
  // Check if student has name and email
  if (!student.firstName || !student.lastName || !student.email) {
    return false;
  }
  
  // Filter out andrew.cmu.edu and cmu.edu emails
  if (student.email.toLowerCase().endsWith('andrew.cmu.edu') || 
      student.email.toLowerCase().endsWith('cmu.edu')) {
    return false;
  }
  
  return true;
};

export const combineStudentAndQuizData = (studentFiles: ParsedFile[], quizFiles: ParsedFile[]): Student[] => {
  const students: Student[] = [];
  const studentMap: Record<string, any> = {};
  let studentIdCounter = 0;
  
  // Process student files
  studentFiles.forEach(studentFile => {
    studentFile.data.forEach(studentData => {
      const name = studentData.name || '';
      const { firstName, lastName } = parseStudentName(name, false);
      const email = studentData.email || '';
      const lastActivityDate = studentData.last_interaction ? 
        studentData.last_interaction.split(' ')[0] : // Extract date part only
        new Date().toISOString().split('T')[0];
      
      // Skip invalid entries
      if (!firstName || !lastName || !email) {
        return;
      }
      
      // Skip cmu.edu and andrew.cmu.edu emails
      if (email.toLowerCase().endsWith('andrew.cmu.edu') || 
          email.toLowerCase().endsWith('cmu.edu')) {
        return;
      }
      
      // Create a key using email
      const key = email.toLowerCase();
      
      if (!studentMap[key]) {
        studentMap[key] = {
          id: `student-${studentIdCounter++}`,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          email,
          score: 0, // Will be calculated from quiz scores
          quizScores: [],
          courseCompleted: true, // Default to true
          enrollmentDate: new Date().toISOString().split('T')[0], // Default to today
          lastActivityDate,
          courseName: studentFile.courseName
        };
      }
    });
  });
  
  // Process quiz files
  quizFiles.forEach(quizFile => {
    console.log(`Processing quiz file for course: ${quizFile.courseName}`);
    console.log(`Quiz file headers:`, quizFile.data[0] ? Object.keys(quizFile.data[0]) : 'No data');
    
    quizFile.data.forEach(quizData => {
      const name = quizData.student || '';
      const { firstName, lastName } = parseStudentName(name, true);
      const fullName = `${firstName} ${lastName}`;
      
      // Skip invalid entries
      if (!firstName && !lastName) {
        return;
      }
      
      // Find corresponding student by matching name
      let matchedStudent = null;
      
      // Try to find by full name
      for (const key in studentMap) {
        const student = studentMap[key];
        if (student.fullName.toLowerCase() === fullName.toLowerCase() ||
            (`${student.lastName}, ${student.firstName}`).toLowerCase() === name.toLowerCase()) {
          matchedStudent = student;
          break;
        }
      }
      
      if (matchedStudent) {
        console.log(`Found matching student for: ${name}`);
        // Create a debug log of raw quiz values
        const rawQuizValues = {};
        Object.keys(quizData).forEach(key => {
          if (key !== 'student') {
            rawQuizValues[key] = quizData[key];
          }
        });
        console.log(`Raw quiz values for ${name}:`, rawQuizValues);
        
        // Add quiz scores
        let validScoreCount = 0;
        let totalScore = 0;
        
        Object.keys(quizData).forEach(key => {
          if (key !== 'student') {
            // Get the original value before parsing
            const originalValue = quizData[key];
            // Convert quiz score to number with improved parsing
            const scoreValue = parseScoreValue(originalValue);
            console.log(`Quiz "${key}" - Original value: "${originalValue}" - Parsed value: ${scoreValue}`);
            
            // Only count scores > 0 for average calculation
            if (scoreValue > 0) {
              validScoreCount++;
              totalScore += scoreValue;
            }
            
            matchedStudent.quizScores.push({
              quizName: key,
              score: scoreValue
            });
          }
        });
        
        // Calculate average score
        if (validScoreCount > 0) {
          matchedStudent.score = totalScore / validScoreCount;
        } else if (matchedStudent.quizScores.length > 0) {
          // If we have quiz scores but they're all 0, set score to 0
          matchedStudent.score = 0;
        }
        
        // Log for debugging
        console.log(`Student ${matchedStudent.fullName} has score: ${matchedStudent.score.toFixed(1)}% (from ${validScoreCount} valid scores out of ${matchedStudent.quizScores.length} total quiz entries)`);
      } else {
        console.log(`No matching student found for: ${name}`);
      }
    });
  });
  
  // Convert map to array
  for (const key in studentMap) {
    const student = studentMap[key];
    
    // Only add valid students
    if (isValidStudent(student)) {
      students.push(student as Student);
    }
  }
  
  console.log(`Total students processed: ${students.length}`);
  if (students.length > 0) {
    console.log(`Sample student scores:`, students.slice(0, 3).map(s => ({
      name: s.fullName,
      score: s.score,
      quizScores: s.quizScores
    })));
  }
  
  return students;
};

export const parseCSVData = (filename: string, csvContent: string): ParsedFile => {
  console.log(`Parsing file: ${filename}`);
  const result = parseFileContent(filename, csvContent);
  if (result.data.length > 0) {
    console.log(`Sample data row:`, result.data[0]);
  }
  return result;
};
