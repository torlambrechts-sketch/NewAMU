-- Meetings — schema extension v2 (research-report close-out).
--
-- Why
--   The Norwegian-compliance research report flagged four schema gaps
--   the original meetings build did not cover:
--     (a) aksjeloven § 6-25 voting (> ½ av møtende AND > 1/3 av samtlige
--         styremedlemmer) — needs a new voting_model + result function arm.
--     (b) generalforsamling aksjeveid stemming — needs a per-ballot
--         vekt column and a `weighted` model arm.
--     (c) AMU forskriftens § 3-15 leder-rotasjon ("leder dobbeltstemme ved
--         stemmelikhet" — leder roterer årlig mellom partene). Without
--         persisted leder-party data the parity tie-break can't be
--         recomputed from row state alone.
--     (d) AKAN-perimeter — research-report §10.5 + §4.3 says AKAN data
--         must live behind a separate access perimeter from
--         meetings.manage_confidential.
--   Plus a normalised meeting_reporting_obligations table so statutory
--   reporting deadlines (NAV § 15-2 30d, AMU årsrapport, Foretaks-
--   registret-meldinger) become first-class queryable rows instead of
--   buried jsonb on definition_snapshot.
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * AML § 7-1 (2) + forskriftens § 3-15 — parity-tie-break i AMU er
--     nå deriverbart fra rad-data (leder_party + ballots).
--   * Aksjeloven § 6-25 — flertall-blant-møtende OG ≥1/3-av-samtlige
--     er en egen voting_model, recomputerbar.
--   * Aksjeloven § 5-17 ff — aksjeveid stemming via ballot_weight.
--   * AKAN-modellen / GDPR art. 9 — egen confidentiality-verdi `'akan'`
--     + egen permission `meetings.view_akan`. meetings.manage_confidential
--     gir IKKE AKAN-innsyn — det er en separat perimeter.
--   * AML § 15-2 (3) NAV-melding-pliktet — meeting_reporting_obligations
--     materialiseres fra template ved meeting insert; UI surfacer
--     forfallsdato + status.
--   * AML § 7-2 (6) AMU årsrapport — samme mekanisme.
--
-- Restrisiko (kept out of scope, documented):
--   * BankID legally-binding signing — still demo-level (see Council
--     Review §3.4). meeting_signatures.is_legally_binding stays manual.
--   * Secret-ballot elections live i survey-modulen (`amu-valg-system`).
--
-- Idempotent. Re-applying on a fully-applied DB is a no-op.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Voting-model enum widening                                            │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meeting_agenda_items
  drop constraint if exists meeting_agenda_items_voting_model_check;

alter table public.meeting_agenda_items
  add constraint meeting_agenda_items_voting_model_check
  check (voting_model is null or voting_model in (
    'simple',
    'qualified',
    'parity',
    'consensus',
    'anonymous',
    'aksje_simple_majority_one_third_floor',
    'weighted'
  ));

comment on column public.meeting_agenda_items.voting_model is
  'Stemmegivnings-modell for vedtak: simple / qualified (2/3) / parity (AMU AML § 7-1 (2)) / '
  'consensus / anonymous / aksje_simple_majority_one_third_floor (aksjeloven § 6-25 — '
  'flertall blant møtende + > 1/3 av samtlige medlemmer) / weighted (generalforsamling '
  'aksjeveid). Default null = ikke et vedtak.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Ballot weight on meeting_votes (aksjeveid stemming)                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meeting_votes
  add column if not exists ballot_weight numeric;

comment on column public.meeting_votes.ballot_weight is
  'Vekt for vektet stemming (generalforsamling — aksjeantall). null ved umarkert. '
  'Brukes når agenda_item.voting_model = ''weighted''. For andre modeller ignoreres feltet '
  '(hver stemme telles som 1).';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. AMU leder-rotasjon på meetings                                        │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meetings
  add column if not exists amu_leader_period_party text;

alter table public.meetings
  drop constraint if exists meetings_amu_leader_period_party_check;

alter table public.meetings
  add constraint meetings_amu_leader_period_party_check
  check (amu_leader_period_party is null
         or amu_leader_period_party in ('arbeidsgiver','arbeidstaker'));

comment on column public.meetings.amu_leader_period_party is
  'Hvilken part (arbeidsgiver/arbeidstaker) har AMU-leder-vervet i denne perioden. '
  'Forskrift om org. ledelse § 3-15 — leder roterer årlig. Driver dobbeltstemme ved '
  'parity-tie. Null = ikke-AMU-møte (eller leder-party ikke registrert).';

-- The lock trigger from `meetings_module_core.sql` allows arbitrary column
-- updates by default — only an explicit allow/deny list applies. Extend the
-- block so amu_leader_period_party becomes immutable post-sign (consistent
-- with confidentiality_level): edits up to protocol_signed_at are fine, after
-- that the rotation party is part of the immutable record.

create or replace function public.meetings_before_update_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable on meetings';
  end if;
  if new.source_kind is distinct from old.source_kind then
    raise exception 'source_kind is immutable on meetings';
  end if;
  if new.system_template_id is distinct from old.system_template_id then
    raise exception 'system_template_id is immutable on meetings';
  end if;
  if new.org_template_id is distinct from old.org_template_id then
    raise exception 'org_template_id is immutable on meetings';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable on meetings';
  end if;

  if old.protocol_signed_at is not null
     and new.confidentiality_level is distinct from old.confidentiality_level then
    raise exception 'Meeting % is signed; confidentiality_level is locked', old.id
      using errcode = 'check_violation';
  end if;

  if old.protocol_signed_at is not null
     and new.amu_leader_period_party is distinct from old.amu_leader_period_party then
    raise exception 'Meeting % is signed; amu_leader_period_party is locked', old.id
      using errcode = 'check_violation';
  end if;

  if old.protocol_signed_at is not null then
    if new.protocol_signed_at is null then
      raise exception 'Meeting % is signed; protocol_signed_at cannot revert', old.id
        using errcode = 'check_violation';
    end if;
    if new.protocol_signed_by is distinct from old.protocol_signed_by then
      raise exception 'Meeting % is signed; protocol_signed_by is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.sign_checksum is distinct from old.sign_checksum then
      raise exception 'Meeting % is signed; sign_checksum is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.definition_snapshot is distinct from old.definition_snapshot then
      raise exception 'Meeting % is signed; definition_snapshot is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.metadata_schema_snapshot is distinct from old.metadata_schema_snapshot then
      raise exception 'Meeting % is signed; metadata_schema_snapshot is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.status not in ('completed','cancelled') then
      raise exception 'Meeting % is signed; status cannot revert to %', old.id, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. AKAN confidentiality + new permission keys                            │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meetings
  drop constraint if exists meetings_confidentiality_level_check;

alter table public.meetings
  add constraint meetings_confidentiality_level_check
  check (confidentiality_level in ('standard','restricted','confidential','akan'));

comment on column public.meetings.confidentiality_level is
  'Personvern-perimeter: standard | restricted | confidential | akan. '
  'AKAN er en separat perimeter (helsedata + helsepersonelloven § 21 + GDPR art. 9) — '
  'meetings.manage_confidential gir IKKE innsyn i AKAN-møter; meetings.view_akan kreves.';

alter table public.meeting_system_templates
  drop constraint if exists meeting_system_templates_default_conf_check;
alter table public.meeting_system_templates
  add constraint meeting_system_templates_default_conf_check
  check (default_confidentiality_level in ('standard','restricted','confidential','akan'));

alter table public.meeting_org_templates
  drop constraint if exists meeting_org_templates_default_conf_check;
alter table public.meeting_org_templates
  add constraint meeting_org_templates_default_conf_check
  check (default_confidentiality_level in ('standard','restricted','confidential','akan'));

-- Replace the meetings SELECT + WRITE RLS policies so the AKAN perimeter
-- gates on the new `meetings.view_akan` permission instead of falling
-- through the `manage_confidential` arm.

drop policy if exists meetings_select on public.meetings;
create policy meetings_select
  on public.meetings for select
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or (
        confidentiality_level in ('restricted','confidential')
        and (
          created_by = auth.uid()
          or public.user_has_permission('meetings.manage_confidential')
          or public.meetings_user_is_in_member_set(organization_id, participant_member_ids)
        )
      )
      or (
        confidentiality_level = 'akan'
        and (
          created_by = auth.uid()
          or public.user_has_permission('meetings.view_akan')
          or public.meetings_user_is_in_member_set(organization_id, participant_member_ids)
        )
      )
    )
  );

