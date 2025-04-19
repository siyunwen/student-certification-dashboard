import { Student, CertificationSettings, CertificationStats, ParsedFile, CourseData } from '../types/student';
import { normalizeScore, isNotCompletedQuiz, parseScoreValue, hasCompletedAllQuizzes, getRequiredQuizCount } from './scoreUtils';
import { getAllCoursesInSeries } from './courseUtils';
import { extractCourseName, parseName, parseCSVData, parseCSVRow } from './fileUtils';

// Calculate certification statistics for students
export function calculateCertificationStats(
  students: Student[],
  settings: CertificationSettings
): CertificationStats {
  console.log("calculateCertificationStats: Starting with", students.length, "students");
  // Filter out students based on date if needed
  const filteredStudents = settings.dateSince
    ? students.filter(student => {
        if (!student.lastActivityDate) return false;
        // Convert both dates to Date objects and compare only the date parts
        const activityDate = new Date(student.lastActivityDate);
        const filterDate = new Date(settings.dateSince);
        
        // Reset time parts to compare only dates
        activityDate.setHours(0, 0, 0, 0);
        filterDate.setHours(0, 0, 0, 0);
        
        console.log(`Comparing dates for ${student.firstName} ${student.lastName}: Activity date ${activityDate.toISOString().split('T')[0]} >= Filter date ${filterDate.toISOString().split('T')[0]}`);
        return activityDate >= filterDate;
      })
    : students;

  console.log(`Date filtering: Total students ${students.length}, filtered to ${filteredStudents.length}`);

  const totalStudents = filteredStudents.length;
  const eligibleStudents = getEligibleStudents(filteredStudents, settings).length;
  
  // Calculate average score and pass rate
  const totalScore = filteredStudents.reduce((sum, student) => sum + (student.score || 0), 0);
  const averageScore = totalStudents > 0 ? totalScore / totalStudents : 0;
  const passRate = totalStudents > 0 ? (eligibleStudents / totalStudents) * 100 : 0;
  
  // Calculate course-specific average scores
  const coursePrefixes = detectCoursePrefixesFromStudents(filteredStudents);
  const courseAverages = coursePrefixes.map(prefix => {
    const courseStudents = filteredStudents.filter(s => s.courseName && s.courseName.startsWith(prefix));
    const courseTotal = courseStudents.reduce((sum, s) => sum + (s.score || 0), 0);
    const courseAvg = courseStudents.length > 0 ? courseTotal / courseStudents.length : 0;
    
    return {
      coursePrefix: prefix,
      avgScore: courseAvg
    };
  });
  
  return {
    totalStudents,
    eligibleStudents,
    averageScore,
    passRate,
    courseAverages
  };
}

