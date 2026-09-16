-- Link new Auth accounts to the existing employee directory by verified work
-- email. Employee IDs come from the directory, never from user-editable signup
-- metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  matched_employee public.employees%ROWTYPE;
BEGIN
  SELECT e.*
    INTO matched_employee
    FROM public.employees e
   WHERE NULLIF(trim(NEW.email), '') IS NOT NULL
     AND lower(trim(e.email)) = lower(trim(NEW.email))
     AND e.active = true
     AND (e.user_id IS NULL OR e.user_id = NEW.id)
   LIMIT 1;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    employee_id,
    job_title,
    country_code
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(matched_employee.full_name, ''), NEW.raw_user_meta_data ->> 'full_name', ''),
    'employee',
    matched_employee.employee_id,
    matched_employee.job_title,
    matched_employee.country_code
  )
  ON CONFLICT (id) DO NOTHING;

  IF matched_employee.employee_id IS NOT NULL THEN
    UPDATE public.employees
       SET user_id = NEW.id,
           updated_at = now()
     WHERE employee_id = matched_employee.employee_id
       AND (user_id IS NULL OR user_id = NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions should only run through their trigger.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Repair accounts that already registered and have an unambiguous roster match.
UPDATE public.profiles p
   SET employee_id = e.employee_id,
       full_name = COALESCE(NULLIF(p.full_name, ''), e.full_name),
       job_title = COALESCE(p.job_title, e.job_title),
       country_code = COALESCE(p.country_code, e.country_code),
       updated_at = now()
  FROM public.employees e
 WHERE p.employee_id IS NULL
   AND NULLIF(trim(p.email), '') IS NOT NULL
   AND lower(trim(e.email)) = lower(trim(p.email))
   AND e.active = true
   AND (e.user_id IS NULL OR e.user_id = p.id);

UPDATE public.employees e
   SET user_id = p.id,
       updated_at = now()
  FROM public.profiles p
 WHERE e.employee_id = p.employee_id
   AND p.employee_id IS NOT NULL
   AND (e.user_id IS NULL OR e.user_id = p.id);
