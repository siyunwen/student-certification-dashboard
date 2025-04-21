
import { Student, CertificationSettings } from '../types/student';
import { getAllCoursesInSeries } from './courseUtils';
import { isExcludedStudent } from './exclusionUtils';

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
  const studentsByEmail = groupStudentsByEmail(filteredByDate);
  
  const eligibleStudents: Student[] = [];
  
  // Process each student to check eligibility
  Object.entries(studentsByEmail).forEach(([email, studentRecords]) => {
    const studentData = studentRecords[0];
    
    // Check if student is excluded
    if (isExcludedStudent(email, studentData.firstName, studentData.lastName)) {
      return;
    }
    
    // Process course series eligibility
    if (isEligibleForAllCourseSeries(studentRecords, allAvailableCourses, settings.passThreshold)) {
      // Calculate average score across all courses
      const averageScore = calculateAverageScore(studentRecords);
      
      // Use the first record but attach the combined course info
      const representativeRecord = {...studentRecords[0]};
      representativeRecord.score = averageScore;
      representativeRecord.allCourses = studentRecords.map(r => r.courseName).filter(Boolean) as string[];
      eligibleStudents.push(representativeRecord);
    }
  });
  
  return eligibleStudents;
}

function groupStudentsByEmail(students: Student[]): Record<string, Student[]> {
  return students.reduce((groups: Record<string, Student[]>, student) => {
    if (!student.email) return groups;
    
    const email = student.email.toLowerCase().trim();
    if (!groups[email]) {
      groups[email] = [];
    }
    
    groups[email].push(student);
    return groups;
  }, {});
}

function isEligibleForAllCourseSeries(
  studentRecords: Student[],
  allAvailableCourses: string[],
  passThreshold: number
): boolean {
  const coursesBySeries = groupCoursesBySeries(studentRecords);
  
  return Object.entries(coursesBySeries).every(([seriesPrefix, seriesRecords]) => {
    const allCoursesInSeries = getAllCoursesInSeries(allAvailableCourses, seriesPrefix);
    const enrolledCourseNames = seriesRecords.map(r => r.courseName).filter(Boolean) as string[];
    
    // Check if enrolled in all courses and passed them
    const isEnrolledInAll = allCoursesInSeries.every(courseName => 
      enrolledCourseNames.includes(courseName)
    );
    
    const allCoursesPassed = seriesRecords.every(record => 
      record.score >= passThreshold && record.courseCompleted
    );
    
    return isEnrolledInAll && allCoursesPassed;
  });
}

function groupCoursesBySeries(studentRecords: Student[]): Record<string, Student[]> {
  const coursesBySeries: Record<string, Student[]> = {};
  
  studentRecords.forEach(record => {
    if (!record.courseName) return;
    
    // Use the course name as the series prefix if no better grouping is found
    const seriesPrefix = record.courseName.split('_')[0] || record.courseName;
    
    if (!coursesBySeries[seriesPrefix]) {
      coursesBySeries[seriesPrefix] = [];
    }
    
    coursesBySeries[seriesPrefix].push(record);
  });
  
  return coursesBySeries;
}

function calculateAverageScore(records: Student[]): number {
  const totalScore = records.reduce((sum, record) => sum + (record.score || 0), 0);
  return records.length > 0 ? totalScore / records.length : 0;
}
