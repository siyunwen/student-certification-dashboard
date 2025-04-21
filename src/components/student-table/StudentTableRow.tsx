
import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Student } from '@/types/student';
import { ExpandedDetails } from './ExpandedDetails';

interface StudentTableRowProps {
  student: Student;
  isSelected: boolean;
  isExpanded: boolean;
  passThreshold: number;
  onSelect: () => void;
  onExpand: () => void;
}

export const StudentTableRow = ({
  student,
  isSelected,
  isExpanded,
  passThreshold,
  onSelect,
  onExpand,
}: StudentTableRowProps) => {
  const hasPassingScore = student.score >= passThreshold;
  const isPassing = hasPassingScore && student.courseCompleted;
  const hasMultipleCourses = student.allCourses && student.allCourses.length > 1;

  return (
    <>
      <TableRow className={`group animate-fade-in ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}>
        <TableCell>
          <Checkbox 
            checked={isSelected}
            onCheckedChange={onSelect}
          />
        </TableCell>
        <TableCell className="p-0 w-10">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onExpand}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </TableCell>
        <TableCell>
          <div className="font-medium">{student.firstName} {student.lastName}</div>
          <div className="text-sm text-slate-500 truncate max-w-[150px] sm:max-w-xs">
            {student.email}
          </div>
        </TableCell>
        <TableCell className="text-right font-medium">
          <span className={isPassing ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}>
            {student.score?.toFixed(1)}%
          </span>
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          <div className="flex items-center">
            {isPassing ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500 mr-1.5" />
                <span className="text-green-700 dark:text-green-400 text-sm font-medium">Eligible</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-slate-400 mr-1.5" />
                <span className="text-slate-500 text-sm">
                  {!hasPassingScore ? "Score below threshold" : 
                   !student.courseCompleted ? "Course not completed" : 
                   "Not eligible"}
                </span>
              </>
            )}
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {hasMultipleCourses ? (
            <div className="flex flex-wrap gap-1">
              {student.allCourses?.slice(0, 2).map((course, i) => (
                <Badge key={i} variant="outline" className="font-normal">
                  {course}
                </Badge>
              ))}
              {student.allCourses && student.allCourses.length > 2 && (
                <Badge variant="outline" className="font-normal">
                  +{student.allCourses.length - 2} more
                </Badge>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="font-normal">
              {student.courseName || 'Unknown'}
            </Badge>
          )}
        </TableCell>
        <TableCell className="hidden lg:table-cell text-slate-600 dark:text-slate-400 text-sm">
          {student.lastActivityDate ? format(new Date(student.lastActivityDate), 'MMM d, yyyy') : 'N/A'}
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow className="bg-slate-50 dark:bg-slate-800/30">
          <TableCell colSpan={7} className="p-0">
            <ExpandedDetails student={student} passThreshold={passThreshold} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
