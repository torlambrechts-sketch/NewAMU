-- OKR check-ins (H2.1)
--
-- Gap closed: strategy was a set-and-forget artifact — KR values changed by
-- silent overwrite with no history, no rhythm, and no way to see "been
-- at-risk for 6 weeks" vs "just slipped". okr_checkins is an append-only
-- log; okr_record_checkin() writes the log row and syncs the KR's live
-- confidence/current_value atomically.
--
-- Self-audit (Arbeidstilsynet POV): periodic, dated review of HMS goals is
-- now evidenced (IK-f § 5 nr. 7 — systematisk overvåking). Restrisiko:
-- check-ins are not yet auto-scheduled per KR (the kadens library ships a
-- recommended recurring 'OKR-innsjekk' task instead), and the meeting link
-- (meeting_id) is populated first by H2.2.
--
-- usage:
--   select okr_record_checkin(
--     p_kr_id      => '...',     -- key result
--     p_confidence => 0.55,      -- 0..1
--     p_value      => 47,        -- null to keep current (always null in rollup mode)
--     p_note       => 'Venter på BHT-rapport',
--     p_meeting_id => null       -- set when recorded from a meeting (H2.2)
--   );

create table if not exists public.okr_checkins (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key_result_id   uuid not null references public.okr_key_results(id) on delete cascade,
  -- KR-verdi ved innsjekk (null = uendret / rollup-styrt).
  value           numeric,
  -- Confidence-snapshot 0..1 (samme skala som okr_key_results.confidence).
  confidence      numeric(3, 2) not null
    check (confidence >= 0 and confidence <= 1),
  -- Kort narrativ, nb — "hvorfor står det slik".
  note            text,
  -- Satt når innsjekken gjøres fra et møte (H2.2). Ingen FK over
  -- modulgrensen; verifiseres av trigger mot samme org.
  meeting_id      uuid,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table public.okr_checkins is
  'Append-only innsjekkslogg per key result. Ingen update/delete-policy — '
  'historikken ER revisjonsverdien.';

create index if not exists okr_checkins_kr_created_idx
  on public.okr_checkins (key_result_id, created_at desc);

create index if not exists okr_checkins_org_idx
  on public.okr_checkins (organization_id, created_at desc);

-- Cross-org guard: KR (and meeting, when set) must belong to the check-in's
-- own org. Mirrors okr_task_links_validate_cross_org.
create or replace function public.okr_checkins_validate_cross_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_kr_org uuid;
  v_meeting_org uuid;
begin
  select organization_id into v_kr_org
    from public.okr_key_results where id = new.key_result_id;
  if v_kr_org is null or v_kr_org <> new.organization_id then
    raise exception 'Key result % er ikke i samme org som innsjekken.', new.key_result_id;
  end if;
  if new.meeting_id is not null then
    select organization_id into v_meeting_org
      from public.meetings where id = new.meeting_id;
    if v_meeting_org is null or v_meeting_org <> new.organization_id then
      raise exception 'Møte % er ikke i samme org som innsjekken.', new.meeting_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists okr_checkins_cross_org on public.okr_checkins;
create trigger okr_checkins_cross_org
  before insert on public.okr_checkins
  for each row execute function public.okr_checkins_validate_cross_org();

alter table public.okr_checkins enable row level security;

-- Alle org-medlemmer leser og skriver innsjekk (i motsetning til KR-CRUD som
-- er admin/plan-skaper): en KR-eier uten admin-rolle MÅ kunne sjekke inn.
-- Ingen update/delete-policy — loggen er append-only.
drop policy if exists okr_checkins_select_org on public.okr_checkins;
create policy okr_checkins_select_org
  on public.okr_checkins for select
  using (organization_id = public.current_org_id());

drop policy if exists okr_checkins_insert_org on public.okr_checkins;
create policy okr_checkins_insert_org
  on public.okr_checkins for insert
  with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
  );

-- Atomic check-in: log row + KR sync in one call. Security definer so a
-- non-admin KR owner can move the live confidence even though direct
-- okr_key_results UPDATE is admin/plan-creator-gated. Value is only applied
-- in manual mode — rollup-mode values are owned by okr_kr_recompute_rollup.
create or replace function public.okr_record_checkin(
  p_kr_id uuid,
  p_confidence numeric,
  p_value numeric default null,
  p_note text default null,
  p_meeting_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
  v_mode text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id, progress_mode into v_org, v_mode
    from public.okr_key_results where id = p_kr_id;
  if v_org is null or v_org <> public.current_org_id() then
    raise exception 'Key result ikke funnet i din organisasjon.';
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'Confidence må være mellom 0 og 1.';
  end if;

  insert into public.okr_checkins
    (organization_id, key_result_id, value, confidence, note, meeting_id, created_by)
  values
    (v_org, p_kr_id,
     case when v_mode = 'task_rollup' then null else p_value end,
     p_confidence, nullif(trim(coalesce(p_note, '')), ''), p_meeting_id, auth.uid())
  returning id into v_id;

  update public.okr_key_results
     set confidence = p_confidence,
         current_value = case
           when v_mode = 'task_rollup' or p_value is null then current_value
           else p_value
         end,
         updated_at = now()
   where id = p_kr_id;

  return v_id;
end;
$$;

grant execute on function public.okr_record_checkin(uuid, numeric, numeric, text, uuid) to authenticated;
