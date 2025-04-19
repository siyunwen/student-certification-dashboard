
import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ParsedFile } from '@/types/student';
import { parseCSVData } from '@/utils/fileParsingUtils';
import { processFiles } from '@/services/localStorageService';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FileUploadProps {
  onFilesLoaded: (files: ParsedFile[]) => void;
  className?: string;
}

const FileUpload = ({ onFilesLoaded, className }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFileFormatHelp, setShowFileFormatHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      processUploadedFiles(droppedFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      processUploadedFiles(selectedFiles);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    
    const newParsedFiles = [...parsedFiles];
    newParsedFiles.splice(index, 1);
    setParsedFiles(newParsedFiles);
    onFilesLoaded(newParsedFiles);
  };

  const clearAllFiles = () => {
    setFiles([]);
    setParsedFiles([]);
    onFilesLoaded([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processUploadedFiles = (newFiles: File[]) => {
    console.log("processUploadedFiles: Starting with", newFiles.length, "files");
    if (!newFiles.length) return;
    
    const validFiles = newFiles.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return extension === 'csv' || extension === 'txt' || extension === 'xlsx' || extension === 'xls';
    });
    
    if (validFiles.length !== newFiles.length) {
      toast.error('Some files were skipped. Please upload only CSV, TXT, XLSX or XLS files');
    }
    
    if (validFiles.length === 0) {
      toast.error('No valid files found. Please upload CSV, TXT, XLSX or XLS files');
      return;
    }
    
    console.log("processUploadedFiles: Found", validFiles.length, "valid files");
    setFiles(prev => [...prev, ...validFiles]);
    setIsLoading(true);
    
    const filePromises = validFiles.map(file => {
      return new Promise<ParsedFile>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            console.log(`Parsing file '${file.name}'...`);
            const parsedFile = parseCSVData(file.name, content);
            console.log(`File '${file.name}' parsed as course: '${parsedFile.courseName}'`);
            console.log(`File type: ${parsedFile.type}, records: ${parsedFile.data.length}`);
            resolve(parsedFile);
          } catch (error) {
            console.error(`Error parsing file ${file.name}:`, error);
            reject(error);
          }
        };
        
        reader.onerror = () => {
          console.error(`Failed to read file: ${file.name}`);
          reject(new Error(`Failed to read file: ${file.name}`));
        };
        
        reader.readAsText(file);
      });
    });
    
    Promise.all(filePromises)
      .then(async results => {
        if (results.length === 0) {
          toast.error('No files could be processed. Please check file format.');
          setIsLoading(false);
          return;
        }

        console.log(`Successfully parsed ${results.length} files`);
        const newParsedFiles = [...parsedFiles, ...results];
        setParsedFiles(newParsedFiles);
        
        setIsProcessing(true);
        try {
          console.log('Processing files with processFiles function...');
          const result = await processFiles(newParsedFiles);
          console.log('Files processed result:', result);
          
          // Force-trigger localStorage to update UI immediately
          window.dispatchEvent(new Event('storage'));
          
          if (result.students && result.students.length > 0) {
            onFilesLoaded(result.parsedFiles);
            toast.success(`${validFiles.length} file(s) processed successfully. Found ${result.students.length} students.`);
            console.log(`Successfully processed files and found ${result.students.length} students`);
          } else if (result.parsedFiles.length > 0) {
            onFilesLoaded(result.parsedFiles);
            toast.warning('Files were uploaded but no student matches were found. Check if student and quiz names match.');
            console.log('Files processed but no students found - possible name matching issue');
          } else {
            toast.warning('Files were processed but no valid student data was found. Please check file format.');
            console.log('No valid student data found in processed files');
          }
        } catch (error) {
          console.error('Error in processFiles function:', error);
          toast.error('Failed to process data. Please check console for details.');
        } finally {
          setIsProcessing(false);
        }
      })
      .catch(error => {
        toast.error('Failed to process one or more files');
        console.error('Error processing files:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const getCourseCompleteness = () => {
    const detectCoursePrefixes = (files: ParsedFile[]): string[] => {
      const courseNames = files.map(file => file.courseName);
      const prefixMap: Record<string, number> = {};
      
      courseNames.forEach(name => {
        if (!name || name.length < 4) return;
        
        const prefix = name.substring(0, 4);
        prefixMap[prefix] = (prefixMap[prefix] || 0) + 1;
      });
      
      return Object.entries(prefixMap)
        .filter(([_, count]) => count > 1)
        .map(([prefix]) => prefix);
    };
    
    const coursePrefixes = detectCoursePrefixes(parsedFiles);
    
    const getCoursePrefixForFile = (courseName: string, prefixes: string[]): string | null => {
      for (const prefix of prefixes) {
        if (courseName.startsWith(prefix)) {
          return prefix;
        }
      }
      return null;
    };
    
    const courseStatus: Record<string, { 
      hasStudent: boolean; 
      hasQuiz: boolean; 
      originalCourses: string[];
      isMerged: boolean;
    }> = {};
    
    parsedFiles.forEach(file => {
      if (!file.courseName) return;
      
      const courseName = file.courseName.trim();
      const coursePrefix = getCoursePrefixForFile(courseName, coursePrefixes);
      const finalCourseName = coursePrefix || courseName;
      
      if (!courseStatus[finalCourseName]) {
        courseStatus[finalCourseName] = { 
          hasStudent: false, 
          hasQuiz: false, 
          originalCourses: [],
          isMerged: coursePrefix !== null
        };
      }
      
      if (file.type === 'student') {
        courseStatus[finalCourseName].hasStudent = true;
      } else if (file.type === 'quiz') {
        courseStatus[finalCourseName].hasQuiz = true;
      }
    });
    
    return courseStatus;
  };

  const courseStatus = getCourseCompleteness();
  const completeCoursesCount = Object.values(courseStatus).filter(
    status => status.hasStudent && status.hasQuiz
  ).length;

  return (
    <div className={cn('', className)}>
      <Alert className="mb-4 bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800">
        <Info className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <AlertDescription className="text-sm">
          <p className="font-medium">File Format & Course Merging</p>
          <p className="text-xs mt-1">
            Name files: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">[coursename]_students.csv</code> for student data, 
            <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded ml-1">[coursename]_quiz_scores.csv</code> for quiz data
          </p>
          <p className="text-xs mt-1">
            Similar courses like <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">aifi_301</code>, 
            <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded ml-1">aifi_302</code> will be automatically merged
          </p>
        </AlertDescription>
      </Alert>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.txt,.xlsx,.xls"
        multiple
        className="hidden"
      />

      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 transition-all duration-200 bg-slate-50/50 dark:bg-slate-900/20',
          isDragging 
            ? 'border-brand-400 bg-brand-50/30 dark:bg-brand-900/10' 
            : 'border-slate-200 dark:border-slate-800',
          'hover:border-brand-300 hover:bg-brand-50/20 dark:hover:bg-brand-900/5',
          'cursor-pointer animate-fade-in'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <p className="text-base font-medium text-slate-900 dark:text-slate-200">
              Drag and drop your student and quiz files
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              or click to browse (CSV, TXT, XLSX, or XLS format)
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              You'll need both student and quiz files for each course
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-200">
              Uploaded Files ({files.length})
            </h4>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFiles}
              className="text-xs text-slate-500 hover:text-red-500"
            >
              Clear All
            </Button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {files.map((file, index) => {
              const fileCourseName = parsedFiles[index]?.courseName || '';
              const courseInfo = Object.entries(courseStatus).find(
                ([key, value]) => key === fileCourseName || 
                                 (value.isMerged && value.originalCourses.includes(fileCourseName))
              );
              
              const mergedCourseName = courseInfo ? courseInfo[0] : fileCourseName;
              const isComplete = mergedCourseName && 
                courseStatus[mergedCourseName]?.hasStudent && 
                courseStatus[mergedCourseName]?.hasQuiz;
              
              const isMerged = courseInfo ? courseInfo[1].isMerged : false;
              
              return (
                <div 
                  key={index} 
                  className="border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/20 animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center text-brand-600 dark:text-brand-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate max-w-[180px] sm:max-w-xs">
                          {file.name}
                        </p>
                        <div className="flex items-center mt-1 flex-wrap gap-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                          {parsedFiles[index] && (
                            <Badge variant={parsedFiles[index].type === 'student' ? 'default' : 'secondary'} className="text-xs">
                              {parsedFiles[index].type === 'student' ? 'Student Data' : 'Quiz Scores'}
                            </Badge>
                          )}
                          {fileCourseName && (
                            <div className="flex items-center">
                              {isMerged ? (
                                <Badge variant="outline" className="text-xs">
                                  {fileCourseName}
                                  <span className="ml-1 text-brand-500 font-medium">→</span>
                                  <span className="ml-1 text-brand-600 font-medium">{mergedCourseName}</span>
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  {fileCourseName}
                                </span>
                              )}
                              {isComplete && (
                                <span className="ml-1 text-green-500">
                                  <Check className="inline-block w-3 h-3" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-3 text-sm">
            <p className="text-slate-600 dark:text-slate-400">
              Courses with complete data: {completeCoursesCount} of {Object.keys(courseStatus).length}
            </p>
            
            {Object.entries(courseStatus).some(([_, info]) => info.isMerged) && (
              <div className="mt-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-xs">
                <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Merged Course Groups:</p>
                <div className="space-y-1">
                  {Object.entries(courseStatus)
                    .filter(([_, info]) => info.isMerged && info.originalCourses.length > 0)
                    .map(([mergedName, info]) => (
                      <div key={mergedName} className="flex items-center">
                        <Badge variant="outline" className="mr-2">{mergedName}</Badge>
                        <span className="text-slate-600 dark:text-slate-400">
                          {info.originalCourses.join(', ')}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {completeCoursesCount === 0 && files.length > 1 && Object.keys(courseStatus).length > 0 && (
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                Upload both student and quiz files for at least one course to process data
              </p>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center mt-4">
          <div className="w-5 h-5 border-2 border-t-brand-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mr-2" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Processing files...</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
