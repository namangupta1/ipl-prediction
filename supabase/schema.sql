-- DB IPL — Guess & Earn (Phase 1)
-- Source: docs/PRD.md (Build Pack + Data Model)

set search_path = public;
set timezone = 'UTC';

create extension if not exists pgcrypto;

-- Enums
create type match_state_enum as enum (
  'upcoming',
  'toss_completed',
  'innings_1_phase_1',
  'innings_1_phase_2',
  'innings_1_phase_3',
  'innings_1_completed',
  'innings_2_phase_1',
  'innings_2_phase_2',
  'innings_2_phase_3',
  'completed'
);

create type question_category_enum as enum (
  'pre_match',
  'innings_1_phase_1',
  'innings_1_phase_2',
  'innings_1_phase_3',
  'innings_2_phase_1',
  'innings_2_phase_2',
  'innings_2_phase_3'
);

create type question_status_enum as enum (
  'draft',
  'published',
  'locked',
  'settled'
);

-- Tables
create table matches (
  id uuid primary key default gen_random_uuid(),
  match_number integer not null unique check (match_number > 0),
  team_a text not null check (char_length(trim(team_a)) between 1 and 50),
  team_b text not null check (char_length(trim(team_b)) between 1 and 50),
  match_date date not null,
  match_state match_state_enum not null default 'upcoming',
  prize_name text check (prize_name is null or char_length(trim(prize_name)) <= 100),
  prize_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  question_text text not null check (char_length(trim(question_text)) between 1 and 200),
  question_category question_category_enum not null,
  display_order integer not null check (display_order > 0),
  question_status question_status_enum not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, question_category, display_order)
);

create table options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  option_text text not null check (char_length(trim(option_text)) between 1 and 80),
  display_order integer not null check (display_order > 0),
  is_correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, display_order),
  unique (question_id, id)
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  user_key uuid not null,
  match_id uuid not null references matches(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  option_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_key, question_id),
  foreign key (question_id, option_id) references options(question_id, id) on delete restrict
);

