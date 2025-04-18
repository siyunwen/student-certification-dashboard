
/**
 * Normalizes scores to ensure consistent format (percentage or decimal)
 */
export const normalizeScore = (value: number | string, toPercentage: boolean = true): number => {
  // If value is a string, try to convert it to a number
  if (typeof value === 'string') {
    // Check for "Not finished" or similar indicators
    if (isNotCompletedQuiz(value)) {
      return 0;
    }
    
    // Remove any non-numeric characters except decimal points
    const cleanValue = value.replace(/[^\d.]/g, '');
    
    // If the string is empty after cleaning, return 0
    if (!cleanValue) return 0;
    
    // Parse the clean value as a number
    value = parseFloat(cleanValue);
    
    // If parsing failed, return 0
    if (isNaN(value)) return 0;
  }
  
  // If value is not a number or NaN, return 0
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  
  // Score is in decimal format (0-1)
  if (value >= 0 && value <= 1) {
    return toPercentage ? value * 100 : value;
  }
  
  // Score is in percentage format (0-100)
  if (value > 1 && value <= 100) {
    return toPercentage ? value : value / 100;
  }
  
  // If value is negative, return 0
  if (value < 0) {
    return 0;
  }
  
  // For values > 100, cap at 100 for percentage
  return toPercentage ? Math.min(value, 100) : Math.min(value / 100, 1);
};

/**
 * Determines if a text value represents an incomplete or not finished quiz
 */
export const isNotCompletedQuiz = (value: string | number): boolean => {
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    return (
      lowerValue.includes('not') || 
      lowerValue.includes('not finished') ||
      lowerValue === 'null' ||
      lowerValue === 'nan' ||
      lowerValue.includes('n/a') || 
      lowerValue.includes('incomplete') ||
      lowerValue === '' ||
      lowerValue === '-' ||
      lowerValue === 'null' ||
      lowerValue === 'undefined'
    );
  }
  return false;
}

/**
 * Parses score values from various formats to a numerical percentage
 */
export const parseScoreValue = (value: string | number): number => {
  // Handle already numeric values
  if (typeof value === 'number') {
    // Keep all scores as percentages (0-100)
    if (value > 0 && value <= 1) {
      return value * 100;
    }
    return value;
  }
  
  // Handle empty values
  if (!value || value.trim() === '') {
    return 0;
  }
  
  // Handle "not finished" or similar non-numeric indicators
  if (isNotCompletedQuiz(value)) {
    return 0;
  }
  
  // Check if value ends with '%' like '80.0%'
  if (typeof value === 'string' && value.includes('%')) {
    // Remove percentage sign and convert to number
    const cleanValue = value.replace(/%/g, '').trim();
    const numberValue = parseFloat(cleanValue);
    return isNaN(numberValue) ? 0 : numberValue;
  }
  
  // Add debug log to see what values are being processed
  console.log(`Parsing quiz score value: "${value}" (${typeof value})`);
  
  // Remove any non-numeric characters except decimal points
  const cleanValue = value.toString().replace(/[^\d.]/g, '').trim();
  
  // Parse the clean value as a number
  const numberValue = parseFloat(cleanValue);
  
  // Add debug log for the parsed value
  console.log(`Parsed to: ${numberValue}`);
  
  // Return 0 if NaN
  if (isNaN(numberValue)) {
    return 0;
  }
  
  // Always store scores as percentages (0-100)
  if (numberValue > 0 && numberValue <= 1) {
    return numberValue * 100;
  }
  
  return numberValue;
}

/**
 * Checks if a student has completed all quizzes for their course
 * @param student Student object with quiz scores
 * @param requiredQuizCount Expected number of quizzes for the course
 * @returns Boolean indicating if all quizzes are completed
 */
export const hasCompletedAllQuizzes = (student: { quizScores?: { quizName: string; score: number | null }[] }, requiredQuizCount: number): boolean => {
  // If no quiz scores, student hasn't completed any quizzes
  if (!student.quizScores || student.quizScores.length === 0) {
    return false;
  }
  
  // Check if the student has completed the required number of quizzes
  const completedQuizzes = student.quizScores.filter(quiz => quiz.score !== null && quiz.score > 0);
  return completedQuizzes.length >= requiredQuizCount;
};

/**
 * Gets the count of required quizzes for a course from quiz file data
 * @param quizData Quiz file data containing quiz headers
 * @returns Number of quizzes required for completion
 */
export const getRequiredQuizCount = (quizData: any[]): number => {
  // If no quiz data available, return 0
  if (!quizData || quizData.length === 0) {
    return 0;
  }
  
  // Get the first record which should have quiz names as properties
  const firstRecord = quizData[0];
  
  // Count properties that represent quizzes (exclude student info fields)
  const excludedFields = ['firstName', 'lastName', 'email', 'quizName', 'score', 'completedAt', 
                          'student_family_name', 'student_given_name', 'student_email', 'student_id', 'student_lms_id'];
  
  // Count non-standard fields as quiz names
  return Object.keys(firstRecord).filter(key => !excludedFields.includes(key)).length;
};
