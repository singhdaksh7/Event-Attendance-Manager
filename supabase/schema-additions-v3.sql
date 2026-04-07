-- ============================================================
-- Schema additions v3 — Teachers table
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists public.teachers (
  id uuid default uuid_generate_v4() primary key,
  emp_id text unique not null,
  full_name text not null,
  email text not null,
  designation text,
  gender text check (gender in ('Male','Female','Other')),
  mobile text,
  official_mobile text,
  department text,
  created_at timestamptz default now()
);

alter table public.teachers enable row level security;
create policy "teachers_read_all"   on public.teachers for select using (true);
create policy "teachers_insert"     on public.teachers for insert with check (true);
create policy "teachers_update"     on public.teachers for update using (true);
create policy "teachers_delete"     on public.teachers for delete using (true);

-- Add teacher_id FK to timetable_entries (optional, keeps backward compat)
alter table public.timetable_entries
  add column if not exists teacher_id uuid references public.teachers(id) on delete set null;