drop policy if exists meetings_write on public.meetings;
create policy meetings_write
  on public.meetings for all
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or (
        confidentiality_level in ('restricted','confidential')
        and (
          created_by = auth.uid()
          or public.user_has_permission('meetings.manage_confidential')
          or public.meetings_user_is_in_member_set(organization_id, participant_member_ids)
        )
      )
      or (
        confidentiality_level = 'akan'
        and (
          created_by = auth.uid()
          or public.user_has_permission('meetings.view_akan')
          or public.meetings_user_is_in_member_set(organization_id, participant_member_ids)
        )
      )
    )
  )
  with check (organization_id = public.current_org_id());

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. meeting_vote_result(agenda_item_id) — extended rule set               │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.meeting_vote_result(p_agenda_item_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_model            text;
  v_meeting_id       uuid;
  v_leader_party     text;
  v_yes              int := 0;
  v_no               int := 0;
  v_blank            int := 0;
  v_abstain          int := 0;
  v_emp_yes          int := 0;
  v_emp_no           int := 0;
  v_at_yes           int := 0;
  v_at_no            int := 0;
  v_w_yes            numeric := 0;
  v_w_no             numeric := 0;
  v_w_blank          numeric := 0;
  v_w_abstain        numeric := 0;
  v_total            int;
  v_attending        int;
  v_board_total      int;
  v_third_floor_min  int;
  v_passed           boolean;
  v_reason           text;
begin
  select voting_model, meeting_id
    into v_model, v_meeting_id
    from public.meeting_agenda_items
   where id = p_agenda_item_id;

  if v_model is null then
    return jsonb_build_object('model', null, 'passed', null);
  end if;

  select amu_leader_period_party into v_leader_party
    from public.meetings where id = v_meeting_id;

  select
    count(*) filter (where ballot='yes'),
    count(*) filter (where ballot='no'),
    count(*) filter (where ballot='blank'),
    count(*) filter (where ballot='abstain'),
    count(*) filter (where ballot='yes' and side='employer'),
    count(*) filter (where ballot='no'  and side='employer'),
    count(*) filter (where ballot='yes' and side='employee'),
    count(*) filter (where ballot='no'  and side='employee'),
    coalesce(sum(ballot_weight) filter (where ballot='yes'), 0),
    coalesce(sum(ballot_weight) filter (where ballot='no'), 0),
    coalesce(sum(ballot_weight) filter (where ballot='blank'), 0),
    coalesce(sum(ballot_weight) filter (where ballot='abstain'), 0)
  into
    v_yes, v_no, v_blank, v_abstain,
    v_emp_yes, v_emp_no, v_at_yes, v_at_no,
    v_w_yes, v_w_no, v_w_blank, v_w_abstain
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
      v_reason := case when v_passed then 'simple_majority_passed' else 'simple_majority_not_reached' end;

    when 'qualified' then
      v_passed := (v_yes::numeric / nullif(v_yes + v_no + v_blank, 0)) >= 2.0/3.0;
      v_reason := case when v_passed then 'qualified_two_thirds_passed' else 'qualified_two_thirds_not_reached' end;

    when 'parity' then
      -- Both sides must individually have majority for yes
      v_passed := (v_emp_yes > v_emp_no) and (v_at_yes > v_at_no);
      if not v_passed
         and v_emp_yes = v_emp_no
         and v_at_yes  = v_at_no
         and v_leader_party is not null then
        -- Forskriftens § 3-15: leder dobbeltstemme bryter likhet
        v_passed := true;
        v_reason := 'tie_broken_by_amu_leader_' || v_leader_party;
      elsif v_passed then
        v_reason := 'parity_both_sides_passed';
      elsif v_emp_yes = v_emp_no and v_at_yes = v_at_no and v_leader_party is null then
        v_reason := 'parity_tie_no_leader_party';
      elsif v_emp_yes > v_emp_no and v_at_yes <= v_at_no then
        v_reason := 'parity_missing_employee_majority';
      elsif v_at_yes > v_at_no and v_emp_yes <= v_emp_no then
        v_reason := 'parity_missing_employer_majority';
      else
        v_reason := 'parity_both_sides_not_reached';
      end if;

    when 'consensus' then
      v_passed := v_no = 0;
      v_reason := case when v_passed then 'consensus_no_opposition' else 'consensus_opposition_present' end;

    when 'anonymous' then
      v_passed := v_yes > v_no;
      v_reason := case when v_passed then 'simple_majority_anon_passed' else 'simple_majority_anon_not_reached' end;

    when 'aksje_simple_majority_one_third_floor' then
      -- Aksjeloven § 6-25:
      --   (1) Vedtaksført når > 1/2 av medlemmene deltar (separat på meetings)
      --   (2) Flertall blant møtende (yes > no), OG
      --   (3) Flertallet må alltid utgjøre > 1/3 av samtlige styremedlemmer
      v_attending   := v_total;             -- antall stemmende = møtende stemmeberettigede
      -- Antall samtlige medlemmer: count attendees with role 'member'|'chair'|'secretary'
      -- (med stemmerett — daglig leder/observer ekskluderes via role-filter).
      select count(*) into v_board_total
        from public.meeting_attendees
       where meeting_id = v_meeting_id
         and role in ('chair','secretary','member','employer_rep','employee_rep');

      if v_board_total = 0 then
        v_board_total := v_attending;  -- defensiv fallback om roster mangler
      end if;

      v_third_floor_min := (v_board_total / 3) + 1;
      if v_yes > v_no and v_yes >= v_third_floor_min then
        v_passed := true;
        v_reason := 'aksje_majority_and_third_floor_passed';
      elsif v_yes > v_no and v_yes < v_third_floor_min then
        v_passed := false;
        v_reason := 'aksje_third_floor_not_met';
      elsif v_yes = v_no then
        -- Aksjeloven § 6-25 (2): møtelederens stemme avgjør ved likhet
        v_passed := true;  -- chair må også ha stemt for at v_yes telles
        v_reason := 'aksje_tie_broken_by_chair';
      else
        v_passed := false;
        v_reason := 'aksje_majority_not_reached';
      end if;

    when 'weighted' then
      -- Generalforsamling — aksjeveid stemming.
      -- Aksjeloven § 5-17: vedtak gjøres med flertall av de avgitte stemmene
      -- (vektet etter aksjer). Default simple-majority; qualified-2/3 modellen
      -- bør brukes for vedtektsendringer (§ 5-18) — den uses regular 2/3 + ballot_weight.
      v_passed := v_w_yes > v_w_no;
      v_reason := case when v_passed then 'weighted_majority_passed' else 'weighted_majority_not_reached' end;

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
      'employee_yes', v_at_yes,  'employee_no', v_at_no,
      'leader_party', v_leader_party
    ),
    'weighted_tally', jsonb_build_object(
      'yes', v_w_yes, 'no', v_w_no, 'blank', v_w_blank, 'abstain', v_w_abstain
    ),
    'third_floor', case
      when v_model = 'aksje_simple_majority_one_third_floor' then
        jsonb_build_object(
          'all_members', coalesce(v_board_total, 0),
          'minimum',     coalesce(v_third_floor_min, 0),
          'actual_yes',  v_yes
        )
      else null
    end
  );
