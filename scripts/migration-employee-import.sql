-- =============================================================
-- PERFORMANCE HUB — EMPLOYEE BASIS IMPORT
-- Run in Supabase SQL Editor after the base setup.
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS employee_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  source_name TEXT DEFAULT 'basis_file',
  mode TEXT NOT NULL DEFAULT 'preview_confirmed'
    CHECK (mode IN ('preview_confirmed','direct')),
  total_rows INTEGER DEFAULT 0,
  new_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  deactivated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  applied_at TIMESTAMPTZ
);

ALTER TABLE employee_import_batches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_read_employee_import_batches"
    ON employee_import_batches FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_write_employee_import_batches"
    ON employee_import_batches FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS grade_band TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS grade_type TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_position TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS inactive_reason TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS inactive_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_import_batch_id UUID REFERENCES employee_import_batches(id);

CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_last_import_batch ON employees(last_import_batch_id);
CREATE INDEX IF NOT EXISTS idx_employee_import_batches_created_at ON employee_import_batches(created_at DESC);

