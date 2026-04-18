-- Council / AMU module: org-scoped board, elections, meetings, compliance (replaces localStorage).

-- ---------------------------------------------------------------------------
-- Board
-- ---------------------------------------------------------------------------

create table if not exists public.council_board_members (
  id text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  role text not null check (role in ('leader', 'deputy', 'member')),
  elected_at date not null,
  term_until date,
  from_election_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists council_board_org_idx on public.council_board_members (organization_id);

-- ---------------------------------------------------------------------------
-- Elections + candidates (JSON array matches app type)
-- ---------------------------------------------------------------------------

create table if not exists public.council_elections (
  id text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  candidates jsonb not null default '[]',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  winner_candidate_id text
);

create index if not exists council_elections_org_idx on public.council_elections (organization_id);

-- ---------------------------------------------------------------------------
-- Meetings (full structured document as JSON — same shape as CouncilMeeting)
-- ---------------------------------------------------------------------------

create table if not exists public.council_meetings (
  id text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists council_meetings_org_idx on public.council_meetings (organization_id);
create index if not exists council_meetings_starts_idx on public.council_meetings ((payload->>'startsAt'));

-- ---------------------------------------------------------------------------
-- Compliance checklist
-- ---------------------------------------------------------------------------

create table if not exists public.council_compliance_items (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  title text not null,
  description text not null default '',
  law_ref text not null default '',
  done boolean not null default false,
  notes text not null default '',
  is_custom boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create index if not exists council_compliance_org_idx on public.council_compliance_items (organization_id);

drop trigger if exists council_board_set_updated_at on public.council_board_members;
create trigger council_board_set_updated_at
  before update on public.council_board_members
  for each row execute function public.set_updated_at();

drop trigger if exists council_meetings_set_updated_at on public.council_meetings;
create trigger council_meetings_set_updated_at
  before update on public.council_meetings
  for each row execute function public.set_updated_at();

drop trigger if exists council_compliance_set_updated_at on public.council_compliance_items;
create trigger council_compliance_set_updated_at
  before update on public.council_compliance_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — org members read/write (collaborative council room)
-- ---------------------------------------------------------------------------

alter table public.council_board_members enable row level security;
alter table public.council_elections enable row level security;
alter table public.council_meetings enable row level security;
alter table public.council_compliance_items enable row level security;

create policy "council_board_select"
  on public.council_board_members for select
  using (organization_id = public.current_org_id());

create policy "council_board_write"
  on public.council_board_members for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "council_elections_select"
  on public.council_elections for select
  using (organization_id = public.current_org_id());

create policy "council_elections_write"
  on public.council_elections for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "council_meetings_select"
  on public.council_meetings for select
  using (organization_id = public.current_org_id());

create policy "council_meetings_write"
  on public.council_meetings for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "council_compliance_select"
  on public.council_compliance_items for select
  using (organization_id = public.current_org_id());

create policy "council_compliance_write"
  on public.council_compliance_items for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- Seed default compliance rows when org first opens Council (no demo meetings)
-- ---------------------------------------------------------------------------

create or replace function public.council_ensure_org_defaults()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then return; end if;

  if not exists (select 1 from public.council_compliance_items where organization_id = v_org) then
    insert into public.council_compliance_items (organization_id, id, title, description, law_ref, done, notes, is_custom, sort_order)
    values
      (v_org, 'c1', 'Arbeidsmiljøutvalg (AMU) der lov eller avtale krever det',
       'Sikre at AMU er opprettet og sammensatt i tråd med krav (f.eks. antall representanter, møtefrekvens).',
       'Arbeidsmiljøloven kap. 7 (bl.a. §§ 7-1–7-4)', false, '', false, 1),
      (v_org, 'c2', 'Verneombud og verneområde',
       'Verneombud skal velges der det er påkrevd; oppgaver og samarbeid med arbeidsgiver skal følges opp.',
       'Arbeidsmiljøloven §§ 6-1–6-4', false, '', false, 2),
      (v_org, 'c3', 'Bedriftsutvalg / samarbeidsorgan (der størrelse eller avtale tilsier)',
       'Ved behov: oppretthold møteplan, protokoller og dokumentasjon av drøftinger med ledelsen.',
       'Hovedavtalen / selskapets avtaler; se også regler om informasjon og drøfting', false, '', false, 3),
      (v_org, 'c4', 'Informasjon og drøfting ved vesentlige endringer',
       'Kartlegg prosesser ved omorganisering, nedbemanning eller overdragelse (virksomhetsoverdragelse).',
       'Arbeidsmiljøloven § 16-1; lov om virksomhetsoverdragelser mv.', false, '', false, 4),
      (v_org, 'c5', 'Valg av tillitsvalgte og representanter',
       'Gjennomfør valg etter demokratiske regler, dokumenter mandatperiode og varsling til arbeidsgiver.',
       'Valgreglement / tariffavtaler; AML kap. 7 for sikkerhetsrepresentasjon', false, '', false, 5),
      (v_org, 'c6', 'HMS-system og risikovurdering',
       'Rådet bør sikre at risikovurderinger og tiltak følges opp i samarbeid med verneombud og AMU.',
       'Arbeidsmiljøloven §§ 3-1, 5-1', false, '', false, 6),
      (v_org, 'c7', 'Møteprotokoller og journal',
       'Arkiver innkalling, agenda, protokoll og beslutninger fra rådsmøter og valg.',
       'Interne retningslinjer; dokumentasjonskrav i avtaler', false, '', false, 7)
    on conflict (organization_id, id) do nothing;
  end if;
end;
$$;

grant execute on function public.council_ensure_org_defaults() to authenticated;
