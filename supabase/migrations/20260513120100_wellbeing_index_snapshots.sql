-- Arbeidsmiljøstrategi — historisk snapshot av indeks og akse-skår.
--
-- Coverage:
--   1. wellbeing_index_snapshots — én rad per (organization_id, period_key)
--      som lagrer den vektede indeksen + de fire akse-skårene + vektene
--      som ble brukt. Period_key er 'YYYY-MM' (månedlig kadens).
--   2. wellbeing_capture_index_snapshot(...) RPC — SECURITY DEFINER
--      upsert som RLS hopper over. Aksesskårene beregnes klientsiden
--      (formelene lever i TS i v3); kolonnen `computed_by` flagger
--      hvem som beregnet for fremtidig sporing når vi flytter til SQL.
--   3. RLS — alle org-medlemmer kan lese snapshots (historikk er ikke
--      sensitiv); skriving går kun via RPC-en, så ingen direkte INSERT/
--      UPDATE er nødvendig fra klient.
--
-- Self-audit (Arbeidstilsynet POV):
--   * AML § 3-1 (b) krever at HMS-arbeidet evalueres systematisk. En
--     månedlig snapshot-rekke gir styrer og AMU ett tall over tid de
--     kan styre etter, og en revisor ett spor de kan kontrollere
--     evalueringen mot.
--   * Snapshotene markeres `computed_by = 'client'` så lenge formelen
--     bor i TS — en fremtidig SQL-port vil sette 'server' og kan
--     skille de to settene i analyse-verktøyet.
--   * Restrisiko deferred: ingen automatisk capture-jobb i v3.
--     Snapshot tas når en bruker åpner Arbeidsmiljøstrategi-siden
--     (debounce per måned). Når pg_cron blir tilgjengelig kan vi
--     fylle gap-rader retroaktivt via samme RPC.

set local search_path = public, pg_catalog;

create table if not exists public.wellbeing_index_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- 'YYYY-MM' for månedlig kadens. UNIQUE-constraint sørger for at vi
  -- ikke får duplikater (RPC-en gjør UPSERT mot denne).
  period_key text not null check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  captured_at timestamptz not null default now(),
  -- Indeks-tallet (0..100) + de fire delskårene. Tillater null for
  -- akser som ikke hadde data ved capture-tidspunktet.
  index_value int check (index_value is null or (index_value between 0 and 100)),
  trygghet_score int check (trygghet_score is null or (trygghet_score between 0 and 100)),
  trivsel_score int check (trivsel_score is null or (trivsel_score between 0 and 100)),
  medvirkning_score int check (medvirkning_score is null or (medvirkning_score between 0 and 100)),
  mestring_score int check (mestring_score is null or (mestring_score between 0 and 100)),
  -- Vektene som ble brukt for å beregne indeksen — gjør at vi kan
  -- forklare svingninger som skyldes endring i vekt, ikke i underdata.
  weights jsonb not null default jsonb_build_object(
    'trygghet', 0.25,
    'trivsel', 0.25,
    'medvirkning', 0.25,
    'mestring', 0.25
  ),
  -- Rå signaler (åpne funn, svarprosent osv.) i fri-form for revisjon
  -- av historiske datapunkt uten å måtte re-kjøre kjededatasett.
  source_signals jsonb not null default '{}'::jsonb,
  computed_by text not null default 'client' check (computed_by in ('client', 'server')),
  unique (organization_id, period_key)
);

comment on table public.wellbeing_index_snapshots is
  'Månedlig snapshot av Arbeidsmiljø-indeksen + akse-skårene. UPSERT via RPC.';
comment on column public.wellbeing_index_snapshots.period_key is
  '''YYYY-MM'' — kalendermåneden snapshotet representerer.';
comment on column public.wellbeing_index_snapshots.source_signals is
  'Fri-form jsonb med rå tellere (findingsCritical, responseRatePct, …) for revisjon.';

create index if not exists wellbeing_snapshots_org_period_idx
  on public.wellbeing_index_snapshots (organization_id, period_key desc);

-- ── RPC: capture-or-replace snapshot for given period ────────────────────
create or replace function public.wellbeing_capture_index_snapshot(
  p_org_id uuid,
  p_period_key text,
  p_index_value int,
  p_trygghet int,
  p_trivsel int,
  p_medvirkning int,
  p_mestring int,
  p_weights jsonb,
  p_source_signals jsonb
)
returns public.wellbeing_index_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.wellbeing_index_snapshots;
begin
  -- Kun org-medlemmer kan ta snapshot for sin egen org. Hopper RLS
  -- nedover men sjekker tilhørighet eksplisitt her.
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = p_org_id
  ) then
    raise exception 'forbidden: not a member of the specified organization'
      using errcode = '42501';
  end if;

  if p_period_key !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid period_key %, expected YYYY-MM', p_period_key
      using errcode = '22023';
  end if;

  insert into public.wellbeing_index_snapshots (
    organization_id, period_key, captured_at,
    index_value, trygghet_score, trivsel_score, medvirkning_score, mestring_score,
    weights, source_signals, computed_by
  )
  values (
    p_org_id, p_period_key, now(),
    p_index_value, p_trygghet, p_trivsel, p_medvirkning, p_mestring,
    coalesce(p_weights, jsonb_build_object('trygghet', 0.25, 'trivsel', 0.25, 'medvirkning', 0.25, 'mestring', 0.25)),
    coalesce(p_source_signals, '{}'::jsonb),
    'client'
  )
  on conflict (organization_id, period_key) do update
    set captured_at = excluded.captured_at,
        index_value = excluded.index_value,
        trygghet_score = excluded.trygghet_score,
        trivsel_score = excluded.trivsel_score,
        medvirkning_score = excluded.medvirkning_score,
        mestring_score = excluded.mestring_score,
        weights = excluded.weights,
        source_signals = excluded.source_signals,
        computed_by = excluded.computed_by
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.wellbeing_capture_index_snapshot(uuid, text, int, int, int, int, int, jsonb, jsonb) from public;
grant execute on function public.wellbeing_capture_index_snapshot(uuid, text, int, int, int, int, int, jsonb, jsonb) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.wellbeing_index_snapshots enable row level security;

drop policy if exists wbs_snapshots_select on public.wellbeing_index_snapshots;
create policy wbs_snapshots_select on public.wellbeing_index_snapshots
  for select to authenticated
  using (organization_id = public.current_org_id());

-- Ingen direkte write-policy — all skriving går gjennom RPC-en over.
-- Vi gir SELECT-grants slik at klient-lesing fungerer via PostgREST.
grant select on public.wellbeing_index_snapshots to authenticated;
