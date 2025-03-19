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
  
  // Remove any non-numeric characters except decimal points
  const cleanValue = value.toString().replace(/[^\d.]/g, '').trim();
  
  // Parse the clean value as a number
  const numberValue = parseFloat(cleanValue);
  
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
