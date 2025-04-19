
import { ParsedFile, CourseData } from '../types/student';
import { detectCoursePrefixesFromNames, getCoursePrefixForFile } from './fileUtils';

// Helper function to detect course prefixes from student objects
export function detectCoursePrefixesFromStudents(students: any[]): string[] {
  const courseNames = students.map(student => student.courseName).filter(Boolean) as string[];
  return detectCoursePrefixesFromNames(courseNames);
}

// Helper function to detect course prefixes for merging from ParsedFile objects
export function detectCoursePrefixes(files: ParsedFile[]): string[] {
  const courseNames = files.map(file => file.courseName).filter(Boolean) as string[];
  return detectCoursePrefixesFromNames(courseNames);
}

// Group files by course and check if each course has both student and quiz files
// Now supports course prefix merging
export function groupFilesByCourse(files: ParsedFile[]): Record<string, CourseData> {
  // First detect course prefixes for merging
  const coursePrefixes = detectCoursePrefixes(files);
  console.log('Detected course prefixes for grouping:', coursePrefixes);
  
  const courseMap: Record<string, CourseData> = {};
  
  files.forEach(file => {
    if (!file.courseName) return;
    
    // Trim course name to ensure consistency
    const courseName = file.courseName.trim();
    
    // Check if this course should be grouped based on prefix
    const coursePrefix = getCoursePrefixForFile(courseName, coursePrefixes);
    const finalCourseName = coursePrefix || courseName;
    
    if (!courseMap[finalCourseName]) {
      courseMap[finalCourseName] = {
        isComplete: false,
        studentFile: undefined,
        quizFile: undefined
      };
    }
    
    if (file.type === 'student') {
      // If there's already a student file, it means we merged files in processFiles
      // We'll still overwrite it here for UI consistency
      courseMap[finalCourseName].studentFile = file;
    } else if (file.type === 'quiz') {
      // If there's already a quiz file, it means we merged files in processFiles
      // We'll still overwrite it here for UI consistency
      courseMap[finalCourseName].quizFile = file;
    }
    
    // Update complete status
    courseMap[finalCourseName].isComplete = 
      courseMap[finalCourseName].studentFile !== undefined && 
      courseMap[finalCourseName].quizFile !== undefined;
  });
  
  return courseMap;
}
