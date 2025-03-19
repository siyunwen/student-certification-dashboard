import { Student, CertificationSettings, CertificationStats, ParsedFile, CourseData } from '../types/student';
import { normalizeScore, isNotCompletedQuiz, parseScoreValue } from './scoreUtils';

// Calculate certification statistics for students
export function calculateCertificationStats(
  students: Student[],
  settings: CertificationSettings
): CertificationStats {
  // Filter out students based on date if needed
  const filteredStudents = settings.dateSince
    ? students.filter(student => new Date(student.lastActivityDate) >= new Date(settings.dateSince))
    : students;

  const totalStudents = filteredStudents.length;
  const eligibleStudents = getEligibleStudents(filteredStudents, settings).length;
  
  // Calculate average score and pass rate
  const totalScore = filteredStudents.reduce((sum, student) => sum + student.score, 0);
  const averageScore = totalStudents > 0 ? totalScore / totalStudents : 0;
  const passRate = totalStudents > 0 ? (eligibleStudents / totalStudents) * 100 : 0;
  
  return {
    totalStudents,
    eligibleStudents,
    averageScore,
    passRate
  };
}

// Get students eligible for certification
export function getEligibleStudents(
  students: Student[],
  settings: CertificationSettings
): Student[] {
  // Filter by date if needed
  const filteredStudents = settings.dateSince
    ? students.filter(student => new Date(student.lastActivityDate) >= new Date(settings.dateSince))
    : students;
  
  // Filter by passing threshold
  return filteredStudents.filter(student => 
    student.score >= settings.passThreshold && student.courseCompleted
  );
}

// Group files by course and check if each course has both student and quiz files
export function groupFilesByCourse(files: ParsedFile[]): Record<string, CourseData> {
  const courseMap: Record<string, CourseData> = {};
  
  files.forEach(file => {
    if (!file.courseName) return;
    
    // Trim course name to ensure consistency
    const courseName = file.courseName.trim();
    
    if (!courseMap[courseName]) {
      courseMap[courseName] = {
        isComplete: false,
        studentFile: undefined,
        quizFile: undefined
      };
    }
    
    if (file.type === 'student') {
      courseMap[courseName].studentFile = file;
    } else if (file.type === 'quiz') {
      courseMap[courseName].quizFile = file;
    }
    
    // Update complete status
    courseMap[courseName].isComplete = 
      courseMap[courseName].studentFile !== undefined && 
      courseMap[courseName].quizFile !== undefined;
  });
  
  return courseMap;
}

// Extract course name from file name
export function extractCourseName(filename: string): string {
  // Remove file extension
  const nameWithoutExt = filename.split('.')[0];
  
  // For files ending with _quiz_scores or _students, extract the part before that
  if (nameWithoutExt.includes('_quiz_scores')) {
    return nameWithoutExt.split('_quiz_scores')[0];
  }
  
  if (nameWithoutExt.includes('_students')) {
    return nameWithoutExt.split('_students')[0];
  }
  
  // If no pattern matches, return original name without extension
  return nameWithoutExt;
}

// Parse name from a string (handles multiple formats)
export function parseName(name: string): { firstName: string; lastName: string } {
  if (!name || typeof name !== 'string' || name.trim() === '') {
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
    const firstName = parts[0] || 'Unknown';
    const lastName = parts.slice(1).join(' ') || 'Unknown'; // All remaining parts form the last name
    return { firstName, lastName };
  } 
  // Just a single name
  else {
    return { firstName: name, lastName: 'Unknown' };
  }
}

// Parse CSV data from file content - This was missing and caused a build error
export function parseCSVData(filename: string, content: string): ParsedFile {
  console.log(`Parsing file: ${filename}`);
  
  // Split content into lines and filter out empty lines
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error(`File ${filename} has insufficient data (needs at least header and one data row)`);
  }
  
  // Parse headers (first line)
  const headers = parseCSVRow(lines[0]);
  console.log(`Headers: ${headers.join(', ')}`);
  
  // Extract course name from filename
  const courseName = extractCourseName(filename);
  console.log(`Extracted course name: ${courseName}`);
  
  // Determine file type based on headers and content
  const hasQuizScores = headers.some(h => 
    h.toLowerCase().includes('quiz') || 
    h.toLowerCase().includes('score') || 
    h.toLowerCase().includes('grade')
  );
  
  const fileType = hasQuizScores ? 'quiz' : 'student';
  console.log(`Detected file type: ${fileType}`);
  
  // Parse file based on its type
  if (fileType === 'student') {
    return parseStudentFile(courseName, headers, lines);
  } else {
    return parseQuizFile(courseName, headers, lines);
  }
}

// Helper function to parse CSV row (handles quotes)
function parseCSVRow(row: string): string[] {
  const result = [];
  let inQuotes = false;
  let currentValue = '';
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  result.push(currentValue);
  return result;
}

