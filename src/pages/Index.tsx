import React, { useState, useEffect } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import DashboardCard from '@/components/DashboardCard';
import FileUpload from '@/components/FileUpload';
import CertificationSettings from '@/components/CertificationSettings';
import StudentTable from '@/components/StudentTable';
import AnimatedNumber from '@/components/AnimatedNumber';
import { Student, CertificationSettings as SettingsType, CertificationStats, ParsedFile } from '@/types/student';
import { 
  calculateCertificationStats,
  getEligibleStudents
} from '@/utils/certificationUtils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Award, Users, BarChart, TrendingUp, Download, BookOpen, FileUp, Eye, Info, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { fetchStudents, saveCertificationSettings, fetchCertificationSettings, clearStoredData } from '@/services/localStorageService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const COLORS = ['#2563eb', '#e5e7eb'];

const Index = () => {
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [settings, setSettings] = useState<SettingsType>({
    passThreshold: 70,
    dateSince: null
  });
  const [showResults, setShowResults] = useState(false);
  
  const queryClient = useQueryClient();
  
  const courseGroups = parsedFiles.reduce((groups: Record<string, {hasStudent: boolean, hasQuiz: boolean}>, file) => {
    if (!file.courseName) return groups;
    
    if (!groups[file.courseName]) {
      groups[file.courseName] = { hasStudent: false, hasQuiz: false };
    }
    
    if (file.type === 'student') {
      groups[file.courseName].hasStudent = true;
    } else if (file.type === 'quiz') {
      groups[file.courseName].hasQuiz = true;
    }
    
    return groups;
  }, {});
  
  const completeCoursesCount = Object.values(courseGroups).filter(course => course.hasStudent && course.hasQuiz).length;
  const courseNames = Object.keys(courseGroups).filter(name => courseGroups[name].hasStudent && courseGroups[name].hasQuiz);

  const { data: students = [], isLoading: isLoadingStudents, error: studentError } = useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents
  });

  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['certificationSettings'],
    queryFn: fetchCertificationSettings
  });

  const { mutate: updateSettings } = useMutation({
    mutationFn: saveCertificationSettings,
    onSuccess: () => {
      toast.success('Settings saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save settings');
      console.error('Error saving settings:', error);
    }
  });

  const { mutate: clearData } = useMutation({
    mutationFn: clearStoredData,
    onSuccess: () => {
      toast.success('All data cleared successfully');
      setParsedFiles([]);
      setShowResults(false);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['certificationSettings'] });
    },
    onError: (error) => {
      toast.error('Failed to clear data');
      console.error('Error clearing data:', error);
    }
  });

  const stats = calculateCertificationStats(students, settings);

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  const handleFilesLoaded = (files: ParsedFile[]) => {
    setParsedFiles(files);
    if (files.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    }
  };

  const handleSettingsChange = (newSettings: SettingsType) => {
    setSettings(newSettings);
    updateSettings(newSettings);
  };

  const generateReport = () => {
    const eligibleStudents = getEligibleStudents(students, settings);
    
    const emailGroups = eligibleStudents.reduce((groups: Record<string, Student[]>, student) => {
      const email = student.email?.toLowerCase() || '';
      if (!groups[email]) {
        groups[email] = [];
      }
      groups[email].push(student);
      return groups;
    }, {});
    
    const headers = ['First Name', 'Last Name', 'Email', 'Average Score', 'Last Activity Date', 'Courses'];
    const rows = Object.values(emailGroups).map(studentGroup => {
      const firstStudent = studentGroup[0];
      const courseNames = Array.from(new Set(studentGroup.map(s => s.courseName))).filter(Boolean).join(', ');
      
      const totalScore = studentGroup.reduce((sum, s) => sum + (s.score || 0), 0);
      const avgScore = (totalScore / studentGroup.length).toFixed(1);
      
      return [
        firstStudent.firstName,
        firstStudent.lastName,
        firstStudent.email,
        avgScore,
        firstStudent.lastActivityDate,
        courseNames
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `eligible-students-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Report downloaded successfully');
  };

  const handleShowResults = () => {
    if (completeCoursesCount === 0 && students.length === 0) {
      toast.info('Please upload files and process data first');
      return;
    }
    
    if (students.length === 0) {
      toast.info('No student data found. Please upload and process files first.');
      return;
    }
    
    setShowResults(true);
    
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleClearAllData = () => {
    if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      clearData();
    }
  };

  const chartData = [
    { name: 'Eligible', value: stats.eligibleStudents },
    { name: 'Not Eligible', value: stats.totalStudents - stats.eligibleStudents }
  ];

  if (studentError) {
    toast.error('Failed to load student data');
    console.error('Error loading students:', studentError);
  }
  
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-b from-brand-50 to-white dark:from-slate-900 dark:to-slate-900/60 border-b border-slate-100 dark:border-slate-800">
        <div className="page-container">
          <DashboardHeader
            title="Student Certification Dashboard"
            description="Upload student data files and quiz scores, customize certification criteria, and view eligible students"
          >
            {/* Removed the export button from here */}
          </DashboardHeader>
        </div>
      </div>
      
      <main className="page-container">
        {(isLoadingStudents || isLoadingSettings) && (
          <div className="my-8 flex justify-center">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 border-2 border-t-brand-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              <span className="text-slate-600">Loading data from local storage...</span>
            </div>
          </div>
        )}

        <section className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-8">
          <DashboardCard 
            title="1. Upload Course Files" 
            subtitle="Upload both student data and quiz scores files for each course"
            chip="Step 1"
          >
            <FileUpload onFilesLoaded={handleFilesLoaded} />
            
            {parsedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {parsedFiles.filter(f => f.type === 'student').length} Student {parsedFiles.filter(f => f.type === 'student').length === 1 ? 'File' : 'Files'}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <BarChart className="h-3 w-3" />
                  {parsedFiles.filter(f => f.type === 'quiz').length} Quiz {parsedFiles.filter(f => f.type === 'quiz').length === 1 ? 'File' : 'Files'}
                </Badge>
                {courseNames.length > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {courseNames.length} Complete {courseNames.length === 1 ? 'Course' : 'Courses'}
                  </Badge>
                )}
              </div>
            )}
          </DashboardCard>
          
          <DashboardCard 
            title="2. Certification Settings" 
            subtitle="Customize eligibility criteria"
            chip="Step 2"
          >
            <CertificationSettings 
              settings={settings} 
              onSettingsChange={handleSettingsChange} 
            />
          </DashboardCard>
        </section>
        
        <section className="mt-8 flex justify-center">
          <div className="w-full max-w-md flex flex-col gap-3">
            <Button 
              onClick={handleShowResults} 
              className="w-full py-6 text-lg"
              size="lg"
            >
              <Eye className="mr-2 h-5 w-5" />
              Show Certification Results
            </Button>
            
            {students.length > 0 && (
              <Button 
                onClick={handleClearAllData} 
                variant="outline"
                className="text-sm"
              >
                Clear All Data
              </Button>
            )}
          </div>
        </section>
        
        {showResults && (
          <div id="results-section">
            {students.length === 0 && (
              <section className="section mt-8 animate-fade-in">
                <DashboardCard>
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-4">
                      <FileUp className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">No Student Data Found</h3>
                    <p className="text-center text-slate-500 dark:text-slate-400 max-w-md mb-6">
                      Please upload your student and quiz files using the file uploader above to see certification results.
                    </p>
                    <Button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                      Go to File Upload
                    </Button>
                  </div>
                </DashboardCard>
              </section>
            )}
            
            {students.length > 0 && (
              <section className="section mt-8 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                  <h2 className="section-title">Certification Overview</h2>
                  
                  {stats.eligibleStudents > 0 && (
                    <Button
                      className="flex items-center gap-2 ml-0 mt-2 sm:mt-0"
                      onClick={generateReport}
                      variant="default"
                    >
                      <Download className="h-4 w-4" />
                      Export Eligible Students
                    </Button>
                  )}
                </div>
                
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                  <DashboardCard className="relative overflow-hidden">
                    <div className="absolute top-3 right-3 w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Students</p>
                    <h3 className="text-3xl font-semibold mt-1 mb-2 text-slate-900 dark:text-white">
                      <AnimatedNumber value={stats.totalStudents} />
                    </h3>
                  </DashboardCard>
                  
                  <DashboardCard className="relative overflow-hidden">
                    <div className="absolute top-3 right-3 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                      <Award className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Eligible Students</p>
                    <h3 className="text-3xl font-semibold mt-1 mb-2 text-slate-900 dark:text-white">
                      <AnimatedNumber value={stats.eligibleStudents} />
                    </h3>
                  </DashboardCard>
                  
                  <DashboardCard className="relative overflow-hidden">
                    <div className="absolute top-3 right-3 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <BarChart className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Average Score</p>
                    <h3 className="text-3xl font-semibold mt-1 mb-2 text-slate-900 dark:text-white">
                      <AnimatedNumber 
                        value={stats.averageScore} 
                        formatValue={(val) => `${val.toFixed(1)}%`} 
                      />
                    </h3>
                  </DashboardCard>
                  
                  <DashboardCard className="relative overflow-hidden">
                    <div className="absolute top-3 right-3 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pass Rate</p>
                    <h3 className="text-3xl font-semibold mt-1 mb-2 text-slate-900 dark:text-white">
                      <AnimatedNumber 
                        value={stats.passRate} 
                        formatValue={(val) => `${val.toFixed(1)}%`} 
                      />
                    </h3>
                  </DashboardCard>
                </div>
              </section>
            )}
            
            {students.length > 0 && (
              <>
                <section className="section mt-8 animate-fade-in">
                  <h2 className="section-title">Certification Distribution</h2>
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                    <DashboardCard className="md:col-span-1" fullHeight={true}>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              animationDuration={800}
                              animationBegin={0}
                              animationEasing="ease-out"
                            >
                              {chartData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={COLORS[index % COLORS.length]}
                                  className="animate-fade-in"
                                  fillOpacity={index === 0 ? 1 : 0.6}
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value) => [`${value} Students`, '']}
                              contentStyle={{
                                borderRadius: '0.5rem',
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                padding: '0.5rem 1rem',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center space-x-6">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-brand-600 mr-2"></div>
                          <span className="text-sm text-slate-600 dark:text-slate-400">Eligible</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-slate-300 mr-2"></div>
                          <span className="text-sm text-slate-600 dark:text-slate-400">Not Eligible</span>
                        </div>
                      </div>
                    </DashboardCard>
                    
                    <DashboardCard className="md:col-span-2" fullHeight={true}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Certification Summary</h3>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Passing Score</p>
                                <p className="text-xl font-semibold text-brand-600 dark:text-brand-400">
                                  {settings.passThreshold}%
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Eligible Students</p>
                                <p className="text-xl font-semibold text-brand-600 dark:text-brand-400">
                                  {stats.eligibleStudents} of {stats.totalStudents}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Average Score</p>
                              <p className="text-xl font-semibold">
                                {stats.averageScore.toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pass Rate</p>
                              <p className="text-xl font-semibold">
                                {stats.passRate.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          
                          {courseNames.length > 0 && (
                            <div className="pt-2">
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Courses</p>
                              <div className="flex flex-wrap gap-2">
                                {courseNames.map(course => (
                                  <Badge key={course} variant="secondary">
                                    {course}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {settings.dateSince && (
                            <div className="pt-2">
                              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 animate-fade-in">
                                <span>Filtered since {settings.dateSince}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </DashboardCard>
                  </div>
                </section>
                
                <section className="section mt-8 mb-16 animate-fade-in">
                  <h2 className="section-title">Student Details</h2>
                  <DashboardCard>
                    <StudentTable 
                      students={students} 
                      passThreshold={settings.passThreshold} 
                    />
                  </DashboardCard>
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
