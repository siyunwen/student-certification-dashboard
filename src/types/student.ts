
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email?: string;
  score: number;
  quizScores?: QuizScore[];
  lastActivityDate?: string;
  enrollmentDate?: string;
  courseName?: string;
  courseCompleted: boolean;
  allCourses?: string[]; // Tracks all courses a student is enrolled in
  allQuizzesCompleted?: boolean; // Tracks if student has completed all required quizzes
  requiredQuizCount?: number; // Stores how many quizzes are required for the course
}

export interface QuizScore {
  quizName: string;
  score: number | null;
  completedAt?: string;
}

export interface CertificationSettings {
  passThreshold: number;
  dateSince: string | null;
}

export interface CertificationStats {
  totalStudents: number;
  eligibleStudents: number;
  averageScore: number;
  passRate: number;
  courseAverages?: { coursePrefix: string; avgScore: number }[];
}

export interface CourseData {
  isComplete: boolean;
  studentFile?: ParsedFile;
  quizFile?: ParsedFile;
}

export interface ParsedFile {
  courseName: string;
  type: 'student' | 'quiz';
  data: any[];
}
