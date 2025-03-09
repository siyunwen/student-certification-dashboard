
import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

const DashboardHeader = ({
  title,
  description,
  children,
  className
}: DashboardHeaderProps) => {
  return (
    <div className={cn('py-8 animate-slide-down', className)}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;