// Parse a student data file
function parseStudentFile(courseName: string, headers: string[], lines: string[]): ParsedFile {
  console.log('Parsing student file with headers:', headers);
  
  const nameIndex = headers.findIndex(h => 
    h.toLowerCase() === 'name' || 
    h.toLowerCase().includes('student') || 
    h.toLowerCase().includes('name')
  );
  
  const emailIndex = headers.findIndex(h => 
    h.toLowerCase() === 'email' || 
    h.toLowerCase().includes('email') ||
    h.toLowerCase().includes('mail')
  );
  
  const dateIndex = headers.findIndex(h => 
    h.toLowerCase().includes('date') || 
    h.toLowerCase().includes('activity') ||
    h.toLowerCase().includes('interaction')
  );
  
  if (nameIndex === -1 && emailIndex === -1) {
    throw new Error(`Student file is missing required columns (name or email)`);
  }
  
  const data = [];
  
  // Process each line (skipping header)
  for (let i = 1; i < lines.length; i++) {
    const rowData = parseCSVRow(lines[i]);
    if (rowData.length <= Math.max(nameIndex, emailIndex)) {
      console.log(`Skipping row ${i} due to insufficient data:`, rowData);
      continue;
    }
    
    let fullName = '';
    if (nameIndex !== -1 && rowData.length > nameIndex) {
      fullName = rowData[nameIndex] || '';
    }
    
    // Parse name into first and last name
    const { firstName, lastName } = parseName(fullName);
    console.log(`Parsed name: "${fullName}" -> firstName: "${firstName}", lastName: "${lastName}"`);
    
    // Extract email
    let email = '';
    if (emailIndex !== -1 && rowData.length > emailIndex) {
      email = rowData[emailIndex] || '';
      
      // Skip CMU emails immediately
      if (email.toLowerCase().includes('@andrew.cmu.edu') || email.toLowerCase().includes('@cmu.edu')) {
        console.log(`Skipping CMU student: ${fullName}, ${email}`);
        continue;
      }
    }
    
    // Skip if both name parts and email are missing or 'Unknown'
    if ((firstName === 'Unknown' && lastName === 'Unknown') && !email) {
      console.log(`Skipping record with missing data: name=${fullName}, email=${email}`);
      continue;
    }
    
    let lastActivityDate = '';
    if (dateIndex !== -1 && rowData.length > dateIndex) {
      // Extract date part (assume format starts with YYYY-MM-DD)
      const dateValue = rowData[dateIndex] || '';
      const dateParts = dateValue.match(/\d{4}-\d{2}-\d{2}/);
      lastActivityDate = dateParts ? dateParts[0] : new Date().toISOString().split('T')[0];
    } else {
      lastActivityDate = new Date().toISOString().split('T')[0];
    }
    
    data.push({
      firstName,
      lastName,
      email,
      lastActivityDate,
      enrollmentDate: lastActivityDate // Use last activity as enrollment if not available
    });
  }
  
  console.log(`Parsed ${data.length} student records`);
  
  return {
    courseName,
    type: 'student',
    data
  };
}

// Parse a quiz data file
function parseQuizFile(courseName: string, headers: string[], lines: string[]): ParsedFile {
  const studentNameIndex = headers.findIndex(h => 
    h.toLowerCase() === 'student' || 
    h.toLowerCase().includes('name') || 
    h.toLowerCase().includes('student')
  );
  
  const emailIndex = headers.findIndex(h => 
    h.toLowerCase() === 'email' || 
    h.toLowerCase().includes('email') ||
    h.toLowerCase().includes('mail')
  );
  
  if (studentNameIndex === -1 && emailIndex === -1) {
    throw new Error(`Quiz file is missing required student identifier column`);
  }
  
  // Find all quiz columns (anything except student name/email)
  const quizIndices = headers.map((header, index) => {
    if (index !== studentNameIndex && index !== emailIndex && header.trim() !== '') {
      return { index, quizName: header };
    }
    return null;
  }).filter(item => item !== null) as { index: number; quizName: string }[];
  
  const data = [];
  
  // Process each line (skipping header)
  for (let i = 1; i < lines.length; i++) {
    const rowData = parseCSVRow(lines[i]);
    if (rowData.length <= Math.max(studentNameIndex, emailIndex)) continue;
    
    let email = '';
    if (emailIndex !== -1 && rowData.length > emailIndex) {
      email = rowData[emailIndex] || '';
      
      // Skip CMU emails immediately
      if (email.toLowerCase().includes('@andrew.cmu.edu') || email.toLowerCase().includes('@cmu.edu')) {
        console.log(`Skipping CMU student in quiz file: ${email}`);
        continue;
      }
    }
    
    let studentName = '';
    if (studentNameIndex !== -1 && rowData.length > studentNameIndex) {
      studentName = rowData[studentNameIndex] || '';
    }
    
    // Skip if both name and email are missing
    if (!studentName && !email) {
      console.log(`Skipping quiz record with missing student identifier`);
      continue;
    }
    
    // Process each quiz score for this student
    for (const quizItem of quizIndices) {
      if (rowData.length <= quizItem.index) continue;
      
      const scoreValue = rowData[quizItem.index] || '';
      if (isNotCompletedQuiz(scoreValue)) continue;
      
      // Parse the score value to a number
      const score = parseScoreValue(scoreValue);
      
      data.push({
        email,
        studentName,
        quizName: quizItem.quizName,
        score,
        completedAt: new Date().toISOString().split('T')[0] // Default to today
      });
    }
  }
  
  console.log(`Parsed ${data.length} quiz records`);
  
  return {
    courseName,
    type: 'quiz',
    data
  };
}
