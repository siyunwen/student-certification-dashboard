import { Student, CertificationSettings, CertificationStats, ParsedFile, CourseData } from '../types/student';
import { normalizeScore, isNotCompletedQuiz, parseScoreValue } from './scoreUtils';

export const isEligibleForCertification = (
  student: Student,
  settings: CertificationSettings
): boolean => {
  // Ensure both score and threshold are in percentage format (0-100)
  const studentScore = normalizeScore(student.score, true);
  const passThreshold = normalizeScore(settings.passThreshold, true);
  
  // Check if student passed the threshold
  const passedThreshold = studentScore >= passThreshold;
  
  // Check if student completed the course
  const completedCourse = student.courseCompleted;
  
  // Check if student activity is after the dateSince filter
  let meetsDateRequirement = true;
  
  if (settings.dateSince) {
    const studentDate = new Date(student.lastActivityDate);
    const filterDate = new Date(settings.dateSince);
    meetsDateRequirement = studentDate >= filterDate;
    
    console.log(`Date filter check for ${student.fullName}:
      Student date: ${studentDate.toISOString().split('T')[0]}
      Filter date: ${filterDate.toISOString().split('T')[0]}
      Result: ${meetsDateRequirement}
    `);
  }
  
  console.log(`Student ${student.fullName} eligibility check:
    - Score ${studentScore.toFixed(1)}% >= ${passThreshold}%: ${passedThreshold}
    - Course completed: ${completedCourse}
    - Active since ${settings.dateSince || 'any date'}: ${meetsDateRequirement}
    - Last activity: ${student.lastActivityDate}
  `);
  
  return passedThreshold && completedCourse && meetsDateRequirement;
};

export const getEligibleStudents = (
  students: Student[],
  settings: CertificationSettings
): Student[] => {
  const eligible = students.filter(student => isEligibleForCertification(student, settings));
  
  // Add diagnostics for troubleshooting
  if (eligible.length === 0 && students.length > 0) {
    console.log("WARNING: No eligible students found. Checking what's causing the issue...");
    
    const scoreIssues = students.filter(s => s.score < settings.passThreshold).length;
    const completionIssues = students.filter(s => !s.courseCompleted).length;
    
    console.log(`Students failing score requirement: ${scoreIssues}`);
    console.log(`Students failing completion requirement: ${completionIssues}`);
    console.log("Sample student scores:", students.slice(0, 3).map(s => s.score));
  }
  
  return eligible;
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
  // Remove file extension
  let name = filename.replace(/\.(csv|txt|xlsx|xls)$/i, '');
  
  // Check for common suffixes that indicate file type
  const studentPattern = /_students$/i;
  const quizPattern = /_quiz_scores$/i;
  
  // Remove the suffix patterns
  name = name.replace(studentPattern, '').replace(quizPattern, '');
  
  // Clean up any remaining underscores at the end
  name = name.replace(/_+$/, '');
  
  console.log(`Extracted course name "${name}" from filename "${filename}"`);
  return name;
};

export const parseFileContent = (filename: string, content: string): ParsedFile => {
  const lines = content.trim().split('\n');
  if (lines.length <= 1) {
    return { type: 'student', courseName: '', data: [] };
  }
  
  // Handle CSV with quoted fields
  const hasQuotes = lines[0].includes('"');
  
  let headers: string[];
  if (hasQuotes) {
    // Handle CSV with quoted fields - more complex parsing
    headers = parseCSVLine(lines[0]);
  } else {
    // Simple CSV parsing
    headers = lines[0].split(',').map(h => h.trim());
  }
  
  // Determine file type based on the headers or filename
  const isQuizFile = filename.toLowerCase().includes('quiz') || 
                    headers.includes('student') || 
                    headers.some(h => h.toLowerCase().includes('quiz'));
  const type = isQuizFile ? 'quiz' : 'student';
  
  // Extract course name from filename
  const courseName = extractCourseNameFromFilename(filename);
  
  console.log(`Parsing ${type} file: ${filename} with ${lines.length} lines`);
  console.log(`Headers found: ${headers.join(', ')}`);
  
  // Parse data based on file type
  const data = lines.slice(1).map(line => {
    const values = hasQuotes ? parseCSVLine(line) : line.split(',').map(v => v.trim());
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let currentValue = '';
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  // Add the last value
  result.push(currentValue);
  return result;
}

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
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || ''
    };
  }
};

