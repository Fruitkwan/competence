-- =============================================================
-- PERFORMANCE HUB — ROLE DOCUMENT INTEGRATION
-- Run in Supabase SQL Editor after the base setup and v2 migration.
-- Idempotent: safe to re-run.
-- =============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Source files imported into the role catalogue.
CREATE TABLE IF NOT EXISTS document_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('job_descriptions','role_competencies_kpis','workflow','appraisal_form','other')),
  source_version TEXT,
  metadata JSONB DEFAULT '{}',
  imported_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_document_sources" ON document_sources
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_write_document_sources" ON document_sources
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Canonical role/job profile data enriched from the JD and workbook.
CREATE TABLE IF NOT EXISTS job_profiles (
  title TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  reports_to TEXT,
  role_purpose TEXT,
  responsibilities JSONB DEFAULT '[]',
  authority JSONB DEFAULT '[]',
  qualifications JSONB DEFAULT '{}',
  grade_band TEXT,
  salary_range TEXT,
  geographic_scope TEXT,
  active BOOLEAN DEFAULT true,
  source_id UUID REFERENCES document_sources(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_job_profiles" ON job_profiles
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_write_job_profiles" ON job_profiles
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_job_profiles_updated_at
    BEFORE UPDATE ON job_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reusable competency definitions. Role specificity lives in role_competencies.
CREATE TABLE IF NOT EXISTS competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Core',
  description TEXT,
  behavioral_indicators TEXT,
  source_id UUID REFERENCES document_sources(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (name, category)
);

ALTER TABLE competencies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_competencies" ON competencies
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_write_competencies" ON competencies
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_competencies_updated_at
    BEFORE UPDATE ON competencies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Role-specific competency expectations.
CREATE TABLE IF NOT EXISTS role_competencies (
  role_title TEXT NOT NULL REFERENCES job_profiles(title) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Core',
  required_level TEXT REFERENCES competency_levels(label),
  weight NUMERIC(5,2) DEFAULT 0,
  applicable BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (role_title, competency_id)
);

ALTER TABLE role_competencies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_role_competencies" ON role_competencies
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_write_role_competencies" ON role_competencies
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reusable role KPI library. Cycle KPIs can be seeded from these rows.
CREATE TABLE IF NOT EXISTS role_kpi_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_title TEXT NOT NULL REFERENCES job_profiles(title) ON DELETE CASCADE,
  department TEXT NOT NULL,
  title TEXT NOT NULL,
  measure TEXT,
  target TEXT,
  review_frequency TEXT,
  default_weight NUMERIC(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  source_id UUID REFERENCES document_sources(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (role_title, title)
);

ALTER TABLE role_kpi_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_role_kpi_templates" ON role_kpi_templates
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_write_role_kpi_templates" ON role_kpi_templates
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_role_kpi_templates_updated_at
    BEFORE UPDATE ON role_kpi_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Generated skill gaps from full performance appraisals.
CREATE TABLE IF NOT EXISTS skill_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id UUID REFERENCES performance_appraisals(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  role_title TEXT REFERENCES job_profiles(title),
  competency_name TEXT NOT NULL,
  section TEXT NOT NULL,
  required_rating INTEGER DEFAULT 3,
  actual_rating INTEGER,
  gap INTEGER,
  severity TEXT CHECK (severity IN ('low','medium','high')),
  recommended_action TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (appraisal_id, competency_name, section)
);

ALTER TABLE skill_gaps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "skill_gaps_select" ON skill_gaps
    FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','executive'))
      OR EXISTS (SELECT 1 FROM employees e WHERE e.employee_id = skill_gaps.employee_id AND e.user_id = auth.uid())
      OR EXISTS (
        SELECT 1
        FROM employees e
        JOIN profiles p ON p.id = auth.uid()
        WHERE e.employee_id = skill_gaps.employee_id
          AND (e.manager_name = p.full_name OR p.role = 'manager')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_write_skill_gaps" ON skill_gaps
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_job_profiles_department ON job_profiles(department);
CREATE INDEX IF NOT EXISTS idx_role_competencies_role ON role_competencies(role_title, sort_order);
CREATE INDEX IF NOT EXISTS idx_role_kpi_templates_role ON role_kpi_templates(role_title, sort_order);
CREATE INDEX IF NOT EXISTS idx_skill_gaps_employee ON skill_gaps(employee_id, created_at DESC);

-- Keep the lightweight roles table aligned for existing screens and legacy views.
INSERT INTO clusters (name)
SELECT DISTINCT department FROM job_profiles
ON CONFLICT DO NOTHING;

