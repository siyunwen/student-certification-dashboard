
import { Student, CertificationSettings, CertificationStats, ParsedFile, CourseData } from '../types/student';
import { normalizeScore, isNotCompletedQuiz, parseScoreValue, hasCompletedAllQuizzes, getRequiredQuizCount } from './scoreUtils';
import { getAllCoursesInSeries } from './courseUtils';
import { extractCourseName, parseName } from './fileUtils';

// HARD-CODED EXCLUSION LIST - Add any emails or names that should never be eligible
const EXCLUDED_STUDENTS = [
  'david.mpinzile@gmail.com',
  'mpinzile@teksafari.org',
  'david@teksafari.org',
  'davidmpinzile@gmail.com',
  'david.mpinzile',
  'mpinzile'
];

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

  // Get students eligible for certification based on the updated criteria
  const eligibleStudents = getEligibleStudents(filteredStudents, settings);
  console.log(`Found ${eligibleStudents.length} eligible students out of ${filteredStudents.length} filtered students`);
  
  const totalStudents = filteredStudents.length;
  
  // Calculate average score and pass rate
  const totalScore = filteredStudents.reduce((sum, student) => sum + (student.score || 0), 0);
  const averageScore = totalStudents > 0 ? totalScore / totalStudents : 0;
  const passRate = totalStudents > 0 ? (eligibleStudents.length / totalStudents) * 100 : 0;
  
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
    eligibleStudents: eligibleStudents.length,
    averageScore,
    passRate,
    courseAverages
  };
}

