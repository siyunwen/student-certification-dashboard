
-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  enrollment_date DATE NOT NULL,
  last_activity_date DATE NOT NULL,
  course_id UUID REFERENCES courses(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) NOT NULL,
  quiz_name TEXT NOT NULL,
  score NUMERIC NOT NULL,
  completed_at DATE NOT NULL,
  course_id UUID REFERENCES courses(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create certification settings table
CREATE TABLE IF NOT EXISTS certification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pass_threshold NUMERIC NOT NULL,
  date_since DATE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create storage bucket for course files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('course-files', 'Course Files', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Authenticated users can upload course files" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'course-files');

CREATE POLICY "Authenticated users can read their own course files" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'course-files');
