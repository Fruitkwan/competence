-- Recoverable deletion for records removed through the application.
-- Restrictive SELECT policies keep recycled rows out of every existing query,
-- while the admin-only RPCs below provide a controlled restore path.

DO $$
DECLARE
  recycle_table text;
BEGIN
  FOREACH recycle_table IN ARRAY ARRAY[
    'employees',
    'assessment_assignments',
    'assessment_templates',
    'cycle_objectives',
    'employee_courses',
    'departments',
    'role_kpi_templates',
    'role_competencies'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', recycle_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL', recycle_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deletion_batch_id uuid', recycle_table);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at) WHERE deleted_at IS NOT NULL', 'idx_' || recycle_table || '_deleted_at', recycle_table);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = recycle_table AND policyname = 'hide recycled rows'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (deleted_at IS NULL)',
        'hide recycled rows', recycle_table
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.move_to_recycle_bin(p_table text, p_record_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_batch uuid := gen_random_uuid();
  v_count integer;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF p_table = 'cycle_objectives' THEN
    IF v_role <> 'admin' AND NOT EXISTS (
      SELECT 1 FROM public.cycle_objectives WHERE id = p_record_id::uuid AND employee_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'You cannot remove this objective';
    END IF;
  ELSIF p_table = 'employee_courses' THEN
    IF v_role NOT IN ('admin', 'manager') THEN RAISE EXCEPTION 'Manager access required'; END IF;
  ELSIF v_role <> 'admin' THEN
    RAISE EXCEPTION 'HR admin access required';
  END IF;

  CASE p_table
    WHEN 'employees' THEN
      UPDATE public.employees SET deleted_at = now(), deleted_by = auth.uid(), deletion_batch_id = v_batch
      WHERE employee_id = p_record_id AND deleted_at IS NULL;
    WHEN 'assessment_assignments' THEN
      UPDATE public.assessment_assignments SET deleted_at = now(), deleted_by = auth.uid(), deletion_batch_id = v_batch
      WHERE id = p_record_id::uuid AND deleted_at IS NULL;
    WHEN 'assessment_templates' THEN
      UPDATE public.assessment_templates SET deleted_at = now(), deleted_by = auth.uid(), deletion_batch_id = v_batch
      WHERE id = p_record_id::uuid AND deleted_at IS NULL;
    WHEN 'cycle_objectives' THEN
      UPDATE public.cycle_objectives SET deleted_at = now(), deleted_by = auth.uid(), deletion_batch_id = v_batch
      WHERE id = p_record_id::uuid AND deleted_at IS NULL;
    WHEN 'employee_courses' THEN
      UPDATE public.employee_courses SET deleted_at = now(), deleted_by = auth.uid(), deletion_batch_id = v_batch
      WHERE id = p_record_id::uuid AND deleted_at IS NULL;
    WHEN 'departments' THEN
      UPDATE public.departments SET deleted_at = now(), deleted_by = auth.uid(), deletion_batch_id = v_batch
      WHERE id = p_record_id::uuid AND deleted_at IS NULL;
    WHEN 'role_kpi_templates' THEN
      UPDATE public.role_kpi_templates SET deleted_at = now(), deleted_by = auth.uid(), deletion_batch_id = v_batch
      WHERE id = p_record_id::uuid AND deleted_at IS NULL;
    WHEN 'role_competencies' THEN
      UPDATE public.role_competencies SET deleted_at = now(), deleted_by = auth.uid(), deletion_batch_id = v_batch
      WHERE role_title = p_record_id::jsonb->>'role_title'
        AND competency_id = (p_record_id::jsonb->>'competency_id')::uuid
        AND deleted_at IS NULL;
    ELSE
      RAISE EXCEPTION 'This record type cannot be recycled';
  END CASE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_deleted_item(p_table text, p_record_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'HR admin access required';
  END IF;

  CASE p_table
    WHEN 'employees' THEN UPDATE public.employees SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL WHERE employee_id = p_record_id AND deleted_at IS NOT NULL;
    WHEN 'assessment_assignments' THEN UPDATE public.assessment_assignments SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'assessment_templates' THEN UPDATE public.assessment_templates SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'cycle_objectives' THEN UPDATE public.cycle_objectives SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'employee_courses' THEN UPDATE public.employee_courses SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'departments' THEN UPDATE public.departments SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'role_kpi_templates' THEN UPDATE public.role_kpi_templates SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'role_competencies' THEN UPDATE public.role_competencies SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL WHERE role_title = p_record_id::jsonb->>'role_title' AND competency_id = (p_record_id::jsonb->>'competency_id')::uuid AND deleted_at IS NOT NULL;
    ELSE RAISE EXCEPTION 'This record type cannot be restored';
  END CASE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.permanently_delete_item(p_table text, p_record_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'HR admin access required';
  END IF;

  CASE p_table
    WHEN 'employees' THEN DELETE FROM public.employees WHERE employee_id = p_record_id AND deleted_at IS NOT NULL;
    WHEN 'assessment_assignments' THEN DELETE FROM public.assessment_assignments WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'assessment_templates' THEN DELETE FROM public.assessment_templates WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'cycle_objectives' THEN DELETE FROM public.cycle_objectives WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'employee_courses' THEN DELETE FROM public.employee_courses WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'departments' THEN DELETE FROM public.departments WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'role_kpi_templates' THEN DELETE FROM public.role_kpi_templates WHERE id = p_record_id::uuid AND deleted_at IS NOT NULL;
    WHEN 'role_competencies' THEN DELETE FROM public.role_competencies WHERE role_title = p_record_id::jsonb->>'role_title' AND competency_id = (p_record_id::jsonb->>'competency_id')::uuid AND deleted_at IS NOT NULL;
    ELSE RAISE EXCEPTION 'This record type cannot be permanently deleted';
  END CASE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_recycle_bin()
RETURNS TABLE (
  table_name text,
  record_id text,
  label text,
  detail text,
  deleted_at timestamptz,
  deleted_by_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'HR admin access required';
  END IF;

  RETURN QUERY
  SELECT x.table_name, x.record_id, x.label, x.detail, x.deleted_at, u.email::text
  FROM (
    SELECT 'employees'::text, employee_id::text, full_name::text, job_title::text, employees.deleted_at, deleted_by FROM public.employees WHERE employees.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'assessment_assignments', a.id::text, COALESCE(e.full_name, a.employee_id), COALESCE(t.role_family, t.name, 'Assessment assignment'), a.deleted_at, a.deleted_by
      FROM public.assessment_assignments a LEFT JOIN public.employees e ON e.employee_id = a.employee_id LEFT JOIN public.assessment_templates t ON t.id = a.template_id WHERE a.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'assessment_templates', id::text, COALESCE(role_family, name), initcap(kind) || ' assessment', assessment_templates.deleted_at, deleted_by FROM public.assessment_templates WHERE assessment_templates.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'cycle_objectives', id::text, title, status::text, cycle_objectives.deleted_at, deleted_by FROM public.cycle_objectives WHERE cycle_objectives.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'employee_courses', ec.id::text, COALESCE(e.full_name, ec.employee_id), COALESCE(c.title, 'Course assignment'), ec.deleted_at, ec.deleted_by FROM public.employee_courses ec LEFT JOIN public.employees e ON e.employee_id = ec.employee_id LEFT JOIN public.courses c ON c.id = ec.course_id WHERE ec.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'departments', id::text, name, 'Department', departments.deleted_at, deleted_by FROM public.departments WHERE departments.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'role_kpi_templates', id::text, title, role_title, role_kpi_templates.deleted_at, deleted_by FROM public.role_kpi_templates WHERE role_kpi_templates.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'role_competencies', jsonb_build_object('role_title', rc.role_title, 'competency_id', rc.competency_id)::text,
      COALESCE(c.name, 'Competency'), rc.role_title, rc.deleted_at, rc.deleted_by
      FROM public.role_competencies rc LEFT JOIN public.competencies c ON c.id = rc.competency_id WHERE rc.deleted_at IS NOT NULL
  ) AS x(table_name, record_id, label, detail, deleted_at, deleted_by)
  LEFT JOIN auth.users u ON u.id = x.deleted_by
  ORDER BY x.deleted_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.move_to_recycle_bin(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_deleted_item(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.permanently_delete_item(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_recycle_bin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_recycle_bin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_item(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_item(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_recycle_bin() TO authenticated;

-- Make the newly added RPCs available to PostgREST immediately after deployment.
NOTIFY pgrst, 'reload schema';
