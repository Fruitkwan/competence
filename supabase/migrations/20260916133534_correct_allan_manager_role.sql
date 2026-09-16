-- Allan is a confirmed line manager with five direct reports in the imported
-- employee hierarchy. Correct the application role for his linked profile.
UPDATE public.profiles
   SET role = 'manager',
       updated_at = now()
 WHERE employee_id = 'US140075'
   AND role = 'employee';

-- The imported row identified Allan as his own reporting manager. Keep his
-- confirmed manager role while removing the invalid upward relationship.
UPDATE public.employees
   SET manager_name = NULL,
       manager_position = NULL,
       updated_at = now()
 WHERE employee_id = 'US140075'
   AND lower(split_part(trim(manager_name), ' ', 1)) = lower(split_part(trim(full_name), ' ', 1))
   AND lower(regexp_replace(trim(manager_name), '^.*\s', '')) = lower(regexp_replace(trim(full_name), '^.*\s', ''));
