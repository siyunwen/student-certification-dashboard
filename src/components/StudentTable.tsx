
import React, { useState, useEffect } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Student } from '@/types/student';
import { TableControls } from './student-table/TableControls';
import { StudentTableRow } from './student-table/StudentTableRow';
import { TablePagination } from './student-table/TablePagination';
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
  const [rowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [expandedStudents, setExpandedStudents] = useState<string[]>([]);
  const [formattedStudents, setFormattedStudents] = useState<Student[]>([]);
  
  const courseNames = Array.from(new Set(formattedStudents.map(s => s.courseName))).filter(Boolean);
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  useEffect(() => {
    const normalized = students.map(student => ({
      ...student,
      score: normalizeScore(student.score, true),
      quizScores: student.quizScores?.map(quiz => ({
        ...quiz,
        score: normalizeScore(quiz.score, true)
      })) || []
    }));
    
    setFormattedStudents(normalized);
  }, [students]);

  const filteredStudents = formattedStudents.filter((student) => {
    const matchesSearch = 
      (student.firstName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (student.lastName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (student.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesCourse = selectedCourse ? student.courseName === selectedCourse : true;
    
    return matchesSearch && matchesCourse;
  });
  
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'fullName') {
      comparison = (a.fullName || '').localeCompare(b.fullName || '');
    } else if (sortField === 'score') {
      comparison = (a.score || 0) - (b.score || 0);
    } else if (sortField === 'lastActivityDate') {
      comparison = new Date(a.lastActivityDate || 0).getTime() - new Date(b.lastActivityDate || 0).getTime();
    } else if (sortField === 'courseName') {
      comparison = (a.courseName || '').localeCompare(b.courseName || '');
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  const totalPages = Math.ceil(sortedStudents.length / rowsPerPage);
  const start = (page - 1) * rowsPerPage;
  const paginatedStudents = sortedStudents.slice(start, start + rowsPerPage);
  
  const courseAverageScore = () => {
    const relevantStudents = selectedCourse 
      ? formattedStudents.filter(s => s.courseName === selectedCourse)
      : formattedStudents;
    
    if (relevantStudents.length === 0) return '0';
    
    const sum = relevantStudents.reduce((total, student) => total + (student.score || 0), 0);
    return (sum / relevantStudents.length).toFixed(1);
  };
  
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
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };
  
  const toggleExpandStudent = (id: string) => {
    setExpandedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return <ArrowUpDown className="ml-1 h-3 w-3 text-brand-500" />;
  };

  return (
    <div className={className}>
      <TableControls 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        courseNames={courseNames}
        selectedCourse={selectedCourse}
        setSelectedCourse={setSelectedCourse}
        totalStudents={sortedStudents.length}
        selectedCount={selectedStudents.length}
        courseAverageScore={courseAverageScore}
      />
      
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
              paginatedStudents.map((student) => (
                <StudentTableRow
                  key={student.id}
                  student={student}
                  isSelected={selectedStudents.includes(student.id)}
                  isExpanded={expandedStudents.includes(student.id)}
                  passThreshold={passThreshold}
                  onSelect={() => toggleSelectStudent(student.id)}
                  onExpand={() => toggleExpandStudent(student.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <TablePagination
        page={page}
        totalPages={totalPages}
        start={start}
        rowsPerPage={rowsPerPage}
        totalItems={sortedStudents.length}
        onPageChange={setPage}
      />
    </div>
  );
};

export default StudentTable;
