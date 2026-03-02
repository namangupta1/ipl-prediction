-- Add question-level locking and settlement fields (idempotent)
alter table public.questions
  add column if not exists is_locked boolean not null default false,
  add column if not exists is_settled boolean not null default false,
  add column if not exists correct_option_id uuid;

-- Optional FK for correct answer reference (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_correct_option_id_fkey'
  ) then
    alter table public.questions
      add constraint questions_correct_option_id_fkey
      foreign key (correct_option_id)
      references public.options(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_questions_match_is_settled
  on public.questions(match_id, is_settled);

-- Backfill from legacy options.is_correct when present
with resolved as (
  select
    o.question_id,
    max(o.id) filter (where o.is_correct is true) as correct_option_id
  from public.options o
  group by o.question_id
)
update public.questions q
set
  correct_option_id = r.correct_option_id,
  is_settled = (r.correct_option_id is not null),
  is_locked = case when r.correct_option_id is not null then true else q.is_locked end
from resolved r
where q.id = r.question_id
  and (
    q.correct_option_id is distinct from r.correct_option_id
    or q.is_settled is distinct from (r.correct_option_id is not null)
    or (r.correct_option_id is not null and q.is_locked = false)
  );
