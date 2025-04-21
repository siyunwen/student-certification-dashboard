
import { Student, CertificationSettings, CertificationStats } from '../types/student';
import { detectCoursePrefixesFromStudents } from './courseUtils';
import { getEligibleStudents } from './eligibilityUtils';

export function calculateCertificationStats(
  students: Student[],
  settings: CertificationSettings
): CertificationStats {
  console.log("calculateCertificationStats: Starting with", students.length, "students");
  
  // Filter out students based on date if needed
  const filteredStudents = settings.dateSince
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
