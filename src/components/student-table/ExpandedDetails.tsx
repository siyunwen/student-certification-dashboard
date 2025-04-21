
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Student } from '@/types/student';

interface ExpandedDetailsProps {
  student: Student;
  passThreshold: number;
}

export const ExpandedDetails = ({ student, passThreshold }: ExpandedDetailsProps) => {
  const hasMultipleCourses = student.allCourses && student.allCourses.length > 1;

  return (
    <div className="p-4">
      {hasMultipleCourses && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Enrolled Courses</h4>
          <div className="flex flex-wrap gap-1">
            {student.allCourses?.map((course, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {course}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-medium">Quiz Scores</h4>
        {student.requiredQuizCount && (
          <span className={`text-xs px-2 py-1 rounded ${
            student.allQuizzesCompleted 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
          }`}>
            {student.quizScores?.filter(q => q.score !== null).length || 0}/{student.requiredQuizCount} quizzes completed
          </span>
        )}
      </div>
      
      {student.quizScores && student.quizScores.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {student.quizScores.map((quiz, index) => (
            <div 
              key={index} 
              className={`p-2 rounded border flex justify-between items-center ${
                quiz.score === null 
                  ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="text-sm truncate mr-2" title={quiz.quizName}>
                {quiz.quizName}
              </span>
              <span 
                className={`text-sm font-medium ${
                  quiz.score === null ? 'text-slate-500 dark:text-slate-400' :
                  quiz.score >= passThreshold ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                }`}
              >
                {quiz.score === null ? 'Not completed' : `${quiz.score?.toFixed(1)}%`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">No quiz scores available</p>
      )}
    </div>
  );
};
