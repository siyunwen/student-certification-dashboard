
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import DashboardCard from '@/components/DashboardCard';
import FileUpload from '@/components/FileUpload';
import CertificationSettings from '@/components/CertificationSettings';
import StudentTable from '@/components/StudentTable';
import AnimatedNumber from '@/components/AnimatedNumber';
import { Student, CertificationSettings as SettingsType, CertificationStats } from '@/types/student';
import { parseCSVData, calculateCertificationStats, getEligibleStudents } from '@/utils/certificationUtils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Award, Users, BarChart, TrendingUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const COLORS = ['#2563eb', '#e5e7eb'];

const Index = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<SettingsType>({
    passThreshold: 70,
    dateSince: null
  });
  const [stats, setStats] = useState<CertificationStats>({
    totalStudents: 0,
    eligibleStudents: 0,
    averageScore: 0,
    passRate: 0
  });
  
  // Recalculate stats when students or settings change
  useEffect(() => {
    setStats(calculateCertificationStats(students, settings));
  }, [students, settings]);
  
  const handleFileLoaded = (content: string) => {
    try {
      const parsedStudents = parseCSVData(content);
      setStudents(parsedStudents);
      
      if (parsedStudents.length === 0) {
        toast.warning('No student data could be extracted from the file');
      } else {
        toast.success(`Loaded ${parsedStudents.length} students successfully`);
      }
    } catch (error) {
      console.error('Error parsing CSV data:', error);
      toast.error('Failed to parse the file. Please check the format.');
    }
  };
  
  const generateReport = () => {
    const eligibleStudents = getEligibleStudents(students, settings);
    
    // Create CSV content
    const headers = ['Name', 'Email', 'Score', 'Enrollment Date', 'Last Activity Date'];
    const rows = eligibleStudents.map(student => [
      student.name,
      student.email,
      student.score,
      student.enrollmentDate,
      student.lastActivityDate
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
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
  
  // Generate chart data
  const chartData = [
    { name: 'Eligible', value: stats.eligibleStudents },
    { name: 'Not Eligible', value: stats.totalStudents - stats.eligibleStudents }
  ];
  
  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="bg-gradient-to-b from-brand-50 to-white dark:from-slate-900 dark:to-slate-900/60 border-b border-slate-100 dark:border-slate-800">
        <div className="page-container">
          <DashboardHeader
            title="Student Certification Dashboard"
            description="Upload student data, customize certification criteria, and view eligible students"
          >
            {students.length > 0 && (
              <Button
                className="flex items-center gap-2"
                onClick={generateReport}
                variant="default"
              >
                <Download className="h-4 w-4" />
                Export Eligible Students
              </Button>
            )}
          </DashboardHeader>
        </div>
      </div>
      
      <main className="page-container">
        {/* Setup Section */}
        <section className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-8">
          <DashboardCard 
            title="1. Upload Student Data" 
            subtitle="Upload a CSV file with student information"
            chip="Step 1"
          >
            <FileUpload onFileLoaded={handleFileLoaded} />
          </DashboardCard>
          
          <DashboardCard 
            title="2. Certification Settings" 
            subtitle="Customize eligibility criteria"
            chip="Step 2"
          >
            <CertificationSettings 
              settings={settings} 
              onSettingsChange={setSettings} 
            />
          </DashboardCard>
        </section>
        
        {/* Stats Section - Visible only when students are loaded */}
        {students.length > 0 && (
          <section className="section mt-8">
            <h2 className="section-title">Certification Overview</h2>
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
        
        {/* Chart and Table Section - Visible only when students are loaded */}
        {students.length > 0 && (
          <>
            <section className="section mt-8">
              <h2 className="section-title">Certification Distribution</h2>
              <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                <DashboardCard className="md:col-span-1 h-[300px] flex flex-col justify-center">
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
                
                <DashboardCard className="md:col-span-2">
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
            
            <section className="section mt-8 mb-16">
              <h2 className="section-title">Eligible Students</h2>
              <DashboardCard>
                <StudentTable 
                  students={students} 
                  passThreshold={settings.passThreshold} 
                />
              </DashboardCard>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