// Get students eligible for certification - updated to handle incomplete course series
export function getEligibleStudents(
  students: Student[],
  settings: CertificationSettings
): Student[] {
  // Filter by date if needed
  const filteredByDate = settings.dateSince
    ? students.filter(student => {
        if (!student.lastActivityDate) return false;
        const activityDate = new Date(student.lastActivityDate);
        const filterDate = new Date(settings.dateSince);
        
        // Reset time parts to compare only dates
        activityDate.setHours(0, 0, 0, 0);
        filterDate.setHours(0, 0, 0, 0);
        
        return activityDate >= filterDate;
      })
    : students;
  
  // Get all available course names first
  const allAvailableCourses = Array.from(
    new Set(filteredByDate.map(s => s.courseName).filter(Boolean))
  ) as string[];
  
  // Group students by email to check across all their courses
  const studentsByEmail = filteredByDate.reduce((groups: Record<string, Student[]>, student) => {
    if (!student.email) return groups;
    
    const email = student.email.toLowerCase().trim();
    if (!groups[email]) {
      groups[email] = [];
    }
    
    groups[email].push(student);
    return groups;
  }, {});
  
  const eligibleStudents: Student[] = [];
  
  Object.entries(studentsByEmail).forEach(([email, studentRecords]) => {
    console.log(`\nEvaluating eligibility for student ${email} with ${studentRecords.length} course records`);
    
    // If student only has one course record
    if (studentRecords.length === 1) {
      const student = studentRecords[0];
      // Single course: Must complete and pass
      if (student.score >= settings.passThreshold && student.courseCompleted) {
        console.log(`Student ${email} passed single course ${student.courseName} with score ${student.score}`);
        eligibleStudents.push(student);
      } else {
        console.log(`Student ${email} failed single course ${student.courseName} with score ${student.score}, completed: ${student.courseCompleted}`);
      }
      return;
    }
    
    // For multiple courses: 
    // 1. Group courses by their series prefix (e.g., "aifi_" for "aifi_301", "aifi_302")
    const coursesBySeries: Record<string, Student[]> = {};
    const enrolledCourses: string[] = [];
    
    // Find all the course series this student is enrolled in
    studentRecords.forEach(record => {
      if (!record.courseName) return;
      
      // Extract course series prefix (e.g., "aifi_" from "aifi_301")
      const match = record.courseName.match(/^([a-zA-Z]+_)/);
      const seriesPrefix = match ? match[1] : record.courseName; // Use full name if no prefix pattern found
      
      if (!coursesBySeries[seriesPrefix]) {
        coursesBySeries[seriesPrefix] = [];
      }
      
      coursesBySeries[seriesPrefix].push(record);
      enrolledCourses.push(record.courseName);
    });
    
    // 2. Check that student passed EVERY course within EACH series AND has enrolled in ALL available courses for EACH series
    let allSeriesPassed = true;
    
    Object.entries(coursesBySeries).forEach(([seriesPrefix, seriesRecords]) => {
      // Get all available courses for this series from the system
      const allCoursesInSeries = getAllCoursesInSeries(allAvailableCourses, seriesPrefix);
      console.log(`Student ${email}: Series ${seriesPrefix} - Enrolled in ${seriesRecords.length}/${allCoursesInSeries.length} courses`);
      
      // Get the enrolled course names for this series
      const enrolledCourseNames = seriesRecords.map(r => r.courseName).filter(Boolean) as string[];
      
      // Check if the student is enrolled in all courses in the series
      const isEnrolledInAllCourses = allCoursesInSeries.every(courseName => 
        enrolledCourseNames.includes(courseName)
      );
      
      // For this particular series, check if ALL courses were passed and completed
      const seriesPassed = seriesRecords.every(record => 
        record.score >= settings.passThreshold && record.courseCompleted
      );
      
      // Student must have passed all courses AND be enrolled in all courses for the series
      if (!seriesPassed || !isEnrolledInAllCourses) {
        allSeriesPassed = false;
        console.log(`Student ${email} failed series ${seriesPrefix}: passed all=${seriesPassed}, enrolled in all=${isEnrolledInAllCourses}`);
        if (!isEnrolledInAllCourses) {
          console.log(`  Missing courses: ${allCoursesInSeries.filter(c => !enrolledCourseNames.includes(c)).join(', ')}`);
        }
        if (!seriesPassed) {
          const failedCourses = seriesRecords.filter(r => r.score < settings.passThreshold || !r.courseCompleted);
          console.log(`  Failed courses: ${failedCourses.map(c => `${c.courseName}(${c.score}%)`).join(', ')}`);
        }
      }
    });
    
    // Only if the student passed ALL courses in ALL series they're eligible
    if (allSeriesPassed) {
      console.log(`Student ${email} passed all course series`);
      // Calculate average score across all courses
      const averageScore = studentRecords.reduce((sum, record) => sum + (record.score || 0), 0) / studentRecords.length;
      
      // Use the first record but attach the combined course info
      const representativeRecord = {...studentRecords[0]};
      representativeRecord.score = averageScore;
      representativeRecord.allCourses = enrolledCourses;
      eligibleStudents.push(representativeRecord);
    }
  });
  
  console.log(`Eligible students after requiring all courses passed in each series: ${eligibleStudents.length}`);
  return eligibleStudents;
}

// Helper function to detect course prefixes from student objects
function detectCoursePrefixesFromStudents(students: Student[]): string[] {
  const courseNames = students.map(student => student.courseName).filter(Boolean) as string[];
  return detectCoursePrefixesFromNames(courseNames);
}

// Helper function to detect course prefixes for merging from ParsedFile objects
function detectCoursePrefixes(files: ParsedFile[]): string[] {
  const courseNames = files.map(file => file.courseName).filter(Boolean) as string[];
  return detectCoursePrefixesFromNames(courseNames);
}

// Common function to detect course prefixes from an array of course names
function detectCoursePrefixesFromNames(courseNames: string[]): string[] {
  const prefixMap: Record<string, number> = {};
  
  // Updated to consider just the first 4 characters (e.g., "aifi" from "aifi_301")
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

// Helper function to get the course prefix for a file
function getCoursePrefixForFile(courseName: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (courseName.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}

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
