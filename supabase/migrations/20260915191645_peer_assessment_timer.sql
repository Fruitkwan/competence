-- A peer's clock starts on Start, independently of the employee's self-assessment.
ALTER TABLE public.assessment_raters
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
