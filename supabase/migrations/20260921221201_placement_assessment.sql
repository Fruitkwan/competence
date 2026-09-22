-- Role placement instrument (scored MCQ, e.g. Sales Career Path).

-- Widen the template kind check to include 'placement'.
ALTER TABLE public.assessment_templates DROP CONSTRAINT IF EXISTS assessment_templates_kind_check;
ALTER TABLE public.assessment_templates
  ADD CONSTRAINT assessment_templates_kind_check CHECK (kind IN ('skill','behaviour','placement'));

-- Placement items score every option (4/2/1/0), not just a single correct key.
-- option_points: {"A":4,"B":0,"C":2,"D":1}. answer_key remains the 4-point option.
ALTER TABLE public.assessment_item_keys ADD COLUMN IF NOT EXISTS option_points jsonb;

-- Verified performance record entered by HR per assignment:
-- {"commercial": 0-100, "account": 0-100, "leadership": 0-100} (null = unavailable).
ALTER TABLE public.assessment_assignments ADD COLUMN IF NOT EXISTS record_scores jsonb NOT NULL DEFAULT '{}'::jsonb;
