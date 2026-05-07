-- Pack-conditional publish snapshot + question-level lock.
--
-- Decision 3B from GLOBAL_SURVEY_PLAN §2.7: only surveys whose pack opts
-- in (requires_publish_snapshot=true; currently the vendor and compliance
-- packs) snapshot their questions on publish and lock the questions
-- table for that survey. HMS-pulse, engagement, and exit surveys remain
-- editable post-publish — pulse iteration is the design intent for those.
--
-- Two triggers:
--   1. surveys_capture_publish_snapshot   BEFORE UPDATE on surveys —
--      when status transitions to 'active' AND the row's pack has
--      requires_publish_snapshot=true, copies the survey's questions
--      (ordered by order_index) into questions_snapshot and sets
--      published_definition_locked=true.
--   2. org_survey_questions_block_when_locked  BEFORE INSERT/UPDATE/DELETE
--      on org_survey_questions — rejects any write whose parent survey
--      has published_definition_locked=true. The lock applies only to
--      the questions table; the survey row itself can still transition
--      status (active → closed → archived), be renamed, or have its
--      summary updated.

-- ── Schema additions ───────────────────────────────────────────────────────

alter table public.surveys
  add column if not exists questions_snapshot          jsonb,
  add column if not exists published_definition_locked boolean not null default false;

create index if not exists surveys_locked_idx
  on public.surveys (organization_id, published_definition_locked)
  where published_definition_locked = true;

-- ── Trigger 1: capture snapshot on publish for opted-in packs ──────────────

create or replace function public.surveys_capture_publish_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requires  boolean;
  v_questions jsonb;
begin
  -- Skip if no pack assigned (legacy rows that escaped the auto-derivation).
  -- They simply don't snapshot — pre-existing behaviour preserved.
  if new.pack is null then
    return new;
  end if;

  -- Only fire on status transition INTO 'active' (publish event).
  if new.status = 'active' and old.status is distinct from 'active' then

    select coalesce(p.requires_publish_snapshot, false)
    into v_requires
    from public.survey_packs p
    where p.organization_id = new.organization_id
      and p.slug = new.pack;

    if v_requires then
      -- Idempotent: if already snapshotted (re-publish edge case), skip.
      if new.questions_snapshot is not null and new.published_definition_locked then
        return new;
      end if;

      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',            q.id,
            'question_text', q.question_text,
            'question_type', q.question_type,
            'order_index',   q.order_index,
            'is_required',   q.is_required,
            'is_mandatory',  q.is_mandatory,
            'mandatory_law', q.mandatory_law,
            'section_id',    q.section_id,
            'config',        q.config
          )
          order by q.order_index, q.id
        ),
        '[]'::jsonb
      )
      into v_questions
      from public.org_survey_questions q
      where q.survey_id = new.id;

      new.questions_snapshot          := v_questions;
      new.published_definition_locked := true;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists surveys_capture_publish_snapshot_tg on public.surveys;
create trigger surveys_capture_publish_snapshot_tg
  before update on public.surveys
  for each row execute function public.surveys_capture_publish_snapshot();

-- ── Trigger 2: block question writes when parent survey is locked ──────────

create or replace function public.org_survey_questions_block_when_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
  v_locked    boolean;
begin
  v_survey_id := coalesce(new.survey_id, old.survey_id);

  select published_definition_locked into v_locked
  from public.surveys
  where id = v_survey_id;

  if coalesce(v_locked, false) = true then
    raise exception
      'Survey % er publisert med låst spørsmålsdefinisjon (compliance/leverandør-pakke); spørsmål kan ikke endres.',
      v_survey_id
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists org_survey_questions_block_when_locked_insert_tg on public.org_survey_questions;
create trigger org_survey_questions_block_when_locked_insert_tg
  before insert on public.org_survey_questions
  for each row execute function public.org_survey_questions_block_when_locked();

drop trigger if exists org_survey_questions_block_when_locked_update_tg on public.org_survey_questions;
create trigger org_survey_questions_block_when_locked_update_tg
  before update on public.org_survey_questions
  for each row execute function public.org_survey_questions_block_when_locked();

drop trigger if exists org_survey_questions_block_when_locked_delete_tg on public.org_survey_questions;
create trigger org_survey_questions_block_when_locked_delete_tg
  before delete on public.org_survey_questions
  for each row execute function public.org_survey_questions_block_when_locked();
