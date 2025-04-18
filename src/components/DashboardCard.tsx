
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
  emptyState?: React.ReactNode; // Add support for empty state content
}

const DashboardCard = ({
  title,
  subtitle,
  chip,
  children,
  className,
  animate = true,
  fullHeight = false, // Default to false
  emptyState,
  ...props
}: DashboardCardProps) => {
  return (
    <div 
      className={cn(
        'dashboard-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm transition-all',
        animate ? 'animate-scale-in' : '',
        fullHeight ? 'h-full flex flex-col' : '', // Apply full height and flex column when requested
        className
      )}
      {...props}
    >
      {chip && (
        <div className="mb-3">
          <span className="chip bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium rounded px-2 py-1">
            {chip}
          </span>
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
      
      <div className={cn("space-y-4", fullHeight && "flex-grow")}>
        {children || emptyState}
      </div>
    </div>
  );
};

export default DashboardCard;
