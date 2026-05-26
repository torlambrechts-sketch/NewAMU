-- Cadence — HMS-årshjul wizard output (Cadence-veiviser).
--
-- Coverage:
--   1. cadence_plans            — én rad per iverksatt cadence (eller draft).
--                                 Bærer regelverk[]-valget + statusen.
--   2. cadence_plan_paragraphs  — utvalgte paragrafer (law_ref + chapter).
--   3. cadence_plan_modules     — oppgavemaler med frekvens og volum/år.
--                                 Bridge til task_items via source_type='cadence_plan'.
--   4. cadence_plan_roles       — rolletildelinger (daglig leder, HMS-ansvarlig,
--                                 hovedverneombud, AMU-leder, BHT, tillitsvalgt,
--                                 + frivillige roller).
--   5. cadence_plan_approvals   — godkjenningskjeder (G01..Gn) med stegene.
--   6. cadence_plan_escalations — eskaleringsstiger (E01, E02) med relativ dag.
--
-- Self-audit (Arbeidstilsynet POV):
--   * IK-f § 5 nr. 4 — fordeling av ansvar: cadence_plan_roles + RACI.
--   * IK-f § 5 nr. 6 — systematisk overvåking: cadence_plan_modules.frequency.
--   * IK-f § 5 nr. 7 — gjennomgang: aktivering logges + skaper task_items.
--   * AML § 3-1 — internkontroll: hele tabellen ER internkontroll-strukturen.
--   * Restrisiko: rollehistorikk (når en rolle byttes ut) bæres i task_items
--     audit-loggen via owner_user_id-endringer, ikke her — cadence_plan_roles
--     reflekterer kun nåværende oppsett. Ved historikkbehov, joine mot
--     hse_audit_log via plan-id.
--
-- RLS:
--   * Lesetilgang: alle org-medlemmer (current_org_id()) — cadence er
--     felles HMS-struktur, ikke privat.
--   * Skrivetilgang: org-admin (is_org_admin()) ELLER skaperen, slik at
--     HMS-ansvarlig kan iterere uten admin-rettigheter.
--   * Hard-delete tillates ikke; bruk deleted_at for å bevare audit-spor
--     når en plan trekkes tilbake.
--
-- Kobling mot task_items:
--   * Når en plan flippes til 'active' (RPC cadence_plan_activate),
--     opprettes én task_items-rad per modul med
--     source_type='cadence_plan', source_id=<cadence_plan.id>,
--     law_refs[]=<modul.law_refs>, pack=<plan.pack>.

set local search_path = public, pg_catalog;

-- ── 1. cadence_plans ────────────────────────────────────────────────────────

create table if not exists public.cadence_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Navn på cadence ("HMS-årshjul 2026", "ISO-overgang 2027", …).
  name text not null,
  description text,
  -- Hvilken pack tasks skal opprettes under når planen iverksettes.
  -- 'aml-amu' er default for HMS-cadence; iso-* hvis bedriften sikter
  -- på sertifisering.
  pack public.compliance_pack not null default 'aml-amu',
  -- Liste av valgte regelverk-IDer (matcher public.regulations.id).
  -- Eks: '{aml,ik-f,iso-45001}'.
  regelverk text[] not null default '{}'::text[],
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  -- Trinn brukeren har sluttført — 1..8 i veiviseren. Brukes for
  -- "fortsett der du slapp"-knappen sammen med compliance_wizard_runs.
  wizard_step int not null default 1 check (wizard_step between 1 and 8),
  -- Antall ansatte / NACE — snapshot fra organizations på iverksettelse,
  -- slik at terskelvurderinger (≥5, ≥30, ≥50) som lå til grunn for
  -- valgene kan etterprøves selv om bedriften vokser.
  snapshot_headcount int,
  snapshot_nace text,
  activated_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cadence_plans is
  'Klarert Cadence-veiviser — én rad per iverksatt eller draftet HMS-årshjul.';
comment on column public.cadence_plans.regelverk is
  'Valgte regelverk-IDer (matcher public.regulations.id). Eks: ''{aml,ik-f}''.';
comment on column public.cadence_plans.snapshot_headcount is
  'Snapshot av ansattall ved iverksettelse. Brukes for å forklare valgene i ettertid.';
comment on column public.cadence_plans.wizard_step is
  '1..8. Hvilket steg veiviseren stoppet på sist.';