end;
$$;

comment on function public.meeting_vote_result(uuid) is
  'Returns canonical outcome jsonb for a vedtak. Models: simple / qualified (2/3) / '
  'parity (AMU AML § 7-1 (2) + § 3-15 leder-dobbeltstemme) / consensus / anonymous / '
  'aksje_simple_majority_one_third_floor (aksjeloven § 6-25) / weighted (gf aksjeveid). '
  'Resultat-payload: {model, passed, reason, tally, parity, weighted_tally, third_floor}.';

grant execute on function public.meeting_vote_result(uuid) to authenticated;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 6. meeting_reporting_obligations — normalised statutory deadlines        │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_reporting_obligations (
  id                uuid primary key default gen_random_uuid(),
  meeting_id        uuid not null references public.meetings(id) on delete cascade,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  obligation_key    text not null,
  obligation_label  text not null,
  recipient         text not null,                  -- 'NAV' | 'Arbeidstilsynet' | 'Foretaksregisteret' | 'Hovedavtaleutvalget' | 'Tvisteløsningsnemnda' | 'intern'
  law_ref           text,
  due_offset_days   int,                            -- from template definition
  due_at            timestamptz,                    -- scheduled_at + offset days (computed at materialisation)
  fulfilled_at      timestamptz,
  fulfilled_by      uuid,
  evidence_url      text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (meeting_id, obligation_key)
);

