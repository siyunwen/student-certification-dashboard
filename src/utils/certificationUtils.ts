
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
  
  console.log(`Parsing ${type} file: ${filename} with ${lines.length} lines`);
  console.log(`Headers found: ${headers.join(', ')}`);
  
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
  
  console.log(`Parsed ${data.length} rows of data for ${courseName}`);
  if (data.length > 0) {
    console.log(`Sample data entry:`, data[0]);
  }
  
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

export const parseScoreValue = (value: string | number): number => {
  if (typeof value === 'number') return value;
  
  // Handle empty values
  if (!value || value.trim() === '') return 0;
  
  // Handle "not finished" or similar non-numeric indicators
  const lowerValue = value.toString().toLowerCase();
  if (lowerValue.includes('not') || 
      lowerValue.includes('n/a') ||
      lowerValue.includes('incomplete')) {
    console.log(`Treating non-numeric value "${value}" as 0`);
    return 0;
  }
  
  // Remove percentage signs and keep only numbers and decimal points
  const cleanValue = value.toString().replace(/%/g, '').trim();
  
  // Parse the clean value as a number
  const numberValue = parseFloat(cleanValue);
  
  // Return 0 if NaN
  if (isNaN(numberValue)) {
    console.log(`Failed to parse "${value}" as a number, using 0 instead`);
    return 0;
  }
  
  return numberValue;
};

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

const normalizeNameForComparison = (name: string): string => {
  // Remove all whitespace, punctuation, and convert to lowercase for comparison
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, '');    // Remove whitespace
};

