-- =============================================================
-- DHOFAR GLOBAL TRAINING MATRIX — FULL DATABASE SETUP
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================

-- ===================== CUSTOM TYPES =====================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'manager', 'employee', 'executive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===================== PROFILES =====================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role app_role DEFAULT 'employee',
  employee_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'employee')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===================== REFERENCE TABLES =====================

CREATE TABLE IF NOT EXISTS clusters (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competency_levels (
  label TEXT PRIMARY KEY,
  numeric_value INTEGER NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS gap_codes (
  code TEXT PRIMARY KEY,
  dimension TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS training_modes (
  name TEXT PRIMARY KEY
);

-- ===================== CORE TABLES =====================

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  develops TEXT,
  cluster_fit TEXT[] DEFAULT '{}',
  link TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_rules (
  cluster TEXT NOT NULL REFERENCES clusters(name),
  gap_code TEXT NOT NULL REFERENCES gap_codes(code),
  course_id UUID NOT NULL REFERENCES courses(id),
  training_mode TEXT NOT NULL REFERENCES training_modes(name),
  PRIMARY KEY (cluster, gap_code, course_id)
);

CREATE TABLE IF NOT EXISTS roles (
  title TEXT PRIMARY KEY,
  cluster TEXT NOT NULL REFERENCES clusters(name),
  kpi_linked TEXT,
  required_level TEXT NOT NULL REFERENCES competency_levels(label),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  employee_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  country_code TEXT REFERENCES countries(code),
  manager_name TEXT,
  email TEXT,
  user_id UUID REFERENCES auth.users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  appraisal_date DATE NOT NULL,
  required_level TEXT NOT NULL REFERENCES competency_levels(label),
  knowledge TEXT NOT NULL REFERENCES competency_levels(label),
  skill TEXT NOT NULL REFERENCES competency_levels(label),
  behaviour TEXT NOT NULL REFERENCES competency_levels(label),
  desire TEXT NOT NULL REFERENCES competency_levels(label),
  attitude TEXT NOT NULL REFERENCES competency_levels(label),
  training_start DATE,
  target_completion DATE,
  actual_completion DATE,
  status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Completed','Cancelled')),
  reassessment_avg NUMERIC,
  evidence_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS rollout_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase INTEGER NOT NULL,
  phase_name TEXT NOT NULL,
  action TEXT NOT NULL,
  responsible TEXT,
  target_date DATE,
  tool_notes TEXT,
  status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Completed','Blocked')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================== PERFORMANCE APPRAISALS =====================

CREATE TABLE IF NOT EXISTS performance_appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  manager_id TEXT REFERENCES employees(employee_id),
  department TEXT,
  business_unit TEXT,
  location TEXT,
  appraisal_period TEXT,
  appraisal_type TEXT CHECK (appraisal_type IN ('Annual','Mid-Year','Probation','Exit')),
  document_ref TEXT,
  goals JSONB DEFAULT '[]',
  core_competencies JSONB DEFAULT '{}',
  leadership JSONB DEFAULT '{}',
  leadership_applicable BOOLEAN DEFAULT true,
  values_culture JSONB DEFAULT '{}',
  feedback_n1 JSONB DEFAULT '{}',
  feedback_n2 JSONB DEFAULT '{}',
  development_plan JSONB DEFAULT '[]',
  next_period_goals JSONB DEFAULT '[]',
  score_a_n1 NUMERIC, score_a_n2 NUMERIC,
  score_b_n1 NUMERIC, score_b_n2 NUMERIC,
  score_c_n1 NUMERIC, score_c_n2 NUMERIC,
  score_d_n1 NUMERIC, score_d_n2 NUMERIC,
  total_weighted_score NUMERIC,
  final_rating INTEGER CHECK (final_rating BETWEEN 1 AND 5),
  calibrated_rating INTEGER CHECK (calibrated_rating BETWEEN 1 AND 5),
  calibration_rationale TEXT,
  overall_label TEXT,
  recommended_action TEXT,
  employee_comments TEXT,
  employee_signed_at TIMESTAMPTZ,
  manager_signed_at TIMESTAMPTZ,
  hr_signed_at TIMESTAMPTZ,
  hr_representative TEXT,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft','N1 Complete','N2 Complete','Final','Archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- ===================== AUDIT LOG =====================

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ DEFAULT now(),
  actor UUID,
  actor_email TEXT,
  table_name TEXT NOT NULL,
  row_pk TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  before JSONB,
  after JSONB
);

-- ===================== RLS POLICIES =====================

ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE gap_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (simplify for now)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clusters','countries','competency_levels','gap_codes','training_modes',
    'courses','course_rules','roles','employees','appraisals',
    'rollout_tasks','performance_appraisals','audit_log'
  ]) LOOP
    EXECUTE format('CREATE POLICY "auth_select_%s" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "auth_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "auth_update_%s" ON %I FOR UPDATE TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON %I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- ===================== VIEW: appraisal_full =====================

CREATE OR REPLACE VIEW appraisal_full AS
SELECT
  a.*,
  cl_k.numeric_value AS k_num,
  cl_s.numeric_value AS s_num,
  cl_b.numeric_value AS b_num,
  cl_d.numeric_value AS d_num,
  cl_a.numeric_value AS a_num,
  cl_req.numeric_value AS required_numeric,
  ROUND(
    (cl_k.numeric_value + cl_s.numeric_value + cl_b.numeric_value +
     cl_d.numeric_value + cl_a.numeric_value) / 5.0, 2
  ) AS current_avg,
  ROUND(
    cl_req.numeric_value -
    (cl_k.numeric_value + cl_s.numeric_value + cl_b.numeric_value +
     cl_d.numeric_value + cl_a.numeric_value) / 5.0, 2
  ) AS gap,
  CASE
    WHEN LEAST(cl_k.numeric_value, cl_s.numeric_value, cl_b.numeric_value,
               cl_d.numeric_value, cl_a.numeric_value) = cl_k.numeric_value THEN 'K'
    WHEN LEAST(cl_k.numeric_value, cl_s.numeric_value, cl_b.numeric_value,
               cl_d.numeric_value, cl_a.numeric_value) = cl_s.numeric_value THEN 'S'
    WHEN LEAST(cl_k.numeric_value, cl_s.numeric_value, cl_b.numeric_value,
               cl_d.numeric_value, cl_a.numeric_value) = cl_b.numeric_value THEN 'B'
    WHEN LEAST(cl_k.numeric_value, cl_s.numeric_value, cl_b.numeric_value,
               cl_d.numeric_value, cl_a.numeric_value) = cl_d.numeric_value THEN 'D'
    ELSE 'A'
  END AS dominant_gap_code,
  CASE
    WHEN cl_req.numeric_value -
         (cl_k.numeric_value + cl_s.numeric_value + cl_b.numeric_value +
          cl_d.numeric_value + cl_a.numeric_value) / 5.0 >= 1.5 THEN 'HIGH'
    WHEN cl_req.numeric_value -
         (cl_k.numeric_value + cl_s.numeric_value + cl_b.numeric_value +
          cl_d.numeric_value + cl_a.numeric_value) / 5.0 >= 0.5 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS priority,
  CASE
    WHEN a.target_completion IS NOT NULL AND a.actual_completion IS NULL
         AND a.target_completion < CURRENT_DATE THEN
      (CURRENT_DATE - a.target_completion)
    ELSE NULL
  END AS overdue_days,
  e.full_name,
  e.job_title,
  e.country_code,
  e.manager_name,
  r.cluster,
  r.kpi_linked,
  cr.course_id AS recommended_course_id,
  c.title AS recommended_course,
  cr.training_mode,
  CASE
    WHEN a.target_completion IS NOT NULL AND a.actual_completion IS NULL
         AND a.target_completion < CURRENT_DATE THEN true
    ELSE false
  END AS overdue
FROM appraisals a
JOIN employees e ON e.employee_id = a.employee_id
LEFT JOIN roles r ON r.title = e.job_title
LEFT JOIN competency_levels cl_k ON cl_k.label = a.knowledge
LEFT JOIN competency_levels cl_s ON cl_s.label = a.skill
LEFT JOIN competency_levels cl_b ON cl_b.label = a.behaviour
LEFT JOIN competency_levels cl_d ON cl_d.label = a.desire
LEFT JOIN competency_levels cl_a ON cl_a.label = a.attitude
LEFT JOIN competency_levels cl_req ON cl_req.label = a.required_level
LEFT JOIN LATERAL (
  SELECT cr2.course_id, cr2.training_mode
  FROM course_rules cr2
  WHERE cr2.cluster = r.cluster
    AND cr2.gap_code = (
      CASE
        WHEN LEAST(cl_k.numeric_value, cl_s.numeric_value, cl_b.numeric_value,
                   cl_d.numeric_value, cl_a.numeric_value) = cl_k.numeric_value THEN 'K'
        WHEN LEAST(cl_k.numeric_value, cl_s.numeric_value, cl_b.numeric_value,
                   cl_d.numeric_value, cl_a.numeric_value) = cl_s.numeric_value THEN 'S'
        WHEN LEAST(cl_k.numeric_value, cl_s.numeric_value, cl_b.numeric_value,
                   cl_d.numeric_value, cl_a.numeric_value) = cl_b.numeric_value THEN 'B'
        WHEN LEAST(cl_k.numeric_value, cl_s.numeric_value, cl_b.numeric_value,
                   cl_d.numeric_value, cl_a.numeric_value) = cl_d.numeric_value THEN 'D'
        ELSE 'A'
      END)
  LIMIT 1
) cr ON true
LEFT JOIN courses c ON c.id = cr.course_id;

-- ===================== SEED DATA =====================

-- Competency levels
INSERT INTO competency_levels (label, numeric_value, description) VALUES
  ('Gap', 1, 'Does not meet requirements'),
  ('Developing', 2, 'Partially meets requirements'),
  ('Competent', 3, 'Meets all requirements'),
  ('Expert', 4, 'Exceeds requirements')
ON CONFLICT DO NOTHING;

-- Gap codes
INSERT INTO gap_codes (code, dimension, description) VALUES
  ('K', 'Knowledge', 'Knowledge gap'),
  ('S', 'Skill', 'Skill gap'),
  ('B', 'Behaviour', 'Behaviour gap'),
  ('D', 'Desire', 'Desire / motivation gap'),
  ('A', 'Attitude', 'Attitude gap')
ON CONFLICT DO NOTHING;

-- Training modes
INSERT INTO training_modes (name) VALUES
  ('Classroom'), ('Online'), ('On-the-Job'), ('Coaching'), ('Self-Study')
ON CONFLICT DO NOTHING;

-- Clusters
INSERT INTO clusters (name) VALUES
  ('Finance'), ('Operations'), ('HR'), ('Engineering'), ('Marketing'), ('Sales')
ON CONFLICT DO NOTHING;

-- Countries
INSERT INTO countries (code, name) VALUES
  ('OM', 'Oman'), ('AE', 'UAE'), ('SA', 'Saudi Arabia'), ('BH', 'Bahrain'), ('KW', 'Kuwait'), ('QA', 'Qatar')
ON CONFLICT DO NOTHING;

-- Roles
INSERT INTO roles (title, cluster, required_level) VALUES
  ('Senior Financial Analyst', 'Finance', 'Expert'),
  ('Operations Manager', 'Operations', 'Expert'),
  ('HR Business Partner', 'HR', 'Competent'),
  ('Software Engineer', 'Engineering', 'Competent'),
  ('Marketing Lead', 'Marketing', 'Expert')
ON CONFLICT DO NOTHING;

-- Employees (5 demo)
INSERT INTO employees (employee_id, full_name, job_title, country_code, manager_name, email) VALUES
  ('DG-001', 'Fatima Al-Rashidi', 'Senior Financial Analyst', 'OM', 'Ahmed Al-Balushi', 'fatima@dhofarglobal.com'),
  ('DG-002', 'Ahmed Al-Balushi', 'Operations Manager', 'OM', NULL, 'ahmed@dhofarglobal.com'),
  ('DG-003', 'Sara Khalfan', 'HR Business Partner', 'AE', 'Ahmed Al-Balushi', 'sara@dhofarglobal.com'),
  ('DG-004', 'Mohammed Al-Habsi', 'Software Engineer', 'OM', 'Ahmed Al-Balushi', 'mohammed@dhofarglobal.com'),
  ('DG-005', 'Layla Al-Hinai', 'Marketing Lead', 'OM', 'Ahmed Al-Balushi', 'layla@dhofarglobal.com')
ON CONFLICT DO NOTHING;

-- Sample appraisals
INSERT INTO appraisals (employee_id, appraisal_date, required_level, knowledge, skill, behaviour, desire, attitude, status) VALUES
  ('DG-001', '2025-03-15', 'Expert', 'Competent', 'Expert', 'Competent', 'Expert', 'Expert', 'Completed'),
  ('DG-002', '2025-03-15', 'Expert', 'Expert', 'Expert', 'Competent', 'Competent', 'Expert', 'In Progress'),
  ('DG-003', '2025-03-20', 'Competent', 'Competent', 'Developing', 'Competent', 'Competent', 'Competent', 'Not Started'),
  ('DG-004', '2025-04-01', 'Competent', 'Developing', 'Competent', 'Competent', 'Expert', 'Competent', 'In Progress'),
  ('DG-005', '2025-04-01', 'Expert', 'Competent', 'Competent', 'Expert', 'Competent', 'Developing', 'Not Started')
ON CONFLICT DO NOTHING;

-- Sample rollout tasks
INSERT INTO rollout_tasks (phase, phase_name, action, responsible, target_date, status, sort_order) VALUES
  (1, 'Foundation', 'Finalize competency framework', 'HR Team', '2025-05-01', 'Completed', 1),
  (1, 'Foundation', 'Set up Supabase database & roles', 'IT', '2025-05-15', 'Completed', 2),
  (2, 'Pilot', 'Run pilot appraisals (Finance)', 'Finance Manager', '2025-06-01', 'In Progress', 3),
  (2, 'Pilot', 'Collect feedback from pilot group', 'HR Team', '2025-06-15', 'Not Started', 4),
  (3, 'Rollout', 'Company-wide rollout', 'HR Director', '2025-07-01', 'Not Started', 5),
  (3, 'Rollout', 'Manager training on appraisal tool', 'L&D', '2025-07-15', 'Not Started', 6)
ON CONFLICT DO NOTHING;

-- Courses
INSERT INTO courses (title, develops, cluster_fit, link) VALUES
  ('Advanced Financial Modeling', 'K', ARRAY['Finance'], 'https://example.com/fin-model'),
  ('Leadership Essentials', 'B', ARRAY['Operations','HR','Marketing'], 'https://example.com/leadership'),
  ('Agile Project Management', 'S', ARRAY['Engineering','Operations'], 'https://example.com/agile'),
  ('Customer-Centric Selling', 'S', ARRAY['Sales','Marketing'], 'https://example.com/selling'),
  ('Growth Mindset Workshop', 'D', ARRAY['HR','Engineering','Finance'], 'https://example.com/growth')
ON CONFLICT DO NOTHING;

-- ===================== DONE =====================
-- Now create your users:
-- 1. Go to Authentication → Users → Add User
-- 2. Create users with email/password
-- 3. Then update their roles below (replace the UUIDs)
--
-- Example (run after creating users):
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@dhofarglobal.com';
-- UPDATE profiles SET role = 'manager' WHERE email = 'manager@dhofarglobal.com';
-- UPDATE profiles SET role = 'employee' WHERE email = 'employee@dhofarglobal.com';
