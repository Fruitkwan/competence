-- Employee course enrollment/attendance tracking
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS employee_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  course_id UUID NOT NULL REFERENCES courses(id),
  status TEXT DEFAULT 'Enrolled' CHECK (status IN ('Enrolled','In Progress','Completed','Dropped')),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score NUMERIC,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, course_id)
);

ALTER TABLE employee_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select_employee_courses" ON employee_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_employee_courses" ON employee_courses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_employee_courses" ON employee_courses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_employee_courses" ON employee_courses FOR DELETE TO authenticated USING (true);

-- Seed: assign some courses to demo employees
INSERT INTO employee_courses (employee_id, course_id, status, enrolled_at, started_at, completed_at, score) VALUES
  ('DG-001', (SELECT id FROM courses WHERE title = 'Advanced Financial Modeling' LIMIT 1), 'Completed', now() - interval '60 days', now() - interval '55 days', now() - interval '10 days', 92),
  ('DG-001', (SELECT id FROM courses WHERE title = 'Growth Mindset Workshop' LIMIT 1), 'In Progress', now() - interval '14 days', now() - interval '7 days', NULL, NULL),
  ('DG-001', (SELECT id FROM courses WHERE title = 'Leadership Essentials' LIMIT 1), 'Enrolled', now() - interval '3 days', NULL, NULL, NULL),
  ('DG-002', (SELECT id FROM courses WHERE title = 'Leadership Essentials' LIMIT 1), 'Completed', now() - interval '90 days', now() - interval '85 days', now() - interval '30 days', 88),
  ('DG-002', (SELECT id FROM courses WHERE title = 'Agile Project Management' LIMIT 1), 'In Progress', now() - interval '20 days', now() - interval '15 days', NULL, NULL),
  ('DG-004', (SELECT id FROM courses WHERE title = 'Agile Project Management' LIMIT 1), 'Completed', now() - interval '45 days', now() - interval '40 days', now() - interval '5 days', 95),
  ('DG-004', (SELECT id FROM courses WHERE title = 'Growth Mindset Workshop' LIMIT 1), 'Enrolled', now() - interval '2 days', NULL, NULL, NULL),
  ('DG-005', (SELECT id FROM courses WHERE title = 'Customer-Centric Selling' LIMIT 1), 'Completed', now() - interval '30 days', now() - interval '28 days', now() - interval '3 days', 85)
ON CONFLICT DO NOTHING;