export const combineStudentAndQuizData = (studentFiles: ParsedFile[], quizFiles: ParsedFile[]): Student[] => {
  console.log("=== STARTING STUDENT AND QUIZ DATA COMBINATION ===");
  console.log("DEBUG: Number of student files:", studentFiles.length);
  console.log("DEBUG: Number of quiz files:", quizFiles.length);
  
  const students: Student[] = [];
  const studentMap: Record<string, any> = {};
  let studentIdCounter = 0;
  
  // Process student files
  studentFiles.forEach(studentFile => {
    console.log(`Processing student file for course: ${studentFile.courseName} with ${studentFile.data.length} students`);
    
    studentFile.data.forEach(studentData => {
      // Log all fields from student data for debugging
      console.log("Student data fields:", Object.keys(studentData));
      
      // Try to determine the name field (different files might use different header names)
      let nameField = 'name';
      if (!studentData.name && studentData.student) {
        nameField = 'student';
      } else if (!studentData.name && studentData.student_name) {
        nameField = 'student_name';
      }
      
      const name = studentData[nameField] || '';
      console.log(`Student raw name from ${nameField} field: "${name}"`);
      
      const { firstName, lastName } = parseStudentName(name, false);
      const email = studentData.email || '';
      const lastActivityDate = studentData.last_interaction ? 
        studentData.last_interaction.split(' ')[0] : // Extract date part only
        new Date().toISOString().split('T')[0];
      
      // Skip invalid entries
      if (!firstName || !lastName || !email) {
        console.log(`Skipping invalid student data: missing name or email (${name}, ${email})`);
        return;
      }
      
      // Skip cmu.edu and andrew.cmu.edu emails
      if (email.toLowerCase().endsWith('andrew.cmu.edu') || 
          email.toLowerCase().endsWith('cmu.edu')) {
        console.log(`Skipping CMU student: ${name}, ${email}`);
        return;
      }
      
      // Create a key using email
      const key = email.toLowerCase();
      const fullName = `${firstName} ${lastName}`;
      const normalizedName = normalizeNameForComparison(fullName);
      
      if (!studentMap[key]) {
        studentMap[key] = {
          id: `student-${studentIdCounter++}`,
          firstName,
          lastName,
          fullName,
          normalizedName,
          email,
          score: 0, // Will be calculated from quiz scores
          quizScores: [],
          courseCompleted: true, // Default to true
          enrollmentDate: new Date().toISOString().split('T')[0], // Default to today
          lastActivityDate,
          courseName: studentFile.courseName
        };
        console.log(`Added student: ${fullName} (${email}) for course ${studentFile.courseName}`);
      }
    });
  });
  
  // Process quiz files
  quizFiles.forEach(quizFile => {
    console.log(`Processing quiz file for course: ${quizFile.courseName} with ${quizFile.data.length} entries`);
    
    // Log all the headers to understand the structure
    if (quizFile.data.length > 0) {
      console.log(`Quiz file headers for ${quizFile.courseName}:`, Object.keys(quizFile.data[0]));
    }
    
    quizFile.data.forEach(quizData => {
      // Find the student name field (could be 'student' or other variations)
      let studentField = 'student';
      if (!quizData.student && quizData.name) {
        studentField = 'name';
      }
      
      const name = quizData[studentField] || '';
      console.log(`Processing quiz scores for student: "${name}"`);
      
      // Skip empty names
      if (!name || name.trim() === '') {
        console.log(`Skipping empty student name in quiz data`);
        return;
      }
      
      // Extract first and last names based on common formats
      let firstName = '', lastName = '';
      
      // Try to detect name format
      if (name.includes(',')) {
        // Likely "Last, First" format
        const { firstName: parsedFirst, lastName: parsedLast } = parseStudentName(name, true);
        firstName = parsedFirst;
        lastName = parsedLast;
      } else {
        // Likely "First Last" format
        const { firstName: parsedFirst, lastName: parsedLast } = parseStudentName(name, false);
        firstName = parsedFirst;
        lastName = parsedLast;
      }
      
      const fullName = `${firstName} ${lastName}`;
      const reversedFullName = `${lastName}, ${firstName}`;
      
      // Normalize names for better matching
      const normalizedFullName = normalizeNameForComparison(fullName);
      const normalizedReversedName = normalizeNameForComparison(reversedFullName);
      const normalizedOriginalName = normalizeNameForComparison(name);
      
      console.log(`Looking for match for: "${name}" (normalized: ${normalizedOriginalName})`);
      console.log(`Alternative formats: "${fullName}" (${normalizedFullName}) or "${reversedFullName}" (${normalizedReversedName})`);
      
      // Find corresponding student by matching name
      let matchedStudent = null;
      
      // Try to find student by different name formats
      for (const key in studentMap) {
        const student = studentMap[key];
        const studentNormalizedName = student.normalizedName;
        
        // Try multiple formats to match
        if (studentNormalizedName === normalizedFullName || 
            studentNormalizedName === normalizedReversedName ||
            normalizeNameForComparison(student.lastName + student.firstName) === normalizedOriginalName ||
            normalizeNameForComparison(student.fullName) === normalizedOriginalName ||
            // Additional matching criteria
            normalizedOriginalName.includes(normalizeNameForComparison(student.firstName)) && 
            normalizedOriginalName.includes(normalizeNameForComparison(student.lastName))) {
          matchedStudent = student;
          console.log(`Found match: ${student.fullName} (${student.email})`);
          break;
        }
      }
      
      if (matchedStudent) {
        // Extract all keys from quiz data except the student name field
        // All other fields are considered quiz scores
        const quizKeys = Object.keys(quizData).filter(key => key !== studentField);
        console.log(`${name} has ${quizKeys.length} quiz scores to process`);
        
        // DEBUG: Print all quiz scores for this student
        quizKeys.forEach(key => {
          console.log(`DEBUG: Quiz "${key}" - Raw value: "${quizData[key]}"`);
        });
        
        if (quizKeys.length === 0) {
          console.log(`WARNING: No quiz scores found for ${name}`);
        }
        
        // Reset quiz scores to make sure we don't duplicate
        matchedStudent.quizScores = [];
        let validScoreCount = 0;
        let totalScore = 0;
        
        quizKeys.forEach(key => {
          // Get the original value before parsing
          const originalValue = quizData[key];
          console.log(`Quiz "${key}" - Original value: "${originalValue}"`);
          
          // Convert quiz score to number with improved parsing
          const scoreValue = parseScoreValue(originalValue);
          console.log(`Quiz "${key}" - Parsed score: ${scoreValue}`);
          
          // Only count scores > 0 for average calculation
          if (scoreValue > 0) {
            validScoreCount++;
            totalScore += scoreValue;
            console.log(`Added valid score: ${scoreValue} to total (now ${totalScore})`);
          }
          
          matchedStudent.quizScores.push({
            quizName: key,
            score: scoreValue
          });
        });
        
        // Calculate average score only if there are valid scores
        if (validScoreCount > 0) {
          matchedStudent.score = totalScore / validScoreCount;
          console.log(`Calculated average score for ${matchedStudent.fullName}: ${matchedStudent.score.toFixed(1)}% (from ${validScoreCount} valid scores, total: ${totalScore})`);
        } else {
          matchedStudent.score = 0;
          console.log(`No valid scores for ${matchedStudent.fullName}, setting average to 0`);
        }
        
        // DEBUG: Print the final quiz scores and average
        console.log(`DEBUG: Final quiz scores for ${matchedStudent.fullName}:`, matchedStudent.quizScores);
        console.log(`DEBUG: Final average score: ${matchedStudent.score}`);
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
    } else {
      console.log(`Skipping invalid student: ${student.fullName}`);
    }
  }
  
  console.log(`Total students processed: ${students.length}`);
  if (students.length > 0) {
    console.log(`First 3 students:`, students.slice(0, 3).map(s => ({
      name: s.fullName,
      score: s.score,
      quizCount: s.quizScores.length,
      quizScores: s.quizScores.map(q => ({ name: q.quizName, score: q.score }))
    })));
  }
  
  console.log("=== FINISHED STUDENT AND QUIZ DATA COMBINATION ===");
  return students;
};

export const parseCSVData = (filename: string, csvContent: string): ParsedFile => {
  console.log(`Parsing file: ${filename}`);
  
  // Handle tab-delimited files (common in CSV exports)
  if (csvContent.includes('\t') && !csvContent.includes(',')) {
    console.log('Detected tab-delimited file, converting to CSV format');
    csvContent = csvContent.split('\n').map(line => line.replace(/\t/g, ',')).join('\n');
  }
  
  const result = parseFileContent(filename, csvContent);
  
  if (result.type === 'quiz' && result.data.length > 0) {
    console.log(`Quiz file detected. Sample row headers:`, Object.keys(result.data[0]));
    
    // Sample the first quiz entry to check if we're correctly parsing quiz scores
    const firstEntry = result.data[0];
    // All fields except 'student' are considered quiz names with scores
    const quizKeys = Object.keys(firstEntry).filter(key => key !== 'student' && key !== 'name');
    
    console.log(`Found ${quizKeys.length} potential quiz columns`);
    
    // Log a sample of the quiz data to verify parsing
    quizKeys.forEach(key => {
      const originalValue = firstEntry[key];
      const parsedValue = parseScoreValue(originalValue);
      console.log(`Quiz "${key}": Original="${originalValue}", Parsed=${parsedValue}`);
    });
  }
  
  return result;
};
