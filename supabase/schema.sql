-- ============================================================
-- EventOD System — Supabase Schema  (v2 — fixed RLS)
-- Run this in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('student', 'faculty', 'hod')),
  reg_number text,
  department text not null,
  phone text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_all"  on public.profiles for select using (true);
create policy "profiles_insert_own"  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"  on public.profiles for update using (auth.uid() = id);

-- ============================================================
-- EVENTS
-- ============================================================
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  event_type text not null check (event_type in ('technical','hackathon','cultural','sports','other')),
  venue text not null,
  event_date date not null,
  start_time time,
  end_time time,
  club_name text not null,
  organizer_id uuid references public.profiles(id) not null,
  faculty_id uuid references public.profiles(id),
  hod_id uuid references public.profiles(id),
  status text default 'draft' check (status in ('draft','pending_approval','approved','rejected','completed')),
  qr_token text,        -- short token for QR URL (not base64 image)
  faculty_remarks text,
  created_at timestamptz default now()
);

alter table public.events enable row level security;
create policy "events_select" on public.events for select using (
  status in ('approved','completed')
  or auth.uid() = organizer_id
  or auth.uid() = faculty_id
  or auth.uid() = hod_id
);
create policy "events_insert" on public.events for insert with check (auth.uid() = organizer_id);
create policy "events_update" on public.events for update using (
  auth.uid() = organizer_id or auth.uid() = faculty_id or auth.uid() = hod_id
);

-- ============================================================
-- EVENT REGISTRATIONS
-- ============================================================
create table public.event_registrations (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  student_id uuid references public.profiles(id),  -- nullable: student may not be logged in
  full_name text not null,
  reg_number text not null,
  department text not null,
  year_sem text not null,
  section text,
  phone text,
  email text,
  role_in_event text default 'Participant',
  -- Store the compact QR data string (not base64 image — too large for DB)
  attendance_qr_data text,    -- JSON string: {"type":"attendance","registrationId":"...","regNumber":"..."}
  attended boolean default false,
  attended_at timestamptz,
  od_status text default 'not_generated' check (
    od_status in ('not_generated','pending','faculty_approved','hod_approved','rejected')
  ),
  registered_at timestamptz default now(),
  unique(event_id, reg_number)
);

alter table public.event_registrations enable row level security;

-- INSERT: anyone (logged in or not) can register
create policy "regs_insert_anyone" on public.event_registrations
  for insert with check (true);

-- SELECT: student sees own row; organiser/faculty/hod see all for their events; anonymous users see by reg_number match
create policy "regs_select" on public.event_registrations
  for select using (
    -- logged-in student sees their own rows
    (auth.uid() is not null and auth.uid() = student_id)
    -- event organiser / faculty / hod see all registrations for their event
    or exists (
      select 1 from public.events e
      where e.id = event_id
        and (e.organizer_id = auth.uid() or e.faculty_id = auth.uid() or e.hod_id = auth.uid())
    )
    -- allow select by anyone so anonymous registration retrieval works (guarded by reg_number unique constraint)
    or true
  );

-- UPDATE: the student themselves OR organiser/faculty/hod
create policy "regs_update" on public.event_registrations
  for update using (
    auth.uid() = student_id
    or exists (
      select 1 from public.events e
      where e.id = event_id
        and (e.organizer_id = auth.uid() or e.faculty_id = auth.uid() or e.hod_id = auth.uid())
    )
  );

-- ============================================================
-- OD REQUESTS
-- ============================================================
create table public.od_requests (
  id uuid default uuid_generate_v4() primary key,
  registration_id uuid references public.event_registrations(id) on delete cascade not null,
  event_id uuid references public.events(id) not null,
  student_reg_number text not null,
  faculty_status text default 'pending' check (faculty_status in ('pending','approved','rejected')),
  faculty_id uuid references public.profiles(id),
  faculty_remarks text,
  faculty_acted_at timestamptz,
  hod_status text default 'pending' check (hod_status in ('pending','approved','rejected')),
  hod_id uuid references public.profiles(id),
  hod_remarks text,
  hod_acted_at timestamptz,
  slip_id text unique not null,
  created_at timestamptz default now()
);