create index if not exists cadence_plans_org_status_idx
  on public.cadence_plans (organization_id, status)
  where deleted_at is null;

create index if not exists cadence_plans_created_by_idx
  on public.cadence_plans (created_by)
  where deleted_at is null;

-- ── 2. cadence_plan_paragraphs ──────────────────────────────────────────────

create table if not exists public.cadence_plan_paragraphs (
  cadence_plan_id uuid not null references public.cadence_plans(id) on delete cascade,
  -- Lovreferanse-streng som brukes overalt ellers i systemet
  -- ("AML § 4-3", "IK-f § 5 nr. 7"). Må matche law_refs[]-formatet.
  law_ref text not null,
  chapter text,
  title text,
  -- Lovpålagt vs frivillig — gjenspeiler tier-kolonnen i UI-en.
  required boolean not null default false,
  -- Eks. "≥5 ans.", "≥30 ans.". Tekst — leses kun, ingen logikk.
  threshold text,
  created_at timestamptz not null default now(),
  primary key (cadence_plan_id, law_ref)
);

comment on table public.cadence_plan_paragraphs is
  'Valgte paragrafer i en cadence-plan. law_ref matcher law_refs[] på øvrige template-flater.';

-- ── 3. cadence_plan_modules ─────────────────────────────────────────────────

create table if not exists public.cadence_plan_modules (
  cadence_plan_id uuid not null references public.cadence_plans(id) on delete cascade,
  -- Stabil katalog-ID fra TS-katalogen ('M01', 'M02', ...). Tekst,
  -- ikke FK — modulen kan flyttes/omdøpes i katalogen uten å bryte
  -- historiske planer.
  module_id text not null,
  name text not null,
  group_label text,
  tier text not null check (tier in ('required', 'recommended', 'optional')),
  -- Lovreferansene modulen dekker (M02 dekker f.eks. AML § 3-1 + § 4-1).
  law_refs text[] not null default '{}'::text[],
  -- Forventet volum oppgaver/år (vises i preview).
  volume int not null default 1 check (volume >= 0),
  -- Foreslått / valgt frekvens-streng (vises i UI). Eks: 'Kvartalsvis',
  -- 'Halvårlig', 'Per sak (ad hoc)'.
  frequency text,
  -- Kanonisk cadence_hint som task_items / internal_controls bruker.
  -- 'arlig'|'halvarlig'|'kvartalsvis'|'manedlig'|'ukentlig'|'ad_hoc'.
  cadence_hint text,
  -- Beskrivelse fra modulkatalogen — kopiert inn så endringer i
  -- katalogen ikke endrer historisk plan.
  description text,
  created_at timestamptz not null default now(),
  primary key (cadence_plan_id, module_id)
);

comment on table public.cadence_plan_modules is
  'Valgte oppgavemoduler i en cadence-plan. Frekvens + lovreferanser snapshottes inn.';
comment on column public.cadence_plan_modules.cadence_hint is
  'Kanonisk cadence_hint som task_items / internal_controls bruker. Plain text.';

-- ── 4. cadence_plan_roles ───────────────────────────────────────────────────

create table if not exists public.cadence_plan_roles (
  cadence_plan_id uuid not null references public.cadence_plans(id) on delete cascade,
  -- Stabil rolle-key ('daglig_leder', 'hms_ansvarlig', 'hvo', ...).
  role_key text not null,
  role_label text not null,
  -- Lovreferanse rollen er forankret i ("AML § 2-1", "AML § 6-2", ...).
  law_ref text,
  -- Person tildelt rollen — peker mot auth.users for fast og varig
  -- referanse; navn-feltet er snapshot for display selv om personen
  -- forlater org-en.
  person_user_id uuid references auth.users(id) on delete set null,
  person_name text,
  -- Stedfortreder. Samme regel — FK + snapshot.
  fallback_user_id uuid references auth.users(id) on delete set null,
  fallback_name text,
  is_mandatory boolean not null default true,
  -- Fritekstfelt for ekstra kontekst ("1. jan – 31. des 2026" for AMU-
  -- leder, "Stamina HelseService" for BHT-leverandør, e.g.).
  note text,
  created_at timestamptz not null default now(),
  primary key (cadence_plan_id, role_key)
);

comment on table public.cadence_plan_roles is
  'Rolle-tildelinger for en cadence-plan. Lovpålagte + frivillige roller fra Step 4.';

-- ── 5. cadence_plan_approvals ───────────────────────────────────────────────

