
/**
 * Normalizes scores to ensure consistent format (percentage or decimal)
 */
export const normalizeScore = (value: number, toPercentage: boolean = true): number => {
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
