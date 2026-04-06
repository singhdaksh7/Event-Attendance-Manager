-- ============================================================
-- Schema additions v2
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add specialisation to sections
alter table public.sections
  add column if not exists specialisation text not null default '';

-- Update display_name to include specialisation
alter table public.sections
  drop column if exists display_name;

alter table public.sections
  add column display_name text generated always as (
    department || ' ' || specialisation || ' ' || year_label || ' ' || section_code
  ) stored;

-- Drop old unique constraint and add new one including specialisation
alter table public.sections
  drop constraint if exists sections_department_year_label_section_code_key;

alter table public.sections
  add constraint sections_unique
  unique(department, specialisation, year_label, section_code);

-- Departments table
create table if not exists public.departments (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,                    -- e.g. CSE
  specialisations text[] not null default '{}', -- e.g. {Core, CSBS, "Data Science"}
  created_at timestamptz default now()
);

alter table public.departments enable row level security;
create policy "dept_read_all"   on public.departments for select using (true);
create policy "dept_insert"     on public.departments for insert with check (true);
create policy "dept_update"     on public.departments for update using (true);
create policy "dept_delete"     on public.departments for delete using (true);