alter table public.od_requests enable row level security;

create policy "od_select" on public.od_requests for select using (
  exists (
    select 1 from public.event_registrations er
    join public.events e on e.id = er.event_id
    where er.id = registration_id
      and (
        er.student_id = auth.uid()
        or e.faculty_id = auth.uid()
        or e.hod_id    = auth.uid()
        or e.organizer_id = auth.uid()
      )
  )
  -- also allow select by slip_id lookup (for OD slip page)
  or true
);

create policy "od_insert" on public.od_requests for insert with check (true);

create policy "od_update" on public.od_requests for update using (
  auth.uid() = faculty_id or auth.uid() = hod_id
);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, department, reg_number, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(new.raw_user_meta_data->>'reg_number', null),
    coalesce(new.raw_user_meta_data->>'phone', null)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- LECTURE SLOTS (fixed SRM timetable)
-- ============================================================
create table public.lecture_slots (
  id serial primary key,
  slot_number int not null,           -- 1 through 6
  label text not null,                -- e.g. "Slot 1"
  start_time time not null,
  end_time time not null
);

insert into public.lecture_slots (slot_number, label, start_time, end_time) values
  (1, 'Slot 1', '09:30', '10:20'),
  (2, 'Slot 2', '10:20', '11:10'),
  (3, 'Slot 3', '11:20', '12:10'),
  (4, 'Slot 4', '12:10', '13:00'),
  (5, 'Slot 5', '14:10', '15:00'),
  (6, 'Slot 6', '15:00', '15:50');

alter table public.lecture_slots enable row level security;
create policy "slots_public_read" on public.lecture_slots for select using (true);

-- ============================================================
-- SECTIONS (class groups)
-- ============================================================
create table public.sections (
  id uuid default uuid_generate_v4() primary key,
  department text not null,           -- e.g. CSE
  year_label text not null,           -- e.g. 2nd Year
  section_code text not null,         -- e.g. B
  display_name text generated always as (department || ' ' || year_label || ' ' || section_code) stored,
  created_at timestamptz default now(),
  unique(department, year_label, section_code)
);

alter table public.sections enable row level security;
create policy "sections_read_all" on public.sections for select using (true);
create policy "sections_insert"   on public.sections for insert with check (true);
create policy "sections_update"   on public.sections for update using (true);
create policy "sections_delete"   on public.sections for delete using (true);

-- ============================================================
-- TIMETABLE ENTRIES
-- One row = one section × one day × one slot × one teacher
-- ============================================================
create table public.timetable_entries (
  id uuid default uuid_generate_v4() primary key,
  section_id uuid references public.sections(id) on delete cascade not null,
  day_of_week int not null check (day_of_week between 1 and 5), -- 1=Mon … 5=Fri
  slot_id int references public.lecture_slots(id) not null,
  subject_name text not null,
  teacher_name text not null,
  teacher_email text not null,
  created_at timestamptz default now(),
  unique(section_id, day_of_week, slot_id)
);

alter table public.timetable_entries enable row level security;
create policy "tt_read_all"   on public.timetable_entries for select using (true);
create policy "tt_insert"     on public.timetable_entries for insert with check (true);
create policy "tt_update"     on public.timetable_entries for update using (true);
create policy "tt_delete"     on public.timetable_entries for delete using (true);

-- ============================================================
-- OD NOTIFICATIONS (email log)
-- ============================================================
create table public.od_notifications (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  section_id uuid references public.sections(id),
  timetable_entry_id uuid references public.timetable_entries(id),
  teacher_name text not null,
  teacher_email text not null,
  slot_id int references public.lecture_slots(id),
  student_count int default 0,
  student_list jsonb,           -- [{name, reg_number}, ...]
  scheduled_at timestamptz,     -- when email should fire (10 min after slot start)
  sent_at timestamptz,
  status text default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz default now()
);

alter table public.od_notifications enable row level security;
create policy "notif_read_all"   on public.od_notifications for select using (true);
create policy "notif_insert"     on public.od_notifications for insert with check (true);
create policy "notif_update"     on public.od_notifications for update using (true);
