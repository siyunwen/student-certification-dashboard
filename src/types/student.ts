
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  score: number;
  quizScores: {
    quizName: string;
    score: number;
  }[];
  courseCompleted: boolean;
  enrollmentDate: string;
  lastActivityDate: string;
  courseName: string;
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
}

export interface ParsedFile {
  type: 'student' | 'quiz';
  courseName: string;
  data: any[];
}

