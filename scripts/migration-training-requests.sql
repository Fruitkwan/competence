-- Employee training requests.
-- Run in Supabase SQL Editor. Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.training_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES public.employees(employee_id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  manager_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  course_title TEXT NOT NULL,
  location TEXT,
  budget_amount NUMERIC(12,2),
  budget_currency TEXT DEFAULT 'AED',
  start_date DATE,
  end_date DATE,
  duration_days INTEGER,
  certification_required BOOLEAN DEFAULT false,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','assigned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_requests
  ALTER COLUMN course_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS budget_currency TEXT DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS certification_required BOOLEAN DEFAULT false;

ALTER TABLE public.training_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE public.training_requests TO authenticated;

DO $$ BEGIN
  CREATE POLICY "training_requests_self_select" ON public.training_requests
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_requests_self_insert" ON public.training_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_requests_manager_select" ON public.training_requests
    FOR SELECT TO authenticated
    USING (manager_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_requests_manager_update" ON public.training_requests
    FOR UPDATE TO authenticated
    USING (manager_user_id = auth.uid())
    WITH CHECK (manager_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "training_requests_admin_select" ON public.training_requests
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin','executive')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_training_requests_updated_at
    BEFORE UPDATE ON public.training_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_training_requests_user
  ON public.training_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_requests_manager
  ON public.training_requests(manager_user_id, created_at DESC);
