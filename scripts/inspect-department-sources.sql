select 'departments' as source, count(*) as total, count(name) as populated
from public.departments
union all
select 'profiles', count(*), count(department_id)
from public.profiles
union all
select 'employees.department', count(*), count(department)
from public.employees
union all
select 'job_profiles.department', count(*), count(department)
from public.job_profiles;

select name
from public.departments
order by name
limit 30;

select department, count(*) as roles
from public.job_profiles
where department is not null
group by department
order by roles desc, department
limit 30;

select e.job_title, count(*) as employees, jp.department
from public.employees e
left join public.job_profiles jp on lower(trim(jp.title)) = lower(trim(e.job_title))
group by e.job_title, jp.department
order by employees desc, e.job_title
limit 30;

select count(*) as employees_matching_job_profile_department
from public.employees e
join public.job_profiles jp on lower(trim(jp.title)) = lower(trim(e.job_title))
where jp.department is not null;
