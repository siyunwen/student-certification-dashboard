
import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  Award
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

interface StudentTableProps {
  students: Student[];
  passThreshold: number;
  className?: string;
}

type SortField = 'name' | 'score' | 'enrollmentDate' | 'lastActivityDate';
type SortOrder = 'asc' | 'desc';

const StudentTable = ({ students, passThreshold, className }: StudentTableProps) => {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  
  // Filter students by search term
  const filteredStudents = students.filter((student) => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Sort students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === 'score') {
      comparison = a.score - b.score;
    } else if (sortField === 'enrollmentDate') {
      comparison = new Date(a.enrollmentDate).getTime() - new Date(b.enrollmentDate).getTime();
    } else if (sortField === 'lastActivityDate') {
      comparison = new Date(a.lastActivityDate).getTime() - new Date(b.lastActivityDate).getTime();
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
  
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return sortOrder === 'asc' 
      ? <ArrowUpDown className="ml-1 h-3 w-3 text-brand-500" /> 
      : <ArrowUpDown className="ml-1 h-3 w-3 text-brand-500" />;
  };
  
  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
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
              <TableHead 
                className="cursor-pointer hover:text-brand-600 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Name {renderSortIcon('name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-brand-600 transition-colors text-right"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center justify-end">
                  Score {renderSortIcon('score')}
                </div>
              </TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead 
                className="hidden md:table-cell cursor-pointer hover:text-brand-600 transition-colors"
                onClick={() => handleSort('enrollmentDate')}
              >
                <div className="flex items-center">
                  Enrollment {renderSortIcon('enrollmentDate')}
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
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student) => {
                const isPassing = student.score >= passThreshold && student.courseCompleted;
                
                return (
                  <TableRow key={student.id} className="group animate-fade-in">
                    <TableCell>
                      <Checkbox 
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={() => toggleSelectStudent(student.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{student.name}</div>
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
                        {student.score}%
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
                    <TableCell className="hidden md:table-cell text-slate-600 dark:text-slate-400 text-sm">
                      {format(new Date(student.enrollmentDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-slate-600 dark:text-slate-400 text-sm">
                      {format(new Date(student.lastActivityDate), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
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
