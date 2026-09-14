-- Only @dhofarglobal.com addresses may register. The web app checks the domain
-- first (friendly message); this trigger is the backstop for any other client.
-- Run in the Supabase SQL editor. Idempotent.
--
-- Before running, make sure at least one admin has an @dhofarglobal.com account:
-- the app also signs out existing sessions on other domains.

CREATE OR REPLACE FUNCTION public.enforce_company_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@dhofarglobal.com' THEN
    RAISE EXCEPTION 'Only @dhofarglobal.com work email addresses can register.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_company_email ON auth.users;
CREATE TRIGGER enforce_company_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_email();
