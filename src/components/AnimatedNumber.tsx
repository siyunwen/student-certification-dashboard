
import React, { useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

const AnimatedNumber = ({
  value,
  duration = 1000,
  formatValue = (val) => val.toFixed(0),
  className
}: AnimatedNumberProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime: number | null = null;
    const startValue = displayValue;
    
    const animateValue = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const currentValue = startValue + progress * (value - startValue);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        window.requestAnimationFrame(animateValue);
      }
    };
    
    window.requestAnimationFrame(animateValue);
    
    return () => {
      startTime = null;
    };
  }, [value, duration]);
  
  return (
    <span className={`inline-block transition-all duration-300 ${className}`}>
      {formatValue(displayValue)}
    </span>
  );
};

export default AnimatedNumber;
