-- Two-level taxonomy foundation — regulations table (category-architecture §T1).
--
-- Regulation = the legal/standards basis a per-org category sits under.
-- Examples: Arbeidsmiljøloven (AML), Internkontrollforskriften (IK-f),
-- ISO 9001 / 14001 / 45001, Åpenhetsloven, GDPR, …
--
-- Per-org rows so customers can add their own (e.g. sector-specific
-- regulations); is_system = true marks the seeded baseline so admin UIs
-- can prevent accidental edits/deletion. Soft-delete via deleted_at.
--
-- The seed loop populates every existing org with the same baseline
-- list; a trigger on organizations insert keeps new tenants in sync.

set local search_path = public, pg_catalog;

-- ── 1. Table ──────────────────────────────────────────────────────────────

create table if not exists public.regulations (
  id              text not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  short_name      text not null,
  description     text not null default '',
  legal_authority text,
  position        integer not null default 100,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organization_id, id)
);

create index if not exists regulations_org_active_idx
  on public.regulations (organization_id)
  where is_active = true and deleted_at is null;

drop trigger if exists regulations_set_updated_at on public.regulations;
create trigger regulations_set_updated_at
  before update on public.regulations
  for each row execute function public.set_updated_at();

alter table public.regulations enable row level security;

drop policy if exists regulations_select on public.regulations;
create policy regulations_select
  on public.regulations for select
  using (organization_id = public.current_org_id());

drop policy if exists regulations_write on public.regulations;
create policy regulations_write
  on public.regulations for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- ── 2. Provision function ────────────────────────────────────────────────
-- Idempotent via the composite PK. Seeds the nine baseline regulations
-- from spec §T1 OQ-A1.

create or replace function public.provision_regulations_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.regulations (
    id, organization_id, name, short_name, description, legal_authority, position, is_active, is_system
  )
  values
    ('aml',           p_org_id, 'Arbeidsmiljøloven',                          'AML',          'Verneombud, AMU, psykososialt og fysisk arbeidsmiljø.',                       'Arbeidstilsynet', 10,  true, true),
    ('ik-f',          p_org_id, 'Internkontrollforskriften',                  'IK-f',         'Systematisk HMS-arbeid, ROS, dokumentasjon og oppfølging.',                   'Arbeidstilsynet', 20,  true, true),
    ('iso-9001',      p_org_id, 'ISO 9001 — Kvalitetsledelse',                'ISO 9001',     'Kvalitetsstyringssystem.',                                                    'ISO',             30,  true, true),
    ('iso-14001',     p_org_id, 'ISO 14001 — Miljøledelse',                   'ISO 14001',    'Miljøstyringssystem.',                                                        'ISO',             40,  true, true),
    ('iso-45001',     p_org_id, 'ISO 45001 — Arbeidsmiljøledelse',            'ISO 45001',    'Arbeidsmiljøstyringssystem.',                                                 'ISO',             50,  true, true),
    ('apenhetsloven', p_org_id, 'Åpenhetsloven',                              'Åpenhetsloven','Aktsomhetsvurderinger og leverandørkontroll.',                                'Forbrukertilsynet', 60, true, true),
    ('gdpr',          p_org_id, 'Personopplysningsloven (GDPR)',              'GDPR',         'Behandling av personopplysninger.',                                           'Datatilsynet',    70,  true, true),
    ('likestilling',  p_org_id, 'Likestillings- og diskrimineringsloven',     'LDL',          'Aktivitets- og redegjørelsesplikten (ARP).',                                  'Diskrimineringsombudet', 80, true, true),
    ('iso-19011',     p_org_id, 'NS-EN ISO 19011 — Revisjon av styringssystem', 'ISO 19011',  'Retningslinjer for revisjon av styringssystem.',                              'ISO',             90,  true, true)
  on conflict (organization_id, id) do nothing;
end;
$$;

revoke all on function public.provision_regulations_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_regulations_baseline_for_org(uuid) to authenticated, service_role;

-- ── 3. Trigger: new-org auto-baseline ────────────────────────────────────

create or replace function public.regulations_provision_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_regulations_baseline_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists regulations_provision_on_org_insert_tg on public.organizations;
create trigger regulations_provision_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.regulations_provision_on_org_insert();

-- ── 4. Backfill every existing org ───────────────────────────────────────

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_regulations_baseline_for_org(v_org.id);
  end loop;
end $$;
