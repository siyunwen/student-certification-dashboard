
import { ParsedFile } from '../types/student';

// Extract course name from file name - improved to handle course codes like "aifi_303"
export function extractCourseName(filename: string): string {
  // Remove file extension
  const nameWithoutExt = filename.split('.')[0];
  
  // For files ending with _quiz_scores or _students, extract the part before that
  if (nameWithoutExt.includes('_quiz_scores')) {
    const coursePart = nameWithoutExt.split('_quiz_scores')[0];
    console.log(`Extracted course name from quiz file: '${filename}' → '${coursePart}'`);
    return coursePart;
  }
  
  if (nameWithoutExt.includes('_students')) {
    const coursePart = nameWithoutExt.split('_students')[0];
    console.log(`Extracted course name from student file: '${filename}' → '${coursePart}'`);
    return coursePart;
  }
  
  // If no pattern matches, return original name without extension
  console.log(`No pattern match for filename '${filename}', using '${nameWithoutExt}'`);
  return nameWithoutExt;
}

// Parse name from a string with improved format handling
export function parseName(name: string): { firstName: string; lastName: string } {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return { firstName: 'Unknown', lastName: 'Unknown' };
  }
  
  name = name.trim();
  
  // Format: "Last, First" (quiz scores file format)
  if (name.includes(',')) {
    const parts = name.split(',').map(part => part.trim());
    return {
      firstName: parts.length > 1 ? parts[1] : 'Unknown',
      lastName: parts[0] || 'Unknown'
    };
  } 
  // Format: "First Last" (student file format)
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

// Helper function to parse CSV row (handles quotes)
export function parseCSVRow(row: string): string[] {
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

// Helper function to detect course prefixes for merging from course names
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

// Helper function to get the course prefix for a file
export function getCoursePrefixForFile(courseName: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (courseName.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}
