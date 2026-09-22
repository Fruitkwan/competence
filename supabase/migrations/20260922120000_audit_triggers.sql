-- Audit trigger function + triggers. The earlier migration silently skipped
-- trigger creation when this function was missing (undefined_function -> NULL),
-- so audit_log stayed empty.

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pk text;
BEGIN
  v_pk := COALESCE(
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW)->>'id' END,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD)->>'id' END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW)->>'item_id' END,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD)->>'item_id' END
  );
  INSERT INTO public.audit_log (actor, actor_email, table_name, row_pk, action, before, after)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    TG_TABLE_NAME,
    v_pk,
    TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to every application table (audit_log itself excluded).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'audit_log'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()',
      t, t
    );
  END LOOP;
END $$;