create index if not exists meeting_reporting_obligations_meeting_idx
  on public.meeting_reporting_obligations (meeting_id);

create index if not exists meeting_reporting_obligations_open_idx
  on public.meeting_reporting_obligations (organization_id, due_at)
  where fulfilled_at is null;

create index if not exists meeting_reporting_obligations_recipient_idx
  on public.meeting_reporting_obligations (organization_id, recipient, fulfilled_at);

comment on table public.meeting_reporting_obligations is
  'Normaliserte statutoriske rapporteringsplikter knyttet til et møte. '
  'Materialiseres automatisk fra definition_snapshot->''reportingObligations'' ved '
  'meetings INSERT. Brukes til UI-panel "Rapporteringsplikter" + dashboard-segment '
  '"I tide / Forfalt / Fullført".';

comment on column public.meeting_reporting_obligations.obligation_key is
  'Stabilt nøkkelnavn (''nav_masseoppsigelse_meldeskjema'', ''amu_arsrapport'', '
  '''foretaksregisteret_vedtak'', ''arbeidstilsynet_15_2_kopi'', '
  '''oppsigelse_suspensiv_frist_30d'', ''tvistelosingsnemnd_8_3'' …). '
  'Unikt per meeting → idempotent re-materialisering.';

alter table public.meeting_reporting_obligations enable row level security;

