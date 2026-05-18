-- Meetings · voting + speaker-queue hardening from external review.
--
-- 1. Parity edge case fix in meeting_vote_result(): when one side has
--    zero yes-votes, the previous logic returned `passed=false` even if
--    the other side was unanimous. Per AML practice this is "vote
--    invalid, missing-side" — distinct from "not passed". Adds explicit
--    parity_missing_employer / parity_missing_employee reason codes.
--
-- 2. Denormalised organization_id on meeting_votes + meeting_speaker_queue.
--    Postgres RLS already cascades through the EXISTS-from-meetings
--    subquery in the existing write policies (verified), but an explicit
--    organization_id + current_org_id() predicate is defense-in-depth
--    that an outside auditor can read at the policy level without
--    chasing the join.

set local search_path = public, pg_catalog;

-- ── 1. organization_id denorm on meeting_votes ────────────────────────────

alter table public.meeting_votes
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- Backfill from parent meeting
update public.meeting_votes v
   set organization_id = m.organization_id
  from public.meetings m
 where v.meeting_id = m.id
   and v.organization_id is null;

alter table public.meeting_votes
  alter column organization_id set not null;

create index if not exists meeting_votes_org_idx on public.meeting_votes (organization_id);

-- Tighten write policy to require org match in WITH CHECK
drop policy if exists meeting_votes_write on public.meeting_votes;
create policy meeting_votes_write
  on public.meeting_votes
  for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

-- Auto-populate organization_id on insert from the parent meeting so
-- clients don't need to pass it (matches the meeting_id source of truth).
create or replace function public.meeting_votes_set_org_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.organization_id is null then
    select organization_id into new.organization_id
      from public.meetings where id = new.meeting_id;
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_votes_set_org_id_tg on public.meeting_votes;
create trigger meeting_votes_set_org_id_tg
  before insert on public.meeting_votes
  for each row execute function public.meeting_votes_set_org_id();

revoke execute on function public.meeting_votes_set_org_id() from public, anon, authenticated;

-- ── 2. organization_id denorm on meeting_speaker_queue ────────────────────

alter table public.meeting_speaker_queue
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.meeting_speaker_queue q
   set organization_id = m.organization_id
  from public.meetings m
 where q.meeting_id = m.id
   and q.organization_id is null;

alter table public.meeting_speaker_queue
  alter column organization_id set not null;

create index if not exists meeting_speaker_queue_org_idx
  on public.meeting_speaker_queue (organization_id);

drop policy if exists meeting_speaker_queue_write on public.meeting_speaker_queue;
create policy meeting_speaker_queue_write
  on public.meeting_speaker_queue
  for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

create or replace function public.meeting_speaker_queue_set_org_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.organization_id is null then
    select organization_id into new.organization_id
      from public.meetings where id = new.meeting_id;
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_speaker_queue_set_org_id_tg on public.meeting_speaker_queue;
create trigger meeting_speaker_queue_set_org_id_tg
  before insert on public.meeting_speaker_queue
  for each row execute function public.meeting_speaker_queue_set_org_id();

revoke execute on function public.meeting_speaker_queue_set_org_id() from public, anon, authenticated;

-- ── 3. Parity edge case + missing-side reason codes ───────────────────────

create or replace function public.meeting_vote_result(p_agenda_item_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_model text;
  v_yes int := 0;
  v_no  int := 0;
  v_blank int := 0;
  v_abstain int := 0;
  v_emp_yes int := 0;
  v_emp_no  int := 0;
  v_at_yes  int := 0;
  v_at_no   int := 0;
  v_emp_total int := 0;
  v_at_total int := 0;
  v_total int;
  v_passed boolean;
  v_reason text;
begin
  select voting_model into v_model
    from public.meeting_agenda_items
   where id = p_agenda_item_id;

  if v_model is null then
    return jsonb_build_object('model', null, 'passed', null);
  end if;

  select
    count(*) filter (where ballot='yes'),
    count(*) filter (where ballot='no'),
    count(*) filter (where ballot='blank'),
    count(*) filter (where ballot='abstain'),
    count(*) filter (where ballot='yes' and side='employer'),
    count(*) filter (where ballot='no'  and side='employer'),
    count(*) filter (where ballot='yes' and side='employee'),
    count(*) filter (where ballot='no'  and side='employee'),
    count(*) filter (where side='employer'),
    count(*) filter (where side='employee')
  into v_yes, v_no, v_blank, v_abstain,
       v_emp_yes, v_emp_no, v_at_yes, v_at_no,
       v_emp_total, v_at_total
  from public.meeting_votes
  where agenda_item_id = p_agenda_item_id;

  v_total := v_yes + v_no + v_blank + v_abstain;

  if v_total = 0 then
    return jsonb_build_object(
      'model', v_model,
      'passed', null,
      'reason', 'no_votes',
      'tally', jsonb_build_object('yes', 0, 'no', 0, 'blank', 0, 'abstain', 0, 'total', 0)
    );
  end if;

  case v_model
    when 'simple' then
      v_passed := v_yes > v_no;
      v_reason := 'simple_majority';
    when 'qualified' then
      v_passed := (v_yes::numeric / nullif(v_yes + v_no + v_blank, 0)) >= 2.0/3.0;
      v_reason := 'qualified_two_thirds';
    when 'parity' then
      -- One side absent → vote invalid (not "not passed"), per AML
      -- practice. Partssammensatt utvalg krever begge sider til stede.
      if v_emp_total = 0 then
        v_passed := null;
        v_reason := 'parity_missing_employer';
      elsif v_at_total = 0 then
        v_passed := null;
        v_reason := 'parity_missing_employee';
      else
        v_passed := (v_emp_yes > v_emp_no) and (v_at_yes > v_at_no);
        v_reason := 'parity_both_sides';
      end if;
    when 'consensus' then
      v_passed := v_no = 0;
      v_reason := 'consensus_no_opposition';
    when 'anonymous' then
      v_passed := v_yes > v_no;
      v_reason := 'simple_majority_anon';
    else
      v_passed := null;
      v_reason := 'unknown_model';
  end case;

  return jsonb_build_object(
    'model', v_model,
    'passed', v_passed,
    'reason', v_reason,
    'tally', jsonb_build_object(
      'yes', v_yes, 'no', v_no, 'blank', v_blank, 'abstain', v_abstain,
      'total', v_total
    ),
    'parity', jsonb_build_object(
      'employer_yes', v_emp_yes, 'employer_no', v_emp_no,
      'employer_total', v_emp_total,
      'employee_yes', v_at_yes,  'employee_no', v_at_no,
      'employee_total', v_at_total
    )
  );
end;
$$;

grant execute on function public.meeting_vote_result(uuid) to authenticated;
