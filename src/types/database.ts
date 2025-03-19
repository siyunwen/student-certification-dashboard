
// This file defines types used for the frontend-only version of the application
// These types represent the data structure used in local storage

export type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  enrollment_date: string;
  last_activity_date: string;
  course_id: string;
  course_name: string; // Added to store course name directly
}

export type CourseRecord = {
  id: string;
  name: string;
  created_at: string;
}

export type QuizRecord = {
  id: string;
  student_id: string;
  student_name?: string; // Added to help with matching
  student_email?: string; // Added to help with matching
  quiz_name: string;
  score: number;
  completed_at: string;
  course_id: string;
  course_name: string; // Added to store course name directly
}

export type CertificationSettingsRecord = {
  id: string;
  pass_threshold: number;
  date_since: string | null;
  created_at: string;
  updated_at: string;
}
