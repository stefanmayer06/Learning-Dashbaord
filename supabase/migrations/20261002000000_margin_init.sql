-- Margin: learner progress, lab captures, work outputs and certificates.
-- Course content itself lives in the git repository (content/courses) and is
-- bundled into the app; the database only stores what a learner does.

create table if not exists public.learner_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  prefs        jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create table if not exists public.step_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  course_id  text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  step_id    text not null check (step_id ~ '^[a-z0-9][a-z0-9-]*$'),
  score      real check (score is null or (score >= 0 and score <= 1)),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, step_id)
);

create table if not exists public.lab_captures (
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  capture_key text not null check (char_length(capture_key) between 1 and 80),
  summary     text not null default '',
  payload     jsonb not null default '{}'::jsonb,
  saved_at    timestamptz not null default now(),
  primary key (user_id, course_id, capture_key),
  constraint lab_captures_payload_size check (pg_column_size(payload) < 200000)
);

create table if not exists public.work_outputs (
  user_id    uuid not null references auth.users (id) on delete cascade,
  course_id  text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  output_id  text not null check (output_id ~ '^[a-z0-9][a-z0-9-]*$'),
  fields     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, output_id),
  constraint work_outputs_fields_size check (pg_column_size(fields) < 200000)
);

create table if not exists public.certificates (
  id             text primary key check (id ~ '^MRG-[A-Z0-9]{1,6}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  user_id        uuid not null references auth.users (id) on delete cascade,
  course_id      text not null,
  learner_name   text not null,
  course_title   text not null,
  course_version text not null,
  issued_at      timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists step_progress_user_course on public.step_progress (user_id, course_id);
create index if not exists lab_captures_user_course on public.lab_captures (user_id, course_id);
create index if not exists work_outputs_user_course on public.work_outputs (user_id, course_id);

-- ───────────── row level security: a learner sees and edits only their rows ─────────────

alter table public.learner_profiles enable row level security;
alter table public.step_progress    enable row level security;
alter table public.lab_captures     enable row level security;
alter table public.work_outputs     enable row level security;
alter table public.certificates     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['learner_profiles','step_progress','lab_captures','work_outputs'] loop
    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Certificates are append-only for their owner: once issued they are not edited.
drop policy if exists "own certificates: select" on public.certificates;
drop policy if exists "own certificates: insert" on public.certificates;
create policy "own certificates: select" on public.certificates
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own certificates: insert" on public.certificates
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Anyone holding a credential id can confirm it (name, course, version, date only).
create or replace function public.verify_certificate(credential text)
returns table (learner_name text, course_title text, course_version text, issued_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.learner_name, c.course_title, c.course_version, c.issued_at
  from public.certificates c
  where c.id = credential
$$;

revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

grant select, insert, update, delete on public.learner_profiles, public.step_progress, public.lab_captures, public.work_outputs to authenticated;
grant select, insert on public.certificates to authenticated;