create table if not exists public.cadence_plan_approvals (
  cadence_plan_id uuid not null references public.cadence_plans(id) on delete cascade,
  -- Kjede-kode (G01 = vernerunderapporter, G02 = AMU-protokoll, ...).
  chain_code text not null,
  chain_label text not null,
  step_order int not null check (step_order >= 1),
  step_title text not null,
  step_meta text,
  -- 'utforer'|'qa'|'sluttsignering'|'kollegialt'|'informeres'.
  -- Drives bare hva badge-tonen blir i UI; ingen logikk.
  step_kind text not null
    check (step_kind in ('utforer', 'qa', 'sluttsignering', 'kollegialt', 'informeres')),
  -- SLA i dager (eks 3, 7) — informativ, brukes i preview.
  sla_days int check (sla_days >= 0),
  created_at timestamptz not null default now(),
  primary key (cadence_plan_id, chain_code, step_order)
);

comment on table public.cadence_plan_approvals is
  'Godkjenningskjeder per cadence-plan (G01..Gn). Step-by-step rekkefølge.';

-- ── 6. cadence_plan_escalations ─────────────────────────────────────────────

create table if not exists public.cadence_plan_escalations (
  cadence_plan_id uuid not null references public.cadence_plans(id) on delete cascade,
  -- 'E01' = standard for lovbestemte; 'E02' = mild for frivillige.
  ladder_code text not null,
  ladder_label text not null,
  step_order int not null check (step_order >= 1),
  -- Relativ dag til frist. -14, -7, -1, 0, +3, +14.
  relative_day int not null,
  trigger_label text not null,
  trigger_note text,
  action_label text not null,
  action_note text,
  -- 'mild'|'standard'|'streng'|'kritisk'|'stille'.
  severity text not null
    check (severity in ('mild', 'standard', 'streng', 'kritisk', 'stille')),
  created_at timestamptz not null default now(),
  primary key (cadence_plan_id, ladder_code, step_order)
);

comment on table public.cadence_plan_escalations is
  'Eskaleringsstiger per cadence-plan (E01 streng, E02 mild). relative_day=0 er fristdag.';

-- ── 7. Triggers for updated_at + insert defaults ────────────────────────────

create or replace function public.cadence_plans_before_insert_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists cadence_plans_before_insert_defaults_tg on public.cadence_plans;
create trigger cadence_plans_before_insert_defaults_tg
  before insert on public.cadence_plans
  for each row execute function public.cadence_plans_before_insert_defaults();

drop trigger if exists cadence_plans_set_updated_at on public.cadence_plans;
create trigger cadence_plans_set_updated_at
  before update on public.cadence_plans
  for each row execute function public.set_updated_at();

-- ── 8. RLS ──────────────────────────────────────────────────────────────────

alter table public.cadence_plans enable row level security;
alter table public.cadence_plan_paragraphs enable row level security;
alter table public.cadence_plan_modules enable row level security;
alter table public.cadence_plan_roles enable row level security;
alter table public.cadence_plan_approvals enable row level security;
alter table public.cadence_plan_escalations enable row level security;

-- cadence_plans: alle org-medlemmer ser, admin/skaper skriver.
drop policy if exists cadence_plans_select_org on public.cadence_plans;
create policy cadence_plans_select_org
  on public.cadence_plans for select
  using (organization_id = public.current_org_id() and deleted_at is null);

drop policy if exists cadence_plans_insert_org on public.cadence_plans;
create policy cadence_plans_insert_org
  on public.cadence_plans for insert
  with check (organization_id = public.current_org_id());

drop policy if exists cadence_plans_update_admin_or_creator on public.cadence_plans;
create policy cadence_plans_update_admin_or_creator
  on public.cadence_plans for update
  using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.is_org_admin())
  )
  with check (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.is_org_admin())
  );

-- Hard-delete kun via admin (ellers bruk deleted_at).
drop policy if exists cadence_plans_delete_admin on public.cadence_plans;
create policy cadence_plans_delete_admin
  on public.cadence_plans for delete
  using (
    organization_id = public.current_org_id()
    and public.is_org_admin()
  );

-- Sub-tabellene følger samme tilgangsregel via plan-en.
-- Vi referer til parent-raden via EXISTS slik at en plan utenfor org
-- automatisk lukker child-radene.

do $$
declare
  rec record;
