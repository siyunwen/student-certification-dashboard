
import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FileUploadProps {
  onFileLoaded: (content: string) => void;
  className?: string;
}

const FileUpload = ({ onFileLoaded, className }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file) return;
    
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('Please upload a CSV or TXT file');
      return;
    }
    
    setFile(file);
    setIsLoading(true);
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        onFileLoaded(content);
        toast.success('File uploaded successfully');
      } catch (error) {
        toast.error('Failed to process file');
        console.error('Error processing file:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsLoading(false);
    };
    
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('', className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.txt"
        className="hidden"
      />

      {!file ? (
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
                Drag and drop your student data file
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                or click to browse (CSV or TXT format)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/20 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center text-brand-600 dark:text-brand-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-t-brand-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
