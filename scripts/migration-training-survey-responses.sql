-- =============================================================
-- TRAINING SURVEY RESPONSES
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

CREATE TABLE IF NOT EXISTS public.training_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES public.employees(employee_id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  department TEXT NOT NULL,
  role_level TEXT NOT NULL,
  email TEXT NOT NULL,
  manager_name TEXT,
  learn_departments TEXT[] DEFAULT '{}',
  learn_topics TEXT,
  urgency TEXT,
  preferred_format TEXT,
  learning_hours TEXT,
  teach_departments TEXT[] DEFAULT '{}',
  teach_topics TEXT,
  confidence TEXT,
  teaching_hours TEXT,
  recommended_trainers TEXT,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','reviewed','actioned','archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_survey_responses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.training_survey_responses TO authenticated;

DO $$ BEGIN
  CREATE POLICY "training_survey_self_select" ON public.training_survey_responses
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_survey_self_insert" ON public.training_survey_responses
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_survey_manager_select" ON public.training_survey_responses
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = training_survey_responses.user_id
          AND p.manager_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_survey_admin_exec_select" ON public.training_survey_responses
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin','executive')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_survey_admin_update" ON public.training_survey_responses
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_survey_manager_update" ON public.training_survey_responses
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = training_survey_responses.user_id
          AND p.manager_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = training_survey_responses.user_id
          AND p.manager_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_training_survey_responses_updated_at
    BEFORE UPDATE ON public.training_survey_responses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_training_survey_responses_user
  ON public.training_survey_responses(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_survey_responses_employee
  ON public.training_survey_responses(employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_survey_responses_department
  ON public.training_survey_responses(department, created_at DESC);
