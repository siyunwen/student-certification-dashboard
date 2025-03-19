
// This file is kept for compatibility, but we no longer use database-specific types
// in the frontend-only version of the application
export type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  enrollment_date: string;
  last_activity_date: string;
  course_id: string;
}

export type CourseRecord = {
  id: string;
  name: string;
  created_at: string;
}

export type QuizRecord = {
  id: string;
  student_id: string;
  quiz_name: string;
  score: number;
  completed_at: string;
  course_id: string;
}

export type CertificationSettingsRecord = {
  id: string;
  pass_threshold: number;
  date_since: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}
