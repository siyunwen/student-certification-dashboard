
import { Student, CertificationSettings, CertificationStats } from '../types/student';

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

export const parseCSVData = (csvContent: string): Student[] => {
  // Split by lines and get headers
  const lines = csvContent.trim().split('\n');
  if (lines.length <= 1) return [];
  
  const headers = lines[0].split(',');
  
  // Find the indices of required columns
  const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));
  const emailIndex = headers.findIndex(h => h.toLowerCase().includes('email'));
  const scoreIndex = headers.findIndex(h => h.toLowerCase().includes('score'));
  const completedIndex = headers.findIndex(h => h.toLowerCase().includes('complete'));
  const enrollmentIndex = headers.findIndex(h => h.toLowerCase().includes('enroll'));
  const activityIndex = headers.findIndex(h => h.toLowerCase().includes('activity') || h.toLowerCase().includes('last'));
  
  // Parse data rows
  return lines.slice(1).map((line, index) => {
    const values = line.split(',');
    
    return {
      id: `student-${index}`,
      name: nameIndex >= 0 ? values[nameIndex].trim() : `Student ${index + 1}`,
      email: emailIndex >= 0 ? values[emailIndex].trim() : `student${index + 1}@example.com`,
      score: scoreIndex >= 0 ? parseFloat(values[scoreIndex]) : 0,
      courseCompleted: completedIndex >= 0 ? values[completedIndex].toLowerCase() === 'true' || values[completedIndex] === '1' : true,
      enrollmentDate: enrollmentIndex >= 0 ? values[enrollmentIndex].trim() : new Date().toISOString().split('T')[0],
      lastActivityDate: activityIndex >= 0 ? values[activityIndex].trim() : new Date().toISOString().split('T')[0]
    };
  });
};
