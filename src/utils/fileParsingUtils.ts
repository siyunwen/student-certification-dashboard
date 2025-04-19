
import { ParsedFile } from '../types/student';
import { parseCSVRow, extractCourseName, parseName } from './fileUtils';

// Parse CSV data from file content
export function parseCSVData(filename: string, content: string): ParsedFile {
  console.log(`Parsing file: ${filename}`);
  
  // Split content into lines and filter out empty lines
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  console.log(`File has ${lines.length} non-empty lines`);
  
  if (lines.length < 2) {
    console.error(`File ${filename} has insufficient data (needs at least header and one data row)`);
    throw new Error(`File ${filename} has insufficient data (needs at least header and one data row)`);
  }
  
  // Parse headers (first line)
  const headers = parseCSVRow(lines[0]);
  console.log(`Headers: ${headers.join(', ')}`);
  
  // Extract course name from filename
  const courseName = extractCourseName(filename);
  console.log(`Extracted course name: ${courseName}`);
  
  // Determine file type based on filename and headers
  const isQuizFile = filename.toLowerCase().includes('quiz_scores') || 
                     headers.some(h => h.toLowerCase() === 'student_family_name');
  
  const fileType = isQuizFile ? 'quiz' : 'student';
  console.log(`Detected file type: ${fileType}`);
  
  // Parse file based on its type
  if (fileType === 'student') {
    return parseStudentFile(courseName, headers, lines);
  } else {
    return parseQuizFile(courseName, headers, lines);
  }
}

// Parse a student data file with specific column format
function parseStudentFile(courseName: string, headers: string[], lines: string[]): ParsedFile {
  console.log('Parsing student file with headers:', headers);
  
  // Find key column indices based on expected format
  const nameIndex = headers.findIndex(h => 
    h.toLowerCase() === 'name' || 
    h.toLowerCase().includes('student name')
  );
  
  const emailIndex = headers.findIndex(h => 
    h.toLowerCase() === 'email' || 
    h.toLowerCase().includes('email')
  );
  
  const lastInteractionIndex = headers.findIndex(h => 
    h.toLowerCase() === 'last_interaction' || 
    h.toLowerCase().includes('last interaction') ||
    h.toLowerCase().includes('last_activity')
  );
  
  if (nameIndex === -1 || emailIndex === -1) {
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
    
    let fullName = rowData[nameIndex] || '';
    
    // Parse name into first and last name
    const { firstName, lastName } = parseName(fullName);
    console.log(`Parsed name: "${fullName}" -> firstName: "${firstName}", lastName: "${lastName}"`);
    
    // Extract email
    let email = rowData[emailIndex] || '';
    
    // Skip CMU emails immediately
    if (email.toLowerCase().includes('@andrew.cmu.edu') || email.toLowerCase().includes('@cmu.edu')) {
      console.log(`Skipping CMU student: ${fullName}, ${email}`);
      continue;
    }
    
    // Skip if both name parts and email are missing or 'Unknown'
    if ((firstName === 'Unknown' && lastName === 'Unknown') && !email) {
      console.log(`Skipping record with missing data: name=${fullName}, email=${email}`);
      continue;
    }
    
    // Extract date from last_interaction (YYYY-MM-DD format)
    let lastActivityDate = '';
    if (lastInteractionIndex !== -1 && rowData.length > lastInteractionIndex) {
      const dateValue = rowData[lastInteractionIndex] || '';
      // Extract date part in YYYY-MM-DD format
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

// Parse a quiz data file with specific column format
function parseQuizFile(courseName: string, headers: string[], lines: string[]): ParsedFile {
  // Find the key column indices based on the new format
  const familyNameIndex = headers.findIndex(h => h === 'student_family_name');
  const givenNameIndex = headers.findIndex(h => h === 'student_given_name');
  const emailIndex = headers.findIndex(h => h === 'student_email');
  
  if (familyNameIndex === -1 || givenNameIndex === -1) {
    throw new Error('Quiz file is missing required student name columns');
  }
  
  // Find all quiz columns (all columns after the student info columns are quiz scores)
  const quizIndices = headers
    .map((header, index) => {
      // Skip the student info columns
      if (index <= Math.max(familyNameIndex, givenNameIndex, emailIndex)) {
        return null;
      }
      if (header.trim() !== '') {
        return { index, quizName: header };
      }
      return null;
    })
    .filter(item => item !== null) as { index: number; quizName: string }[];
  
  console.log(`Quiz columns detected: ${quizIndices.map(q => q.quizName).join(', ')}`);
  
  const data = [];
  
  // Process each line (skipping header)
  for (let i = 1; i < lines.length; i++) {
    const rowData = parseCSVRow(lines[i]);
    if (rowData.length <= Math.max(familyNameIndex, givenNameIndex)) continue;
    
    const lastName = rowData[familyNameIndex]?.trim() || '';
    const firstName = rowData[givenNameIndex]?.trim() || '';
    const email = emailIndex !== -1 ? rowData[emailIndex]?.trim() : '';
    
    // Skip if both name parts are missing
    if (!lastName && !firstName) {
      console.log(`Skipping quiz record with missing student name`);
      continue;
    }
    
    // Process each quiz score for this student
    for (const quizItem of quizIndices) {
      if (rowData.length <= quizItem.index) continue;
      
      const scoreValue = rowData[quizItem.index] || '';
      
      // Add debug logging for score values
      console.log(`Raw score for ${firstName} ${lastName}, quiz "${quizItem.quizName}": "${scoreValue}"`);
      
      if (isNotCompletedQuiz(scoreValue)) {
        data.push({
          firstName,
          lastName,
          email,
          quizName: quizItem.quizName,
          score: null,
          completedAt: new Date().toISOString().split('T')[0]
        });
        continue;
      }
      
      // Parse the score value to a number (percentage)
      const score = parseScoreValue(scoreValue);
      console.log(`Parsed score: ${score}%`);
      
      data.push({
        firstName,
        lastName,
        email,
        quizName: quizItem.quizName,
        score,
        completedAt: new Date().toISOString().split('T')[0]
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

// Import required functions from other utils
import { isNotCompletedQuiz, parseScoreValue } from './scoreUtils';
