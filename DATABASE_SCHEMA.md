# Performance Hub - Database Schema (Supabase PostgreSQL)

## Core Tables

### users
```sql
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text,
  employee_id text,
  department text,
  job_role text,
  cluster text,           -- GCC specific
  country text,
  role text check (role in ('employee', 'manager', 'hr', 'clevel')),
  manager_id uuid references users(id),
  is_active boolean default true,
  created_at timestamp default now()
);

create table appraisal_cycles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text default 'bi_annual',
  start_date date,
  end_date date,
  status text default 'draft', -- draft, active, closed
  scoring_rubric jsonb,
  created_by uuid references users(id),
  created_at timestamp default now()
);

create table kpis (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references appraisal_cycles(id),
  title text,
  description text,
  level text, -- org, department, team
  weight numeric(4,2),
  created_by uuid references users(id)
);

create table objectives (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references appraisal_cycles(id),
  employee_id uuid references users(id),
  title text not null,
  description text,
  weight numeric(4,2) default 100,
  status text default 'draft', -- draft, submitted, approved, rejected
  approved_by uuid references users(id),
  approved_at timestamp,
  created_at timestamp default now()
);

create table appraisals (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references appraisal_cycles(id),
  employee_id uuid references users(id),
  manager_id uuid references users(id),
  self_score jsonb,
  manager_score jsonb,
  final_score jsonb,
  calibration_notes text,
  status text default 'in_progress',
  employee_signed boolean default false,
  hr_signed boolean default false,
  created_at timestamp default now()
);


create table courses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  competency_code text,
  duration_hours int,
  is_mandatory boolean default false
);

create table training_enrollments (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id),
  employee_id uuid references users(id),
  assigned_by uuid references users(id),
  status text default 'not_started',
  progress numeric(5,2) default 0,
  deadline date,
  certificate_url text,
  completed_at timestamp
);

create table performance_concerns (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references users(id),
  raised_by uuid references users(id),
  reason text,
  status text default 'open'
);

create table pips (
  id uuid primary key default uuid_generate_v4(),
  concern_id uuid references performance_concerns(id),
  start_date date,
  end_date date,
  milestones jsonb,
  signed_by_employee boolean default false,
  outcome text, -- resolved, extended, escalated
  escalated_to uuid references users(id)
);


Additional Tables

notifications
audit_logs
skill_gaps
competencies
role_benchmarks

RLS Policies Recommendation:

Employees can only see their own data
Managers see their direct reports
HR sees everything
C-Level sees only aggregates