
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
  
  // Extract proper course prefixes with regex pattern matching
  courseNames.forEach(name => {
    if (!name) return;
    
    // Use a more robust regex to extract course prefix (e.g., "aifi_" from "aifi_301")
    // This will match alphabetical characters followed by an underscore or number
    const match = name.match(/^([a-zA-Z]+(?:_)?)/);
    if (match && match[1]) {
      const prefix = match[1];
      prefixMap[prefix] = (prefixMap[prefix] || 0) + 1;
      console.log(`Detected prefix "${prefix}" from course "${name}"`);
    }
  });
  
  // Only consider prefixes that appear more than once
  const validPrefixes = Object.entries(prefixMap)
    .filter(([_, count]) => count > 1)
    .map(([prefix]) => prefix);
  
  console.log("Valid course prefixes:", validPrefixes);
  return validPrefixes;
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

// Get all available courses in a series
export function getAllCoursesInSeries(courseNames: string[], seriesPrefix: string): string[] {
  // This is the key fix: ensure we're getting all courses that start with the prefix
  const matchingCourses = courseNames.filter(name => {
    if (!name) return false;
    const matches = name.startsWith(seriesPrefix);
    console.log(`getAllCoursesInSeries: Course "${name}" ${matches ? "MATCHES" : "does NOT match"} prefix "${seriesPrefix}"`);
    return matches;
  });
  
  console.log(`getAllCoursesInSeries for prefix "${seriesPrefix}": Found ${matchingCourses.length} matching courses:`, matchingCourses);
  return matchingCourses;
}

// Helper function to get the course prefix for a file - improved matching
export function getCoursePrefixForFile(courseName: string, prefixes: string[]): string | null {
  // Make sure we have a valid course name and prefixes
  if (!courseName || prefixes.length === 0) return null;
  
  // Sort prefixes by length (descending) to match the most specific prefix first
  const sortedPrefixes = [...prefixes].sort((a, b) => b.length - a.length);
  
  for (const prefix of sortedPrefixes) {
    const matches = courseName.startsWith(prefix);
    console.log(`Checking if course "${courseName}" matches prefix "${prefix}": ${matches}`);
    if (matches) {
      return prefix;
    }
  }
  return null;
}