export const isValidStudent = (student: any): boolean => {
  // Check if student has name and email
  if (!student.firstName || !student.email) {
    console.log(`Filtering out invalid student: missing firstName or email`, student);
    return false;
  }
  
  // Filter out andrew.cmu.edu and cmu.edu emails - This filter MUST work correctly
  const email = student.email.toLowerCase();
  if (email.includes('@andrew.cmu.edu') || email.includes('@cmu.edu')) {
    console.log(`Filtering out CMU student email: ${email}`);
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
      
      // Extract email - critical for filtering out CMU emails
      const email = studentData.email || '';
      
      // Early check for CMU emails - immediately skip these students
      if (email.toLowerCase().includes('@andrew.cmu.edu') || email.toLowerCase().includes('@cmu.edu')) {
        console.log(`Skipping CMU student: ${name}, ${email}`);
        return;
      }
      
      // Detect name format - in student files, it's usually "First Last" format
      const { firstName, lastName } = parseStudentName(name, false);
      
      console.log(`Parsed name: firstName="${firstName}", lastName="${lastName}", email="${email}"`);
      
      // Skip invalid entries
      if (!firstName || !email) {
        console.log(`Skipping invalid student data: missing firstName or email (${name}, ${email})`);
        return;
      }
      
      const lastActivityDate = studentData.last_interaction ? 
        studentData.last_interaction.split(' ')[0] : // Extract date part only
        new Date().toISOString().split('T')[0];
      
      // Create a key using email
      const key = email.toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
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
          courseCompleted: false, // Default to false until we verify completion
          enrollmentDate: new Date().toISOString().split('T')[0], // Default to today
          lastActivityDate,
          courseName: studentFile.courseName
        };
        console.log(`Added student: ${fullName} (${email}) for course ${studentFile.courseName}`);
      }
    });
  });
  
  // Create email map for more reliable matching
  const emailMap: Record<string, any> = {};
  for (const key in studentMap) {
    const student = studentMap[key];
    // Double check we're not adding CMU emails
    if (student.email.toLowerCase().includes('@andrew.cmu.edu') || 
        student.email.toLowerCase().includes('@cmu.edu')) {
      console.log(`Skipping CMU email in emailMap: ${student.email}`);
      continue;
    }
    emailMap[student.email.toLowerCase()] = student;
  }
  
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
      
      // Check for email-based matching first
      if (quizData.email) {
        const email = quizData.email.toLowerCase();
        
        // Skip CMU emails in quiz data too
        if (email.includes('@andrew.cmu.edu') || email.includes('@cmu.edu')) {
          console.log(`Skipping CMU student in quiz data: ${email}`);
          return;
        }
        
        // Try to find direct email match
        if (emailMap[email]) {
          const student = emailMap[email];
          console.log(`Found email match for ${email}`);
          
          // Only process if course names match
          if (student.courseName === quizFile.courseName) {
            processQuizScores(student, quizData, studentField, quizFile.courseName);
          } else {
            console.log(`Skipping - Course mismatch: student is in ${student.courseName}, quiz is for ${quizFile.courseName}`);
          }
          return;
        }
      }
      
      // If email matching failed, try name-based matching
      const name = quizData[studentField] || '';
      console.log(`Processing quiz scores for student: "${name}"`);
      
      // Skip empty names
      if (!name || name.trim() === '') {
        console.log(`Skipping empty student name in quiz data`);
        return;
      }
      
      // In quiz files, names are usually in "Last, First" format
      const { firstName, lastName } = parseStudentName(name, true);
      
      const fullName = `${firstName} ${lastName}`.trim();
      const reversedFullName = lastName ? `${lastName}, ${firstName}` : firstName;
      
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
        
        // Skip if course doesn't match
        if (student.courseName !== quizFile.courseName) {
          continue;
        }
        
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
        processQuizScores(matchedStudent, quizData, studentField, quizFile.courseName);
      } else {
        console.log(`No matching student found for: ${name}`);
      }
    });
  });
  
  // Helper function to process quiz scores for a student
  function processQuizScores(student: any, quizData: any, studentField: string, courseName: string) {
    // Skip if course mismatch
    if (student.courseName !== courseName) {
      console.log(`Skipping - Course mismatch: student is in ${student.courseName}, quiz is for ${courseName}`);
      return;
    }
    
    // Extract all keys from quiz data except the student name field and special fields
    const quizKeys = Object.keys(quizData).filter(key => 
      key !== studentField && 
      key !== 'overall_proficiency' && 
      key !== 'email' &&
      key !== 'name' &&
      key !== 'student'
    );
    
    console.log(`${student.fullName} has ${quizKeys.length} quiz scores to process`);
    
    // DEBUG: Print all quiz scores for this student
    quizKeys.forEach(key => {
      console.log(`DEBUG: Quiz "${key}" - Raw value: "${quizData[key]}"`);
    });
    
    if (quizKeys.length === 0) {
      console.log(`WARNING: No quiz scores found for ${student.fullName}`);
    }
    
    // Reset quiz scores to make sure we don't duplicate
    student.quizScores = [];
    let validScoreCount = 0;
    let totalScore = 0;
    let allQuizzesCompleted = true;
    
    quizKeys.forEach(key => {
      // Get the original value before parsing
      const originalValue = quizData[key];
      console.log(`Quiz "${key}" - Original value: "${originalValue}"`);
      
      // Check if quiz is not completed
      const isCompleted = !isNotCompletedQuiz(originalValue);
      if (!isCompleted) {
        allQuizzesCompleted = false;
        console.log(`Quiz "${key}" is marked as not completed`);
      }
      
      // Convert quiz score to number with improved parsing
      const scoreValue = parseScoreValue(originalValue);
      console.log(`Quiz "${key}" - Parsed score: ${scoreValue}`);
      
      // Only count scores > 0 for average calculation
      if (scoreValue > 0) {
        validScoreCount++;
        totalScore += scoreValue;
        console.log(`Added valid score: ${scoreValue} to total (now ${totalScore})`);
      }
      
      student.quizScores.push({
        quizName: key,
        score: scoreValue
      });
    });
    
    // Calculate average score only if there are valid scores
    if (validScoreCount > 0) {
      student.score = totalScore / validScoreCount;
      console.log(`Calculated average score for ${student.fullName}: ${student.score.toFixed(1)}% (from ${validScoreCount} valid scores, total: ${totalScore})`);
    } else {
      student.score = 0;
      console.log(`No valid scores for ${student.fullName}, setting average to 0`);
    }
    
    // Mark student as having completed the course if all quizzes are completed
    student.courseCompleted = allQuizzesCompleted && validScoreCount > 0;
    console.log(`Course completion status for ${student.fullName}: ${student.courseCompleted ? 'Completed' : 'Not completed'}`);
    
    // Enhanced debugging
    console.log(`
    Student: ${student.fullName} (${student.email})
    Course: ${student.courseName}
    Score: ${student.score.toFixed(1)}%
    Course Completed: ${student.courseCompleted}
    Valid Quiz Scores: ${validScoreCount}
    All Quizzes Completed: ${allQuizzesCompleted}
    `);
  }
  
  // Convert map to array and ensure all students are valid
  for (const key in studentMap) {
    const student = studentMap[key];
    
    // Double-check we're not including CMU emails
    if (student.email.toLowerCase().includes('@andrew.cmu.edu') || 
        student.email.toLowerCase().includes('@cmu.edu')) {
      console.log(`Filtering out CMU student before final list: ${student.fullName} (${student.email})`);
      continue;
    }
    
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
      email: s.email,
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
    const quizKeys = Object.keys(firstEntry).filter(key => 
      key !== 'student' && 
      key !== 'name' && 
      key !== 'overall_proficiency' &&
      key !== 'email'
    );
    
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
