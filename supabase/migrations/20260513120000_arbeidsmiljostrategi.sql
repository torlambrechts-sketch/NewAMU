-- Arbeidsmiljøstrategi — outcome-first reframe of AML kap. 4.
--
-- Coverage:
--   1. org_wellbeing_strategy   — én rad per organisasjon med
--      visjons-, misjons- og indeks-vektkonfigurasjon. Lar HMS-leder
--      formulere hvilket arbeidsmiljø virksomheten ønsker — ikke
--      hvilke paragrafer den dekker.
--   2. wellbeing_focus_areas    — 1-til-mange fokusområder per
--      organisasjon, knyttet til én av fire utfallsakser
--      (trygghet / trivsel / medvirkning / mestring). Hver rad er et
--      konkret årsmål med tittel, beskrivelse og evt. måltall.
--   3. RLS — alle organisasjonsmedlemmer kan lese; kun org-admin
--      eller bruker med tillatelsen `wellbeing.strategy.manage`
--      kan skrive.
--   4. Indeks på (organization_id, axis_key) der archived_at is null
--      — driver tile-listingen på Arbeidsmiljøstrategi-siden uten
--      ekstra filtrering.
--
-- Self-audit (Arbeidstilsynet POV):
--   * AML § 3-1 systematisk HMS-arbeid: tabellen gir en eksplisitt
--     plass for vis. å nedfelle mål og prioriteringer for arbeids-
--     miljøet i tråd med § 3-1 bokstav b («mål for HMS-arbeidet»).
--   * AML § 7-2 (5): AMU-arbeid skal måles mot mål for
--     arbeidsmiljøet — fokusområdene fungerer som referansepunkter
--     når AMU-årsrapporten skrives. Lov-hjemler refereres i
--     `wellbeing.strategy.manage`-policyen, ikke som data-felt
--     (axis_key er nok for å hekte til AML § 4-aksene i UI).
--   * Restrisiko deferred: vi lagrer ikke periodiske snapshots av
--     indeksen i v1 — historikk kan kun ses så langt bakover som
--     kildedata (vernerunde-funn, survey-skår, læring-progresjon)
--     går. En egen `wellbeing_index_snapshots`-tabell kan legges
--     til når årssammenligning blir aktuelt.

set local search_path = public, pg_catalog;

-- ── org_wellbeing_strategy ───────────────────────────────────────────────
create table if not exists public.org_wellbeing_strategy (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  vision_md text,
  mission_md text,
  -- Vekter for de fire aksene i Wellbeing-indeksen. Må summere til 1.0
  -- på klientsiden; vi enforcer ikke i DB siden vekt-justering også må
  -- kunne lagres delvis under redigering.
  index_weights jsonb not null default jsonb_build_object(
    'trygghet', 0.25,
    'trivsel', 0.25,
    'medvirkning', 0.25,
    'mestring', 0.25
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.org_wellbeing_strategy is
  'Per-org arbeidsmiljøstrategi: visjon, misjon og vekter for Wellbeing-indeks.';
comment on column public.org_wellbeing_strategy.index_weights is
  'JSON {trygghet, trivsel, medvirkning, mestring} med tall 0..1 som vektes mot akse-skår.';

create or replace function public.touch_org_wellbeing_strategy()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_org_wellbeing_strategy on public.org_wellbeing_strategy;
create trigger trg_touch_org_wellbeing_strategy
  before update on public.org_wellbeing_strategy
  for each row execute function public.touch_org_wellbeing_strategy();

-- ── wellbeing_focus_areas ────────────────────────────────────────────────
create table if not exists public.wellbeing_focus_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  axis_key text not null check (axis_key in ('trygghet', 'trivsel', 'medvirkning', 'mestring')),
  title text not null,
  body_md text,
  target_metric text,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.wellbeing_focus_areas is
  'Konkrete arbeidsmiljømål — ett per fokusområde, koblet til én utfallsakse.';
comment on column public.wellbeing_focus_areas.axis_key is
  'En av: trygghet (AML § 4-1/4-4) | trivsel (§ 4-3) | medvirkning (§ 2-3, kap. 6-7) | mestring (§ 3-2, § 4-2).';

create index if not exists wellbeing_focus_areas_org_axis_active_idx
  on public.wellbeing_focus_areas (organization_id, axis_key)
  where archived_at is null;
create index if not exists wellbeing_focus_areas_sort_idx
  on public.wellbeing_focus_areas (organization_id, sort_order, created_at);

-- ── role helper ──────────────────────────────────────────────────────────
create or replace function public.user_can_manage_wellbeing_strategy()
returns boolean
language sql
stable
as $$
  select public.is_org_admin() or public.user_has_permission('wellbeing.strategy.manage');
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.org_wellbeing_strategy enable row level security;
alter table public.wellbeing_focus_areas enable row level security;

-- org_wellbeing_strategy — read for any org member, write for admin / strategy-manager.
drop policy if exists owb_strategy_select on public.org_wellbeing_strategy;
create policy owb_strategy_select on public.org_wellbeing_strategy
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists owb_strategy_write on public.org_wellbeing_strategy;
create policy owb_strategy_write on public.org_wellbeing_strategy
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_wellbeing_strategy()
  )
  with check (
    organization_id = public.current_org_id()
    and public.user_can_manage_wellbeing_strategy()
  );

grant select, insert, update, delete on public.org_wellbeing_strategy to authenticated;

-- wellbeing_focus_areas — same access pattern.
drop policy if exists wba_focus_select on public.wellbeing_focus_areas;
create policy wba_focus_select on public.wellbeing_focus_areas
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists wba_focus_write on public.wellbeing_focus_areas;
create policy wba_focus_write on public.wellbeing_focus_areas
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_wellbeing_strategy()
  )
  with check (
    organization_id = public.current_org_id()
    and public.user_can_manage_wellbeing_strategy()
  );

grant select, insert, update, delete on public.wellbeing_focus_areas to authenticated;