create table user_profiles (
  user_key uuid primary key,
  display_name text not null check (char_length(trim(display_name)) between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table winners (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  winner_name text not null check (char_length(trim(winner_name)) between 1 and 50),
  display_order integer not null check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, display_order)
);

-- Indexes
create index idx_questions_match_id on questions(match_id);
create index idx_questions_match_state on questions(match_id, question_status, question_category, display_order);

create index idx_options_question_id on options(question_id);

create index idx_answers_match_id on answers(match_id);
create index idx_answers_user_match_created on answers(user_key, match_id, created_at);
create index idx_answers_match_created on answers(match_id, created_at);
create index idx_answers_question_id on answers(question_id);

create index idx_winners_match_display on winners(match_id, display_order);
create index idx_winners_winner_name on winners(winner_name);

create index idx_user_profiles_display_name on user_profiles(display_name);

-- Utility triggers
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_matches_set_updated_at
before update on matches
for each row
execute function set_updated_at();

create trigger trg_questions_set_updated_at
before update on questions
for each row
execute function set_updated_at();

create trigger trg_options_set_updated_at
before update on options
for each row
execute function set_updated_at();

create trigger trg_answers_set_updated_at
before update on answers
for each row
execute function set_updated_at();

create trigger trg_user_profiles_set_updated_at
before update on user_profiles
for each row
execute function set_updated_at();

create trigger trg_winners_set_updated_at
before update on winners
for each row
execute function set_updated_at();

-- Validation: option count must be exactly 2 or 4 per question
create or replace function enforce_option_count_per_question()
returns trigger
language plpgsql
as $$
declare
  v_question_ids uuid[] := '{}';
  v_question_id uuid;
  v_count integer;
begin
  if tg_op = 'INSERT' then
    v_question_ids := array[new.question_id];
  elsif tg_op = 'DELETE' then
    v_question_ids := array[old.question_id];
  else
    v_question_ids := array[new.question_id, old.question_id];
  end if;

  foreach v_question_id in array v_question_ids loop
    if v_question_id is null then
      continue;
    end if;

    select count(*) into v_count
    from options
    where question_id = v_question_id;

    if v_count not in (2, 4) then
      raise exception 'Each question must have exactly 2 or 4 options. question_id=% has % options', v_question_id, v_count;
    end if;
  end loop;

  return null;
end;
$$;

create constraint trigger trg_options_count_validation
after insert or update or delete on options
deferrable initially deferred
for each row
execute function enforce_option_count_per_question();

-- Validation: max 50 winners per match
create or replace function enforce_winner_limit_per_match()
returns trigger
language plpgsql
as $$
declare
  v_match_ids uuid[] := '{}';
  v_match_id uuid;
  v_count integer;
begin
  if tg_op = 'INSERT' then
    v_match_ids := array[new.match_id];
  elsif tg_op = 'DELETE' then
    v_match_ids := array[old.match_id];
  else
    v_match_ids := array[new.match_id, old.match_id];
  end if;

  foreach v_match_id in array v_match_ids loop
    if v_match_id is null then
      continue;
    end if;

    select count(*) into v_count
    from winners
    where match_id = v_match_id;

    if v_count > 50 then
      raise exception 'A match can have at most 50 winners. match_id=% has % winners', v_match_id, v_count;
    end if;
  end loop;

  return null;
end;
$$;

create constraint trigger trg_winners_limit_validation
after insert or update or delete on winners
deferrable initially deferred
for each row
execute function enforce_winner_limit_per_match();

-- RLS
create or replace function is_cms_editor()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'service_role'
    or coalesce(auth.jwt() ->> 'app_role', '') = 'cms_editor'
    or lower(coalesce(auth.jwt() ->> 'is_cms', 'false')) = 'true';
$$;

alter table matches enable row level security;
alter table questions enable row level security;
alter table options enable row level security;
alter table answers enable row level security;
alter table user_profiles enable row level security;
alter table winners enable row level security;

-- matches: SELECT public; INSERT/UPDATE/DELETE CMS only
create policy matches_select_public on matches
for select
to anon, authenticated
using (true);

create policy matches_insert_cms on matches
for insert
to authenticated
with check (is_cms_editor());

create policy matches_update_cms on matches
for update
to authenticated
using (is_cms_editor())
with check (is_cms_editor());

create policy matches_delete_cms on matches
for delete
to authenticated
using (is_cms_editor());

-- questions: SELECT public (non-draft); INSERT/UPDATE CMS only
create policy questions_select_public_non_draft on questions
for select
to anon, authenticated
using (question_status <> 'draft');

create policy questions_insert_cms on questions
for insert
to authenticated
with check (is_cms_editor());

create policy questions_update_cms on questions
for update
to authenticated
using (is_cms_editor())
with check (is_cms_editor());

-- options: SELECT public; INSERT/UPDATE CMS only
create policy options_select_public on options
for select
to anon, authenticated
using (true);

create policy options_insert_cms on options
for insert
to authenticated
with check (is_cms_editor());

create policy options_update_cms on options
for update
to authenticated
using (is_cms_editor())
with check (is_cms_editor());

-- answers: SELECT/INSERT/UPDATE public; DELETE none
create policy answers_select_public on answers
for select
to anon, authenticated
using (true);

create policy answers_insert_public on answers
for insert
to anon, authenticated
with check (true);

create policy answers_update_public on answers
for update
to anon, authenticated
using (true)
with check (true);

-- user_profiles: SELECT/INSERT/UPDATE public
create policy user_profiles_select_public on user_profiles
for select
to anon, authenticated
using (true);

create policy user_profiles_insert_public on user_profiles
for insert
to anon, authenticated
with check (true);

create policy user_profiles_update_public on user_profiles
for update
to anon, authenticated
using (true)
with check (true);

-- winners: SELECT public; INSERT/DELETE CMS only
create policy winners_select_public on winners
for select
to anon, authenticated
using (true);

create policy winners_insert_cms on winners
for insert
to authenticated
with check (is_cms_editor());

create policy winners_delete_cms on winners
for delete
to authenticated
using (is_cms_editor());
