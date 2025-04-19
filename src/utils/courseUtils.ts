
import { ParsedFile, CourseData } from '../types/student';

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

// Common function to detect course prefixes from an array of course names
export function detectCoursePrefixesFromNames(courseNames: string[]): string[] {
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

// Get all available courses in a series - FIXED to use startsWith instead of exact prefix
export function getAllCoursesInSeries(courseNames: string[], seriesPrefix: string): string[] {
  // This is the key fix: ensure we're getting all courses that start with the prefix
  const matchingCourses = courseNames.filter(name => name && name.startsWith(seriesPrefix));
  console.log(`getAllCoursesInSeries for prefix "${seriesPrefix}": Found ${matchingCourses.length} matching courses:`, matchingCourses);
  return matchingCourses;
}

// Helper function to get the course prefix for a file
export function getCoursePrefixForFile(courseName: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (courseName.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}
