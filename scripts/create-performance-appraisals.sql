-- Migration: Create performance_appraisals table
-- Run this against your Supabase database

CREATE TABLE IF NOT EXISTS performance_appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Employee info
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  manager_id TEXT REFERENCES employees(employee_id),
  department TEXT,
  business_unit TEXT,
  location TEXT,
  appraisal_period TEXT,
  appraisal_type TEXT CHECK (appraisal_type IN ('Annual','Mid-Year','Probation','Exit')),
  document_ref TEXT,

  -- JSONB for structured sections
  goals JSONB DEFAULT '[]',
  core_competencies JSONB DEFAULT '{}',
  leadership JSONB DEFAULT '{}',
  leadership_applicable BOOLEAN DEFAULT true,
  values_culture JSONB DEFAULT '{}',
  feedback_n1 JSONB DEFAULT '{}',
  feedback_n2 JSONB DEFAULT '{}',
  development_plan JSONB DEFAULT '[]',
  next_period_goals JSONB DEFAULT '[]',

  -- Scores (Section H)
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

  -- Section I
  employee_comments TEXT,

  -- Section J (digital signatures = timestamps)
  employee_signed_at TIMESTAMPTZ,
  manager_signed_at TIMESTAMPTZ,
  hr_signed_at TIMESTAMPTZ,
  hr_representative TEXT,

  -- Meta
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft','N1 Complete','N2 Complete','Final','Archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE performance_appraisals ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all
CREATE POLICY "Authenticated users can view performance appraisals"
  ON performance_appraisals FOR SELECT
  TO authenticated
  USING (true);

-- Policy: authenticated users can insert
CREATE POLICY "Authenticated users can create performance appraisals"
  ON performance_appraisals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: authenticated users can update
CREATE POLICY "Authenticated users can update performance appraisals"
  ON performance_appraisals FOR UPDATE
  TO authenticated
  USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_performance_appraisal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON performance_appraisals
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_appraisal_timestamp();
