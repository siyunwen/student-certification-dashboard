
import React from 'react';
import { Input } from '@/components/ui/input';

interface TableControlsProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  courseNames: string[];
  selectedCourse: string;
  setSelectedCourse: (course: string) => void;
  totalStudents: number;
  selectedCount: number;
  courseAverageScore: () => string;
}

export const TableControls = ({
  searchTerm,
  setSearchTerm,
  courseNames,
  selectedCourse,
  setSelectedCourse,
  totalStudents,
  selectedCount,
  courseAverageScore,
}: TableControlsProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
        
        {courseNames.length > 0 && (
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700"
          >
            <option value="">All Courses</option>
            {courseNames.map(course => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
        )}
      </div>
      
      <div className="text-sm text-slate-500">
        {selectedCount > 0 ? (
          <span>{selectedCount} selected</span>
        ) : (
          <div className="flex flex-col items-end">
            <span>{totalStudents} students found</span>
            {selectedCourse && (
              <span className="font-medium text-brand-600">Avg. score: {courseAverageScore()}%</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
