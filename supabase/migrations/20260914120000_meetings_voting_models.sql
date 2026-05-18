-- Meetings · voting models (L2) + per-ballot record (L3 pre-vote).
--
-- Why
--   AML § 7-1 (2) requires partssammensatt utvalg med "parity" voting —
--   majority on BOTH sides for a vedtak to pass. Today our schema only
--   stores integer tallies (vote_for/against/abstain) with no side
--   awareness and no model selector. The audit cannot recompute the
--   correct AMU result from the row data.
--
--   This migration:
--   1. Adds `voting_model` to meeting_agenda_items so each vedtak knows
--      whether to count simple / qualified (2/3) / parity / consensus /
--      anonymous.
--   2. Adds `meeting_votes` for individual ballots — one row per voter,
--      with `side` (employer/employee/bht/external) so parity can be
--      derived. Includes `is_pre_vote` for the async case (L3).
--   3. Helper function `meeting_vote_result(agenda_item_id)` returns the
--      computed outcome JSON applying the right rule for the model.
--
-- Self-audit (Arbeidstilsynet POV)
--   AML § 7-1 (2) + § 7-2: parity stemmegivning er nå representerbart.
--   Forskrift om org. ledelse § 3-16: vote_for/against/abstain
--   integer-felter er fortsatt på agenda-item for bakoverkompatibilitet;
--   resultatet kan kryssjekkes mot ballot-summen i meeting_votes.

set local search_path = public, pg_catalog;

-- ── 1. Voting model on agenda items ────────────────────────────────────────

alter table public.meeting_agenda_items
  add column if not exists voting_model text
    check (voting_model in ('simple','qualified','parity','consensus','anonymous'));

alter table public.meeting_agenda_items
  add column if not exists pre_vote_opens_at timestamptz;

alter table public.meeting_agenda_items
  add column if not exists pre_vote_closes_at timestamptz;

comment on column public.meeting_agenda_items.voting_model is
  'Stemmegivnings-modell for vedtak: simple / qualified (2/3) / parity (AMU AML § 7-1 (2)) / consensus / anonymous. Default null = ikke et vedtak.';

-- ── 2. Per-ballot record ──────────────────────────────────────────────────

create table if not exists public.meeting_votes (
  id              uuid primary key default gen_random_uuid(),
  agenda_item_id  uuid not null references public.meeting_agenda_items(id) on delete cascade,
  meeting_id      uuid not null references public.meetings(id) on delete cascade,
  member_id       uuid references public.organization_members(id) on delete set null,
  ballot          text not null check (ballot in ('yes','no','blank','abstain')),
  side            text check (side in ('employer','employee','bht','external','observer')),
  is_pre_vote     boolean not null default false,
  cast_at         timestamptz not null default now(),
  cast_by_user_id uuid,
  -- Anonymity: when the agenda item's voting_model = 'anonymous',
  -- member_id is set null at insert and the row exists only as a tally.
  unique (agenda_item_id, member_id)
);

create index if not exists meeting_votes_agenda_idx on public.meeting_votes (agenda_item_id);
create index if not exists meeting_votes_meeting_idx on public.meeting_votes (meeting_id);

comment on table public.meeting_votes is
  'Individual ballots for agenda items. One row per (agenda_item, member). is_pre_vote=true for async votes cast before the meeting. side enables parity calculation for AMU.';

alter table public.meeting_votes enable row level security;

drop policy if exists meeting_votes_select on public.meeting_votes;
create policy meeting_votes_select
  on public.meeting_votes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id
    )
  );

drop policy if exists meeting_votes_write on public.meeting_votes;
create policy meeting_votes_write
  on public.meeting_votes
  for all
  to authenticated
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

-- ── 3. meeting_vote_result(agenda_item_id) — derive outcome ────────────────

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
    count(*) filter (where ballot='no'  and side='employee')
  into
    v_yes, v_no, v_blank, v_abstain,
    v_emp_yes, v_emp_no, v_at_yes, v_at_no
  from public.meeting_votes
  where agenda_item_id = p_agenda_item_id;

  v_total := v_yes + v_no + v_blank + v_abstain;

  if v_total = 0 then
    return jsonb_build_object(
      'model', v_model,
      'passed', null,
      'reason', 'no_votes',
      'tally', jsonb_build_object('yes', 0, 'no', 0, 'blank', 0, 'abstain', 0)
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
      -- Both sides must individually have majority for yes
      v_passed := (v_emp_yes > v_emp_no) and (v_at_yes > v_at_no);
      v_reason := 'parity_both_sides';
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
      'employee_yes', v_at_yes,  'employee_no', v_at_no
    )
  );
end;
$$;

comment on function public.meeting_vote_result(uuid) is
  'Returns canonical outcome jsonb for a vedtak: {model, passed, reason, tally{yes/no/blank/abstain/total}, parity{emp/at yes-no}}. Applies the correct rule for the agenda item''s voting_model.';

grant execute on function public.meeting_vote_result(uuid) to authenticated;
