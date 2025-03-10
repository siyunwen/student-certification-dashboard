import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  Award,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Student } from '@/types/student';
import { Badge } from '@/components/ui/badge';
import { normalizeScore } from '@/utils/scoreUtils';

interface StudentTableProps {
  students: Student[];
  passThreshold: number;
  className?: string;
}

type SortField = 'fullName' | 'score' | 'lastActivityDate' | 'courseName';
type SortOrder = 'asc' | 'desc';

const StudentTable = ({ students, passThreshold, className }: StudentTableProps) => {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [expandedStudents, setExpandedStudents] = useState<string[]>([]);
  const [formattedStudents, setFormattedStudents] = useState<Student[]>([]);
  
  // Get unique course names
  const courseNames = Array.from(new Set(formattedStudents.map(s => s.courseName))).filter(Boolean);
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  // Format students' scores on component mount and when students prop changes
  useEffect(() => {
    // Debug what we received
    console.log("Raw students data:", students.map(s => ({
      name: s.fullName,
      rawScore: s.score,
      courseCompleted: s.courseCompleted,
      quizzes: s.quizScores?.length || 0
    })));
    
    // Normalize students data to ensure scores are in percentage format (0-100)
    const normalized = students.map(student => {
      return {
        ...student,
        score: normalizeScore(student.score, true),
        quizScores: student.quizScores.map(quiz => ({
          ...quiz,
          score: normalizeScore(quiz.score, true)
        }))
      };
    });
    
    console.log("Normalized students data:", normalized.map(s => ({
      name: s.fullName,
      normalizedScore: s.score,
      courseCompleted: s.courseCompleted,
      quizzes: s.quizScores?.length || 0
    })));
    
    setFormattedStudents(normalized);
  }, [students]);
  
  // Filter students by search term and course
  const filteredStudents = formattedStudents.filter((student) => {
    const matchesSearch = 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCourse = selectedCourse ? student.courseName === selectedCourse : true;
    
    return matchesSearch && matchesCourse;
  });
  
  // Sort students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'fullName') {
      comparison = a.fullName.localeCompare(b.fullName);
    } else if (sortField === 'score') {
      comparison = a.score - b.score;
    } else if (sortField === 'lastActivityDate') {
      comparison = new Date(a.lastActivityDate).getTime() - new Date(b.lastActivityDate).getTime();
    } else if (sortField === 'courseName') {
      comparison = a.courseName.localeCompare(b.courseName);
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  // Paginate students
  const totalPages = Math.ceil(sortedStudents.length / rowsPerPage);
  const start = (page - 1) * rowsPerPage;
  const paginatedStudents = sortedStudents.slice(start, start + rowsPerPage);
  
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  
  const toggleSelectAll = () => {
    if (selectedStudents.length === paginatedStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(paginatedStudents.map(s => s.id));
    }
  };
  
  const toggleSelectStudent = (id: string) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(s => s !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };
  
  const toggleExpandStudent = (id: string) => {
    if (expandedStudents.includes(id)) {
      setExpandedStudents(expandedStudents.filter(s => s !== id));
    } else {
      setExpandedStudents([...expandedStudents, id]);
    }
  };
  
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return <ArrowUpDown className="ml-1 h-3 w-3 text-brand-500" />;
  };
  
  // Debug scores
  console.log("DEBUG - StudentTable: Students with scores:", formattedStudents.map(s => ({
    name: s.fullName,
    score: s.score,
    quizCount: s.quizScores.length
  })));
  
  return (
    <div className={className}>
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
          {selectedStudents.length > 0 ? (
            <span>{selectedStudents.length} selected</span>
          ) : (
            <span>{sortedStudents.length} students found</span>
          )}
        </div>
      </div>
      
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={paginatedStudents.length > 0 && selectedStudents.length === paginatedStudents.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-10"></TableHead>
              <TableHead 
                className="cursor-pointer hover:text-brand-600 transition-colors"
                onClick={() => handleSort('fullName')}
              >
                <div className="flex items-center">
                  Name {renderSortIcon('fullName')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-brand-600 transition-colors text-right"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center justify-end">
                  Avg. Score {renderSortIcon('score')}
                </div>
              </TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead 
                className="hidden md:table-cell cursor-pointer hover:text-brand-600 transition-colors"
                onClick={() => handleSort('courseName')}
              >
                <div className="flex items-center">
                  Course {renderSortIcon('courseName')}
                </div>
              </TableHead>
              <TableHead 
                className="hidden lg:table-cell cursor-pointer hover:text-brand-600 transition-colors"
                onClick={() => handleSort('lastActivityDate')}
              >
                <div className="flex items-center">
                  Last Activity {renderSortIcon('lastActivityDate')}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student) => {
                const isPassing = student.score >= passThreshold && student.courseCompleted;
                const isExpanded = expandedStudents.includes(student.id);
                
                // Debug: Print student score for this specific row
                console.log(`Student ${student.fullName}: score=${student.score.toFixed(1)}, isPassing=${isPassing}, quizCount=${student.quizScores.length}`);
                
                return (
                  <React.Fragment key={student.id}>
                    <TableRow className={`group animate-fade-in ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={() => toggleSelectStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell className="p-0 w-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleExpandStudent(student.id)}
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
                        <span 
                          className={`
                            ${isPassing 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-slate-600 dark:text-slate-400'
                            }
                          `}
                        >
                          {student.score.toFixed(1)}%
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
                              <span className="text-slate-500 text-sm">Not eligible</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="font-normal">
                          {student.courseName || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-slate-600 dark:text-slate-400 text-sm">
                        {format(new Date(student.lastActivityDate), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                    
                    {isExpanded && (
                      <TableRow className="bg-slate-50 dark:bg-slate-800/30">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-4">
                            <h4 className="text-sm font-medium mb-2">Quiz Scores</h4>
                            {student.quizScores.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {student.quizScores.map((quiz, index) => (
                                  <div 
                                    key={index} 
                                    className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 flex justify-between items-center"
                                  >
                                    <span className="text-sm truncate mr-2" title={quiz.quizName}>
                                      {quiz.quizName}
                                    </span>
                                    <span 
                                      className={`text-sm font-medium ${
                                        quiz.score >= passThreshold ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                                      }`}
                                    >
                                      {quiz.score.toFixed(1)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 italic">No quiz scores available</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-slate-500">
            Showing {start + 1}-{Math.min(start + rowsPerPage, sortedStudents.length)} of {sortedStudents.length}
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 px-2">
              Page {page} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTable;