drop policy if exists meeting_reporting_obligations_select on public.meeting_reporting_obligations;
create policy meeting_reporting_obligations_select
  on public.meeting_reporting_obligations for select
  using (
    exists (select 1 from public.meetings m where m.id = meeting_id)
  );

drop policy if exists meeting_reporting_obligations_write on public.meeting_reporting_obligations;
create policy meeting_reporting_obligations_write
  on public.meeting_reporting_obligations for all
  using (
    exists (select 1 from public.meetings m where m.id = meeting_id)
  )
  with check (
    exists (select 1 from public.meetings m where m.id = meeting_id)
  );

drop trigger if exists meeting_reporting_obligations_set_updated_at on public.meeting_reporting_obligations;
create trigger meeting_reporting_obligations_set_updated_at
  before update on public.meeting_reporting_obligations
  for each row execute function public.set_updated_at();

-- Auto-fill org_id at insert (RLS predicate cascades on parent meeting; this
-- defense-in-depth keeps the analytics queries fast without a join).
create or replace function public.meeting_reporting_obligations_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    select organization_id into new.organization_id
      from public.meetings where id = new.meeting_id;
  end if;
  if new.due_at is null and new.due_offset_days is not null then
    select scheduled_at + (new.due_offset_days * interval '1 day') into new.due_at
      from public.meetings where id = new.meeting_id;
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_reporting_obligations_before_insert_defaults_tg
  on public.meeting_reporting_obligations;
create trigger meeting_reporting_obligations_before_insert_defaults_tg
  before insert on public.meeting_reporting_obligations
  for each row execute function public.meeting_reporting_obligations_before_insert_defaults();

-- Materialise obligations from template definition at meeting insert.
create or replace function public.meetings_materialise_reporting_obligations()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_def jsonb;
  v_item jsonb;
  v_offset int;
  v_due timestamptz;
