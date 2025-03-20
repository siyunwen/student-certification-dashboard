
import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  chip?: string;
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
  fullHeight?: boolean; // Added prop for full height control
}

const DashboardCard = ({
  title,
  subtitle,
  chip,
  children,
  className,
  animate = true,
  fullHeight = false, // Default to false
  ...props
}: DashboardCardProps) => {
  return (
    <div 
      className={cn(
        'dashboard-card card-transition', 
        animate ? 'animate-scale-in' : '',
        fullHeight ? 'h-full' : '', // Apply full height when requested
        className
      )}
      {...props}
    >
      {chip && (
        <div className="mb-3">
          <span className="chip">{chip}</span>
        </div>
      )}
      
      {title && (
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
          {title}
        </h3>
      )}
      
      {subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {subtitle}
        </p>
      )}
      
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default DashboardCard;