// Get students eligible for certification - improved to strictly validate course series enrollment
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
  
  console.log("All available courses:", allAvailableCourses);
  
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
  
  // Process each student (by email) to check eligibility across all their courses
  Object.entries(studentsByEmail).forEach(([email, studentRecords]) => {
    // Check EXCLUDED_STUDENTS list first - most basic check
    const isExcluded = EXCLUDED_STUDENTS.some(excluded => 
      email.toLowerCase().includes(excluded) ||
      studentRecords.some(s => 
        (s.firstName?.toLowerCase() || '').includes(excluded) ||
        (s.lastName?.toLowerCase() || '').includes(excluded) ||
        (s.fullName?.toLowerCase() || '').includes(excluded)
      )
    );
    
    if (isExcluded) {
      console.log(`⚠️ EXCLUDED STUDENT FOUND: ${email} matches exclusion list - skipping eligibility check`);
      return; // Skip to next student
    }
    
    // Debug: Add extra logging for identifying problematic students
    const isSpecialWatch = 
      email.includes("david") || 
      email.includes("mpinzile") ||
      studentRecords.some(s => 
        (s.firstName?.toLowerCase()?.includes("david") && s.lastName?.toLowerCase()?.includes("mpinzile")) || 
        (s.fullName?.toLowerCase()?.includes("david") && s.fullName?.toLowerCase()?.includes("mpinzile")));
    
    console.log(`\nEvaluating eligibility for student ${email} with ${studentRecords.length} course records ${isSpecialWatch ? "(SPECIAL WATCH)" : ""}`);
    
    if (isSpecialWatch) {
      console.log("SPECIAL WATCH STUDENT FOUND:", studentRecords.map(s => ({
        courseName: s.courseName,
        score: s.score,
        completed: s.courseCompleted,
        email: s.email,
        fullName: `${s.firstName} ${s.lastName}`
      })));
    }
    
    // If student only has one course record
    if (studentRecords.length === 1) {
      const student = studentRecords[0];
      
      // Double-check for excluded students by name
      const fullName = `${student.firstName?.toLowerCase() || ''} ${student.lastName?.toLowerCase() || ''}`;
      if (fullName.includes('david') && fullName.includes('mpinzile')) {
        console.log(`⚠️ EXCLUDED STUDENT DETECTED BY NAME: ${fullName} - skipping eligibility`);
        return;
      }
      
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
    
    // First identify all course prefixes available in the system
    const coursePrefixes = detectCoursePrefixesFromNames(allAvailableCourses);
    
    // Find all the course series this student is enrolled in
    studentRecords.forEach(record => {
      if (!record.courseName) return;
      
      // Find which series this course belongs to
      let seriesPrefix = "";
      for (const prefix of coursePrefixes) {
        if (record.courseName.startsWith(prefix)) {
          seriesPrefix = prefix;
          break;
        }
      }
      
      // If no series found, use the full course name
      seriesPrefix = seriesPrefix || record.courseName;
      
      if (!coursesBySeries[seriesPrefix]) {
        coursesBySeries[seriesPrefix] = [];
      }
      
      coursesBySeries[seriesPrefix].push(record);
      enrolledCourses.push(record.courseName);
    });
    
    // Debug course series grouping for watched students
    if (isSpecialWatch) {
      console.log(`SPECIAL WATCH: Course series grouping for ${email}:`);
      console.log(`Available prefixes in system: ${coursePrefixes.join(', ')}`);
      Object.entries(coursesBySeries).forEach(([prefix, courses]) => {
        console.log(`- Series ${prefix}: ${courses.map(c => c.courseName).join(', ')}`);
      });
    }
    
    // 2. Check that student has enrolled in ALL available courses for EACH series and PASSED all of them
    let allSeriesPassed = true;
    
    Object.entries(coursesBySeries).forEach(([seriesPrefix, seriesRecords]) => {
      // Get all available courses for this series from the system
      const allCoursesInSeries = getAllCoursesInSeries(allAvailableCourses, seriesPrefix);
      
      if (isSpecialWatch) {
        console.log(`SPECIAL WATCH: Analyzing series "${seriesPrefix}" for ${email}`);
        console.log(`- All courses in this series: ${JSON.stringify(allCoursesInSeries)}`);
        console.log(`- Student enrolled in: ${JSON.stringify(seriesRecords.map(r => r.courseName))}`);
      }
      
      // Get the enrolled course names for this series
      const enrolledCourseNames = seriesRecords.map(r => r.courseName).filter(Boolean) as string[];
      
      // Check if the student is enrolled in all courses in the series
      let missingCourses: string[] = [];
      
      // IMPORTANT FIX: Make sure we're checking ALL available courses in the series
      const isEnrolledInAllCourses = allCoursesInSeries.every(courseName => {
        const isEnrolled = enrolledCourseNames.includes(courseName);
        if (!isEnrolled) {
          missingCourses.push(courseName);
        }
        return isEnrolled;
      });
      
      // For this particular series, check if ALL courses were passed and completed
      const seriesPassed = seriesRecords.every(record => 
        record.score >= settings.passThreshold && record.courseCompleted
      );
      
      // Debug enrollment check for watched students
      if (isSpecialWatch) {
        console.log(`SPECIAL WATCH: Enrollment check for ${email} in series ${seriesPrefix}:`);
        console.log(`- All courses in series: ${allCoursesInSeries.join(', ')}`);
        console.log(`- Student enrolled in: ${enrolledCourseNames.join(', ')}`);
        console.log(`- Missing courses: ${missingCourses.join(', ')}`);
        console.log(`- Enrolled in all courses? ${isEnrolledInAllCourses}`);
        console.log(`- Passed all enrolled courses? ${seriesPassed}`);
        console.log(`- Will this affect eligibility? ${!isEnrolledInAllCourses || !seriesPassed ? "YES" : "NO"}`);
      }
      
      // Student must have passed all courses AND be enrolled in all courses for the series
      if (!isEnrolledInAllCourses) {
        console.log(`ENROLLMENT CHECK FAILED for ${email} in series ${seriesPrefix}:`);
        console.log(`  Missing courses: ${missingCourses.join(', ')}`);
        allSeriesPassed = false;
      }
      
      if (!seriesPassed) {
        console.log(`PASSING CHECK FAILED for ${email} in series ${seriesPrefix}:`);
        const failedCourses = seriesRecords.filter(r => r.score < settings.passThreshold || !r.courseCompleted);
        console.log(`  Failed courses: ${failedCourses.map(c => `${c.courseName}(${c.score}%)`).join(', ')}`);
        allSeriesPassed = false;
      }
    });
    
    // Only if the student passed ALL courses in ALL series they're eligible
    if (allSeriesPassed) {
      console.log(`Student ${email} passed all course series requirements`);
      
      // Final check for David Mpinzile by name or email
      const studentData = studentRecords[0];
      const fullName = `${studentData.firstName?.toLowerCase() || ''} ${studentData.lastName?.toLowerCase() || ''}`;
      
      if (fullName.includes('david') && fullName.includes('mpinzile')) {
        console.log(`⚠️ EXCLUDED STUDENT CAUGHT BY FINAL NAME CHECK: ${fullName}`);
        return;
      }
      
      // Calculate average score across all courses
      const averageScore = studentRecords.reduce((sum, record) => sum + (record.score || 0), 0) / studentRecords.length;
      
      // Use the first record but attach the combined course info
      const representativeRecord = {...studentRecords[0]};
      representativeRecord.score = averageScore;
      representativeRecord.allCourses = enrolledCourses;
      eligibleStudents.push(representativeRecord);
    } else {
      console.log(`Student ${email} did NOT pass all course series requirements`);
    }
  });
  
  console.log(`Eligible students after requiring all courses passed: ${eligibleStudents.length}`);
  
  // EXTRA DAVID FILTER - One final safety check before returning the list
  const finalEligibleList = eligibleStudents.filter(s => {
    // Check directly by first and last name together
    const fullName = `${s.firstName?.toLowerCase() || ''} ${s.lastName?.toLowerCase() || ''}`.trim();
    const isDavid = fullName.includes('david') && fullName.includes('mpinzile');
    
    if (isDavid) {
      console.log(`⚠️ FINAL CHECK - REMOVING DAVID FROM ELIGIBLE LIST:`, s);
      return false;
    }
    
    // Check by email for any variations
    const email = (s.email || '').toLowerCase();
    if (email.includes('david') && email.includes('mpinzile')) {
      console.log(`⚠️ FINAL CHECK - REMOVING DAVID BY EMAIL FROM ELIGIBLE LIST:`, s);
      return false;
    }
    
    return true;
  });
  
  if (eligibleStudents.length !== finalEligibleList.length) {
    console.log(`⚠️ David was found in eligibles and removed! Before: ${eligibleStudents.length}, After: ${finalEligibleList.length}`);
  }
  
  // Final verification - log if David is in the list
  for (const student of finalEligibleList) {
    const fullName = `${student.firstName?.toLowerCase() || ''} ${student.lastName?.toLowerCase() || ''}`.trim();
    if (fullName.includes('david') && fullName.includes('mpinzile')) {
      console.error('❌❌❌ CRITICAL ERROR: David Mpinzile still in eligible list after all filters!');
      console.log('Student record:', student);
    }
    
    const email = (student.email || '').toLowerCase();
    if (email.includes('david') && email.includes('mpinzile')) {
      console.error('❌❌❌ CRITICAL ERROR: David Mpinzile email still in eligible list after all filters!');
      console.log('Student record:', student);
    }
  }
  
  return finalEligibleList;
}

// Helper function to detect course prefixes from student objects
function detectCoursePrefixesFromStudents(students: Student[]): string[] {
  const courseNames = students.map(student => student.courseName).filter(Boolean) as string[];
  return detectCoursePrefixesFromNames(courseNames);
}

// Common function to detect course prefixes from an array of course names
function detectCoursePrefixesFromNames(courseNames: string[]): string[] {
  const prefixMap: Record<string, number> = {};
  
  // Use a more robust regex to extract course prefix
  courseNames.forEach(name => {
    if (!name) return;
    
    // Extract course prefix like "aifi_" from "aifi_301"
    const match = name.match(/^([a-zA-Z]+(?:_)?)/);
    if (match && match[1]) {
      const prefix = match[1];
      prefixMap[prefix] = (prefixMap[prefix] || 0) + 1;
    }
  });
  
  // Only consider prefixes that appear more than once
  return Object.entries(prefixMap)
    .filter(([_, count]) => count > 1)
    .map(([prefix]) => prefix);
}
