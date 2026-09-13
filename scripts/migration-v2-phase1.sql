-- =============================================================
-- PERFORMANCE HUB v2 — PHASE 1.5 MIGRATION
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Idempotent: safe to re-run
-- =============================================================

-- ===================== 1. DEPARTMENTS =====================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES departments(id),
  head_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_departments" ON departments FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hr_admin_write_departments" ON departments FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hr_admin_update_departments" ON departments FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hr_admin_delete_departments" ON departments FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================== 2. ALTER PROFILES =====================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cluster TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ===================== 3. APPRAISAL CYCLES =====================
CREATE TABLE IF NOT EXISTS appraisal_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'bi_annual'
    CHECK (type IN ('annual','bi_annual','quarterly','probation')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  objective_deadline DATE,
  self_assessment_deadline DATE,
  manager_assessment_deadline DATE,
  calibration_deadline DATE,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','objective_setting','assessment','calibration','review','closed')),
  scoring_rubric JSONB DEFAULT '{"goals":40,"core_competencies":30,"leadership":20,"values_culture":10}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE appraisal_cycles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "all_read_cycles" ON appraisal_cycles FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hr_insert_cycles" ON appraisal_cycles FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "hr_update_cycles" ON appraisal_cycles FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add cycle_id to existing performance_appraisals
ALTER TABLE performance_appraisals ADD COLUMN IF NOT EXISTS cycle_id UUID;

-- Add FK only if it doesn't exist
DO $$ BEGIN
  ALTER TABLE performance_appraisals
    ADD CONSTRAINT fk_pa_cycle FOREIGN KEY (cycle_id) REFERENCES appraisal_cycles(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add cycle_id to existing appraisals (KSBDA)
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS cycle_id UUID;

DO $$ BEGIN
  ALTER TABLE appraisals
    ADD CONSTRAINT fk_appr_cycle FOREIGN KEY (cycle_id) REFERENCES appraisal_cycles(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================== 4. ORGANIZATION KPIs =====================
CREATE TABLE IF NOT EXISTS org_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL CHECK (level IN ('organization','department','team')),
  department_id UUID REFERENCES departments(id),
  weight NUMERIC(5,2) DEFAULT 0,
  target_value TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE org_kpis ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "all_read_kpis" ON org_kpis FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_exec_insert_kpis" ON org_kpis FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','executive')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_exec_update_kpis" ON org_kpis FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','executive')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_exec_delete_kpis" ON org_kpis FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','executive')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================== 5. CYCLE OBJECTIVES =====================
CREATE TABLE IF NOT EXISTS cycle_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id),
  kpi_id UUID REFERENCES org_kpis(id),
  title TEXT NOT NULL,
  description TEXT,
  success_criteria TEXT,
  weight NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','revision_requested','approved','rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cycle_objectives ENABLE ROW LEVEL SECURITY;

-- NOTE: "p.id = cycle_objectives.employee_id" uses explicit table qualification
-- because profiles also has an employee_id column (TEXT) which would cause
-- a uuid = text mismatch if unqualified.

DO $$ BEGIN
  CREATE POLICY "obj_select" ON cycle_objectives FOR SELECT TO authenticated
    USING (
      cycle_objectives.employee_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = cycle_objectives.employee_id AND p.manager_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','executive'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "obj_insert" ON cycle_objectives FOR INSERT TO authenticated
    WITH CHECK (cycle_objectives.employee_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "obj_update" ON cycle_objectives FOR UPDATE TO authenticated
    USING (
      cycle_objectives.employee_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = cycle_objectives.employee_id AND p.manager_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================== 6. OBJECTIVE COMMENTS =====================
CREATE TABLE IF NOT EXISTS objective_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES cycle_objectives(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE objective_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "comment_select" ON objective_comments FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM cycle_objectives o
        WHERE o.id = objective_comments.objective_id
        AND (
          o.employee_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = o.employee_id AND p.manager_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'))
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "comment_insert" ON objective_comments FOR INSERT TO authenticated
    WITH CHECK (objective_comments.author_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===================== 7. NOTIFICATIONS =====================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own_notifications_select" ON notifications FOR SELECT TO authenticated
    USING (notifications.user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "own_notifications_update" ON notifications FOR UPDATE TO authenticated
    USING (notifications.user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "system_notifications_insert" ON notifications FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, read, created_at DESC);

-- ===================== 8. HELPER FUNCTION =====================
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================== 9. AUDIT TRIGGER FOR NEW TABLES =====================
-- Reuse existing audit pattern for new tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'departments','appraisal_cycles','org_kpis',
    'cycle_objectives','objective_comments','notifications'
  ]) LOOP
    -- Create audit trigger function if it doesn't exist
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER audit_%s
         AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()',
        t, t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
              WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

-- ===================== SEED: SAMPLE DEPARTMENTS =====================
INSERT INTO departments (name) VALUES
  ('Finance'),
  ('Operations'),
  ('Human Resources'),
  ('Engineering'),
  ('Marketing'),
  ('Sales')
ON CONFLICT (name) DO NOTHING;

-- ===================== DONE =====================
-- Phase 1.5 migration complete.
-- Next: Update profiles for existing users with manager_id and department_id.