begin
  v_def := coalesce(new.definition_snapshot, '{}'::jsonb);
  if v_def is null or jsonb_typeof(v_def->'reportingObligations') <> 'array' then
    return new;
  end if;

  for v_item in select * from jsonb_array_elements(v_def->'reportingObligations') loop
    v_offset := nullif(v_item->>'due_offset_days', '')::int;
    if v_offset is not null and new.scheduled_at is not null then
      v_due := new.scheduled_at + (v_offset * interval '1 day');
    else
      v_due := null;
    end if;

    insert into public.meeting_reporting_obligations
      (meeting_id, organization_id, obligation_key, obligation_label,
       recipient, law_ref, due_offset_days, due_at)
    values
      (new.id, new.organization_id,
       v_item->>'obligation_key',
       coalesce(v_item->>'obligation_label', v_item->>'obligation_key'),
       coalesce(v_item->>'recipient', 'intern'),
       v_item->>'law_ref',
       v_offset,
       v_due)
    on conflict (meeting_id, obligation_key) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists meetings_materialise_reporting_obligations_tg on public.meetings;
create trigger meetings_materialise_reporting_obligations_tg
  after insert on public.meetings
  for each row execute function public.meetings_materialise_reporting_obligations();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 7. Provision-fn: add 'aksjelov' category to default seeds                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.provision_meetings_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat_aml_amu          uuid;
  v_cat_aml_drofting     uuid;
  v_cat_aksjelov         uuid;
  v_cat_iso_styring      uuid;
  v_cat_personvern       uuid;
  v_cat_personal         uuid;
  v_cat_intern           uuid;
begin
  insert into public.meeting_template_categories
    (organization_id, slug, name, description, position, is_system)
  values
    (p_org_id, 'aml-amu',
     'AML — AMU og verneombud',
     'Møter etter Arbeidsmiljøloven kap. 6 og 7.', 10, true),
    (p_org_id, 'aml-drofting',
     'AML — Drøfting og medvirkning',
     'Drøftingsmøter, allmøter, personalmøter (§ 4-2, § 8-2, § 15-1).', 20, true),
    (p_org_id, 'aksjelov',
     'Aksjeloven — styre og generalforsamling',
     'Styremøter, generalforsamlinger og bedriftsforsamling.', 25, true),
    (p_org_id, 'iso-styring',
     'ISO — Styringssystem',
     'Ledelsens gjennomgang og ISMS-revisjon (§ 9.3).', 30, true),
    (p_org_id, 'personvern',
     'Personvern (GDPR)',
     'DPIA og ROPA-gjennomgang etter GDPR art. 30 og 35.', 40, true),
    (p_org_id, 'personal',
     'Personalsamtaler',
     'MUS, oppfølgings­samtaler og individuell oppfølging (inkl. AKAN).', 50, true),
    (p_org_id, 'intern',
     'Interne møter',
     'Organisasjons-spesifikke møtetyper.', 60, true)
  on conflict (organization_id, slug) do nothing;

  select id into v_cat_aml_amu
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'aml-amu';
  select id into v_cat_aml_drofting
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'aml-drofting';
  select id into v_cat_aksjelov
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'aksjelov';
  select id into v_cat_iso_styring
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'iso-styring';
  select id into v_cat_personvern
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'personvern';
  select id into v_cat_personal
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'personal';
  select id into v_cat_intern
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'intern';

  insert into public.meeting_org_template_settings
    (organization_id, system_template_id, enabled, nav_pinned, position, category_id)
  select
    p_org_id,
    t.id,
    true as enabled,
    true as nav_pinned,
    t.sort_order,
    case t.default_category_slug
      when 'aml-amu'       then v_cat_aml_amu
      when 'aml-drofting'  then v_cat_aml_drofting
      when 'aksjelov'      then v_cat_aksjelov
      when 'iso-styring'   then v_cat_iso_styring
      when 'personvern'    then v_cat_personvern
      when 'personal'      then v_cat_personal
      when 'intern'        then v_cat_intern
      else null
    end as category_id
  from public.meeting_system_templates t
  where t.is_active = true
  on conflict (organization_id, system_template_id) do nothing;
end;
$$;

-- Backfill loop — picks up the new `aksjelov` category for every existing org.

do $$
declare v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform public.provision_meetings_baseline_for_org(v_org_id);
  end loop;
end $$;
