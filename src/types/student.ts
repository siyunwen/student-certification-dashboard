
export interface Student {
  id: string;
  name: string;
  email: string;
  score: number;
  courseCompleted: boolean;
  enrollmentDate: string;
  lastActivityDate: string;
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
