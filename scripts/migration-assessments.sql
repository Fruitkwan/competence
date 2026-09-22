-- Skill & Behaviour assessments (DG Assessment v2 instruments).
-- Run in Supabase SQL Editor. Idempotent: safe to re-run (policies are
-- dropped and recreated, so re-running also applies policy fixes).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER so policies can read profiles without recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assess_current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.assess_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.assess_current_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.assess_is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.assess_current_role() IN ('admin','manager','executive'), false)
$$;

CREATE OR REPLACE FUNCTION public.assess_my_employee_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT p.employee_id FROM public.profiles p WHERE p.id = auth.uid()),
    (SELECT e.employee_id FROM public.employees e WHERE e.user_id = auth.uid() LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.assess_manages_employee(emp_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.profiles me ON me.id = auth.uid()
    LEFT JOIN public.profiles ep ON ep.employee_id = e.employee_id
    WHERE e.employee_id = emp_id
      AND (ep.manager_id = auth.uid()
           OR (e.manager_name IS NOT NULL AND e.manager_name = me.full_name))
  )
$$;

-- ---------------------------------------------------------------------------
-- Templates (one per instrument / role family)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('skill','behaviour')),
  name TEXT NOT NULL,
  role_family TEXT,
  department TEXT,
  job_titles TEXT[] NOT NULL DEFAULT '{}',
  version TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  scoring JSONB NOT NULL DEFAULT '{}'::jsonb,
  aspiration_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  privacy_notice TEXT,
  source_file_name TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.assessment_templates(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  group_name TEXT,
  name TEXT NOT NULL,
  indicator TEXT NOT NULL,
  anchor_2 TEXT,
  anchor_3 TEXT,
  anchor_4 TEXT,
  scenario TEXT,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Answer keys live in their own table so RLS can hide them from employees.
CREATE TABLE IF NOT EXISTS public.assessment_item_keys (
  item_id UUID PRIMARY KEY REFERENCES public.assessment_items(id) ON DELETE CASCADE,
  answer_key CHAR(1) CHECK (answer_key IN ('A','B','C','D')),
  rationale TEXT,
  diagnostic TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Assignments, raters, responses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.assessment_templates(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  employee_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  wave TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','in_progress','submitted','closed')),
  results_released BOOLEAN NOT NULL DEFAULT false,
  aspiration JSONB,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-assessments are timed; the clock starts when the employee presses Start.
ALTER TABLE public.assessment_assignments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Report acknowledgement e-signatures: {"employee"|"manager"|"hr": {"name","at"}}.
ALTER TABLE public.assessment_assignments ADD COLUMN IF NOT EXISTS report_signatures JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_assignments_open
  ON public.assessment_assignments(template_id, employee_id)
  WHERE status <> 'closed';

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_employee
  ON public.assessment_assignments(employee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.assessment_raters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assessment_assignments(id) ON DELETE CASCADE,
  rater_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rater_type TEXT NOT NULL CHECK (rater_type IN ('self','line_manager','cross_dept','peer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, rater_user_id, rater_type)
);

CREATE INDEX IF NOT EXISTS idx_assessment_raters_user
  ON public.assessment_raters(rater_user_id, status);

CREATE TABLE IF NOT EXISTS public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES public.assessment_raters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.assessment_items(id) ON DELETE CASCADE,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  not_observed BOOLEAN NOT NULL DEFAULT false,
  scenario_answer CHAR(1) CHECK (scenario_answer IN ('A','B','C','D')),
  evidence TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rater_id, item_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TRIGGER set_assessment_templates_updated_at
    BEFORE UPDATE ON public.assessment_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_assessment_item_keys_updated_at
    BEFORE UPDATE ON public.assessment_item_keys
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_assessment_assignments_updated_at
    BEFORE UPDATE ON public.assessment_assignments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_assessment_responses_updated_at
    BEFORE UPDATE ON public.assessment_responses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Cross-table lookups used by policies. SECURITY DEFINER bypasses RLS, so
-- assignments <-> raters <-> responses policies never recurse into each other.
-- Defined after the tables because SQL function bodies are validated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assess_is_rater_of(a_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_raters r
    WHERE r.assignment_id = a_id AND r.rater_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.assess_is_assignment_subject(a_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_assignments a
    WHERE a.id = a_id
      AND (a.employee_user_id = auth.uid() OR a.employee_id = public.assess_my_employee_id())
  )
$$;

CREATE OR REPLACE FUNCTION public.assess_can_manage_assignment(a_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.assess_is_admin() OR EXISTS (
    SELECT 1 FROM public.assessment_assignments a
    WHERE a.id = a_id AND public.assess_manages_employee(a.employee_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.assess_owns_rater(r_id uuid, require_pending boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_raters r
    WHERE r.id = r_id AND r.rater_user_id = auth.uid()
      AND (NOT require_pending OR r.status = 'pending')
  )
$$;

CREATE OR REPLACE FUNCTION public.assess_template_is_published(t_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.assessment_templates t WHERE t.id = t_id AND t.status = 'published')
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessment_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_item_keys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_raters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses   ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.assessment_templates, public.assessment_items, public.assessment_item_keys,
  public.assessment_assignments, public.assessment_raters, public.assessment_responses
  TO authenticated;

-- Drop policies from earlier versions of this migration.
DROP POLICY IF EXISTS "assessment_assignments_staff_write" ON public.assessment_assignments;
DROP POLICY IF EXISTS "assessment_raters_staff_write"      ON public.assessment_raters;
DROP POLICY IF EXISTS "assessment_responses_own"           ON public.assessment_responses;

-- Templates / items: everyone signed in can read published ones; admin manages all.
DROP POLICY IF EXISTS "assessment_templates_read" ON public.assessment_templates;
CREATE POLICY "assessment_templates_read" ON public.assessment_templates
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.assess_is_admin());

DROP POLICY IF EXISTS "assessment_templates_admin_write" ON public.assessment_templates;
CREATE POLICY "assessment_templates_admin_write" ON public.assessment_templates
  FOR ALL TO authenticated
  USING (public.assess_is_admin()) WITH CHECK (public.assess_is_admin());

DROP POLICY IF EXISTS "assessment_items_read" ON public.assessment_items;
CREATE POLICY "assessment_items_read" ON public.assessment_items
  FOR SELECT TO authenticated
  USING (public.assess_is_admin() OR public.assess_template_is_published(template_id));

DROP POLICY IF EXISTS "assessment_items_admin_write" ON public.assessment_items;
CREATE POLICY "assessment_items_admin_write" ON public.assessment_items
  FOR ALL TO authenticated
  USING (public.assess_is_admin()) WITH CHECK (public.assess_is_admin());

-- Answer keys: admin only. Scoring runs server-side with the service role.
DROP POLICY IF EXISTS "assessment_item_keys_admin" ON public.assessment_item_keys;
CREATE POLICY "assessment_item_keys_admin" ON public.assessment_item_keys
  FOR ALL TO authenticated
  USING (public.assess_is_admin()) WITH CHECK (public.assess_is_admin());

-- Assignments: the employee, their raters, their manager, and staff can read.
DROP POLICY IF EXISTS "assessment_assignments_read" ON public.assessment_assignments;
CREATE POLICY "assessment_assignments_read" ON public.assessment_assignments
  FOR SELECT TO authenticated
  USING (
    public.assess_is_staff()
    OR employee_user_id = auth.uid()
    OR employee_id = public.assess_my_employee_id()
    OR public.assess_is_rater_of(id)
  );

DROP POLICY IF EXISTS "assessment_assignments_staff_insert" ON public.assessment_assignments;
CREATE POLICY "assessment_assignments_staff_insert" ON public.assessment_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.assess_is_admin() OR public.assess_manages_employee(employee_id));

DROP POLICY IF EXISTS "assessment_assignments_staff_update" ON public.assessment_assignments;
CREATE POLICY "assessment_assignments_staff_update" ON public.assessment_assignments
  FOR UPDATE TO authenticated
  USING (public.assess_is_admin() OR public.assess_manages_employee(employee_id))
  WITH CHECK (public.assess_is_admin() OR public.assess_manages_employee(employee_id));

DROP POLICY IF EXISTS "assessment_assignments_admin_delete" ON public.assessment_assignments;
CREATE POLICY "assessment_assignments_admin_delete" ON public.assessment_assignments
  FOR DELETE TO authenticated
  USING (public.assess_is_admin());

-- The employee may update their own assignment (status, aspiration).
DROP POLICY IF EXISTS "assessment_assignments_self_update" ON public.assessment_assignments;
CREATE POLICY "assessment_assignments_self_update" ON public.assessment_assignments
  FOR UPDATE TO authenticated
  USING (employee_user_id = auth.uid() OR employee_id = public.assess_my_employee_id())
  WITH CHECK (employee_user_id = auth.uid() OR employee_id = public.assess_my_employee_id());

-- Raters: a rater sees only their own row; staff see all rows.
-- Employees never see who else rates them.
DROP POLICY IF EXISTS "assessment_raters_read" ON public.assessment_raters;
CREATE POLICY "assessment_raters_read" ON public.assessment_raters
  FOR SELECT TO authenticated
  USING (rater_user_id = auth.uid() OR public.assess_is_staff());

DROP POLICY IF EXISTS "assessment_raters_staff_insert" ON public.assessment_raters;
CREATE POLICY "assessment_raters_staff_insert" ON public.assessment_raters
  FOR INSERT TO authenticated
  WITH CHECK (public.assess_can_manage_assignment(assignment_id));

DROP POLICY IF EXISTS "assessment_raters_staff_delete" ON public.assessment_raters;
CREATE POLICY "assessment_raters_staff_delete" ON public.assessment_raters
  FOR DELETE TO authenticated
  USING (public.assess_can_manage_assignment(assignment_id));

DROP POLICY IF EXISTS "assessment_raters_self_insert" ON public.assessment_raters;
CREATE POLICY "assessment_raters_self_insert" ON public.assessment_raters
  FOR INSERT TO authenticated
  WITH CHECK (
    rater_type = 'self' AND rater_user_id = auth.uid()
    AND public.assess_is_assignment_subject(assignment_id)
  );

DROP POLICY IF EXISTS "assessment_raters_own_update" ON public.assessment_raters;
CREATE POLICY "assessment_raters_own_update" ON public.assessment_raters
  FOR UPDATE TO authenticated
  USING (rater_user_id = auth.uid()) WITH CHECK (rater_user_id = auth.uid());

-- Responses: a rater manages only their own; staff read all (needed for scoring).
DROP POLICY IF EXISTS "assessment_responses_own_select" ON public.assessment_responses;
CREATE POLICY "assessment_responses_own_select" ON public.assessment_responses
  FOR SELECT TO authenticated
  USING (public.assess_owns_rater(rater_id));

DROP POLICY IF EXISTS "assessment_responses_own_insert" ON public.assessment_responses;
CREATE POLICY "assessment_responses_own_insert" ON public.assessment_responses
  FOR INSERT TO authenticated
  WITH CHECK (public.assess_owns_rater(rater_id, true));

DROP POLICY IF EXISTS "assessment_responses_own_update" ON public.assessment_responses;
CREATE POLICY "assessment_responses_own_update" ON public.assessment_responses
  FOR UPDATE TO authenticated
  USING (public.assess_owns_rater(rater_id, true))
  WITH CHECK (public.assess_owns_rater(rater_id, true));

DROP POLICY IF EXISTS "assessment_responses_staff_read" ON public.assessment_responses;
CREATE POLICY "assessment_responses_staff_read" ON public.assessment_responses
  FOR SELECT TO authenticated
  USING (public.assess_is_staff());

-- ---------------------------------------------------------------------------
-- Role placement instrument (scored MCQ, e.g. Sales Career Path)
-- ---------------------------------------------------------------------------

-- Widen the template kind check to include 'placement'.
ALTER TABLE public.assessment_templates DROP CONSTRAINT IF EXISTS assessment_templates_kind_check;
ALTER TABLE public.assessment_templates
  ADD CONSTRAINT assessment_templates_kind_check CHECK (kind IN ('skill','behaviour','placement'));

-- Placement items score every option (4/2/1/0), not just a single correct key.
-- option_points: {"A":4,"B":0,"C":2,"D":1}. answer_key remains the 4-point option.
ALTER TABLE public.assessment_item_keys ADD COLUMN IF NOT EXISTS option_points JSONB;

-- Verified performance record entered by HR per assignment:
-- {"commercial": 0-100, "account": 0-100, "leadership": 0-100} (null = unavailable).
ALTER TABLE public.assessment_assignments ADD COLUMN IF NOT EXISTS record_scores JSONB NOT NULL DEFAULT '{}'::jsonb;