begin
  for rec in
    select unnest(array[
      'cadence_plan_paragraphs',
      'cadence_plan_modules',
      'cadence_plan_roles',
      'cadence_plan_approvals',
      'cadence_plan_escalations'
    ]) as tbl
  loop
    execute format($f$drop policy if exists %I_select_via_plan on public.%I$f$, rec.tbl, rec.tbl);
    execute format($f$
      create policy %I_select_via_plan
        on public.%I for select
        using (
          exists (
            select 1 from public.cadence_plans p
            where p.id = %I.cadence_plan_id
              and p.organization_id = public.current_org_id()
              and p.deleted_at is null
          )
        )
    $f$, rec.tbl, rec.tbl, rec.tbl);

    execute format($f$drop policy if exists %I_write_via_plan on public.%I$f$, rec.tbl, rec.tbl);
    execute format($f$
      create policy %I_write_via_plan
        on public.%I for all
        using (
          exists (
            select 1 from public.cadence_plans p
            where p.id = %I.cadence_plan_id
              and p.organization_id = public.current_org_id()
              and (p.created_by = auth.uid() or public.is_org_admin())
              and p.deleted_at is null
          )
        )
        with check (
          exists (
            select 1 from public.cadence_plans p
            where p.id = %I.cadence_plan_id
              and p.organization_id = public.current_org_id()
              and (p.created_by = auth.uid() or public.is_org_admin())
              and p.deleted_at is null
          )
        )
    $f$, rec.tbl, rec.tbl, rec.tbl, rec.tbl);
  end loop;
end$$;

-- ── 9. RPC: cadence_plan_activate ───────────────────────────────────────────
--
-- Iverksetter en draft cadence-plan: setter status='active',
-- snapshotter headcount, og oppretter task_items for hver modul.
--
-- Idempotent: hvis status allerede er 'active', returnerer planens id
-- uten å opprette duplikate tasks (sikret av unique index nedenfor).

create or replace function public.cadence_plan_activate(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_plan record;
  v_mod record;
  v_due date;
  v_task_id uuid;
begin
  select * into v_plan
    from public.cadence_plans
    where id = p_plan_id
      and organization_id = public.current_org_id()
      and deleted_at is null;
  if not found then
    raise exception 'Cadence-plan ikke funnet eller utenfor organisasjonen.';
  end if;

  if not (public.is_org_admin() or v_plan.created_by = auth.uid()) then
    raise exception 'Mangler tilgang til å iverksette cadence-planen.';
  end if;

  -- Sett status og snapshot.
  update public.cadence_plans
    set status = 'active',
        activated_at = coalesce(activated_at, now()),
        wizard_step = 8
    where id = p_plan_id;

  -- Opprett task_items per modul (én bridge-task per modul).
  -- Skip moduler som allerede har en aktiv bridge-task (idempotent).
  for v_mod in
    select m.module_id, m.name, m.law_refs, m.cadence_hint, m.frequency, m.description, m.volume
      from public.cadence_plan_modules m
      where m.cadence_plan_id = p_plan_id
  loop
    -- Frist: 30 dager fra aktivering for første instans. Cadence-hint
    -- styrer påfølgende instanser via task_items.recurrence (Phase 2).
    v_due := (now() + interval '30 days')::date;

    insert into public.task_items (
      organization_id, title, description, priority, status, pack,
      source_type, source_id, law_refs, source_category, pdca_phase,
      template_slug, template_kind, due_date
    )
    values (
      v_plan.organization_id,
      v_mod.name,
      coalesce(v_mod.description, '') ||
        case when v_mod.frequency is not null then E'\n\nFrekvens: ' || v_mod.frequency else '' end ||
        case when v_mod.cadence_hint is not null then E'\nCadence: ' || v_mod.cadence_hint else '' end,
      'medium',
      'open',
      v_plan.pack,
      'cadence_plan',
      v_plan.id,
      coalesce(v_mod.law_refs, '{}'::text[]),
      'general',
      'do',
      'cadence_' || lower(v_mod.module_id),
      'task',
      v_due
    )
    on conflict do nothing
    returning id into v_task_id;
  end loop;

  return p_plan_id;
end;
$$;

comment on function public.cadence_plan_activate is
  'Iverksetter en draft cadence-plan: setter status=active, oppretter task_items per modul. Idempotent.';

revoke all on function public.cadence_plan_activate(uuid) from public;
grant execute on function public.cadence_plan_activate(uuid) to authenticated;
