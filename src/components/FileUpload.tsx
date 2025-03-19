
import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ParsedFile } from '@/types/student';
import { parseCSVData } from '@/utils/certificationUtils';
import { uploadAndProcessFiles } from '@/services/supabaseService';
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
  const [isUploading, setIsUploading] = useState(false);
  const [showFileFormatHelp, setShowFileFormatHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFiles = (newFiles: File[]) => {
    if (!newFiles.length) return;
    
    const validFiles = newFiles.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return extension === 'csv' || extension === 'txt' || extension === 'xlsx' || extension === 'xls';
    });
    
    if (validFiles.length !== newFiles.length) {
      toast.error('Some files were skipped. Please upload only CSV, TXT, XLSX or XLS files');
    }
    
    if (validFiles.length === 0) return;
    
    setFiles(prev => [...prev, ...validFiles]);
    setIsLoading(true);
    
    const filePromises = validFiles.map(file => {
      return new Promise<ParsedFile>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const parsedFile = parseCSVData(file.name, content);
            console.log(`File '${file.name}' parsed as course: '${parsedFile.courseName}'`);
            resolve(parsedFile);
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => {
          reject(new Error(`Failed to read file: ${file.name}`));
        };
        
        reader.readAsText(file);
      });
    });
    
    Promise.all(filePromises)
      .then(results => {
        const newParsedFiles = [...parsedFiles, ...results];
        setParsedFiles(newParsedFiles);
        onFilesLoaded(newParsedFiles);
        toast.success(`${validFiles.length} file(s) uploaded successfully`);
      })
      .catch(error => {
        toast.error('Failed to process one or more files');
        console.error('Error processing files:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      processFiles(droppedFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
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

  const getCourseCompleteness = () => {
    const courseStatus: Record<string, { hasStudent: boolean; hasQuiz: boolean }> = {};
    
    parsedFiles.forEach(file => {
      if (!file.courseName) return;
      
      if (!courseStatus[file.courseName]) {
        courseStatus[file.courseName] = { hasStudent: false, hasQuiz: false };
      }
      
      if (file.type === 'student') {
        courseStatus[file.courseName].hasStudent = true;
      } else if (file.type === 'quiz') {
        courseStatus[file.courseName].hasQuiz = true;
      }
    });
    
    return courseStatus;
  };

  const uploadToSupabase = async () => {
    const courseStatus = getCourseCompleteness();
    const completeCoursesCount = Object.values(courseStatus).filter(
      status => status.hasStudent && status.hasQuiz
    ).length;
    
    if (completeCoursesCount === 0) {
      toast.warning('Please upload both student and quiz files for at least one course');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const result = await uploadAndProcessFiles(parsedFiles);
      toast.success('Data successfully saved to Supabase!');
      onFilesLoaded(result.parsedFiles);
    } catch (error) {
      console.error('Error uploading to Supabase:', error);
      toast.error('Failed to save data to Supabase');
    } finally {
      setIsUploading(false);
    }
  };

  const courseStatus = getCourseCompleteness();
  const completeCoursesCount = Object.values(courseStatus).filter(
    status => status.hasStudent && status.hasQuiz
  ).length;

  return (
    <div className={cn('', className)}>
      <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-300">File Naming Format</p>
          <p className="text-amber-700 dark:text-amber-400 mt-1">
            For best results, name your files using this format:
          </p>
          <ul className="list-disc pl-5 mt-1 text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <li><span className="font-medium">Student data files:</span> <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">[coursename]_students.csv</code> (e.g., <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">aifi303_students.csv</code>)</li>
            <li><span className="font-medium">Quiz data files:</span> <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">[coursename]_quiz_scores.csv</code> (e.g., <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">aifi303_quiz_scores.csv</code>)</li>
          </ul>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
            The system will attempt to match student and quiz files for the same course based on the course name.
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
              const isComplete = fileCourseName && 
                courseStatus[fileCourseName]?.hasStudent && 
                courseStatus[fileCourseName]?.hasQuiz;
              
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
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                          {parsedFiles[index] && (
                            <Badge variant={parsedFiles[index].type === 'student' ? 'default' : 'secondary'} className="text-xs">
                              {parsedFiles[index].type === 'student' ? 'Student Data' : 'Quiz Scores'}
                            </Badge>
                          )}
                          {fileCourseName && (
                            <span className="text-xs ml-2 text-slate-500">
                              {fileCourseName}
                              {isComplete && (
                                <span className="ml-1 text-green-500">
                                  <Check className="inline-block w-3 h-3" />
                                </span>
                              )}
                            </span>
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
            {completeCoursesCount === 0 && files.length > 1 && Object.keys(courseStatus).length > 0 && (
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                Upload both student and quiz files for at least one course to process data
              </p>
            )}
            
            {completeCoursesCount > 0 && (
              <div className="mt-4">
                <Button 
                  onClick={uploadToSupabase}
                  className="w-full"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                      Saving to Supabase...
                    </>
                  ) : (
                    <>Save Data to Supabase</>
                  )}
                </Button>
              </div>
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
