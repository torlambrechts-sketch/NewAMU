-- Survey Pack registry — per-org pack configuration mirroring compliance_packs.
--
-- Five seeded packs per existing org:
--   vendor        — Leverandørkontroll (egenerklæringer, åpenhetsloven, BRREG)
--   arbeidsmiljo  — Arbeidsmiljøundersøkelser (QPSNordic, ARK, pulse)
--   compliance    — Compliance-erklæringer (intern/ekstern selvrapportering)
--   engagement    — Engasjements- og kulturmålinger (eNPS, Edmondson, m.fl.)
--   exit          — Exit-undersøkelser (sluttsamtaler, offboarding)
--
-- Each pack carries display content (terminology, KPI labels, banner refs)
-- plus per-pack BEHAVIOUR defaults that the rest of the survey lifecycle
-- reads:
--   requires_publish_snapshot  — TRUE for compliance + vendor; survey
--                                questions become read-only after publish.
--   default_anonymous          — TRUE for arbeidsmiljo + engagement + exit.
--   default_anonymity_threshold— k-anonymity floor applied when anonymous.
--
-- Licensing: a pack is "available" to an org iff a row exists with
-- is_active=true. To disable a pack, set is_active=false (don't delete).
-- This separates pack content from pack availability without a second table.

-- ── Enum: survey_pack ───────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'survey_pack') then
    create type public.survey_pack as enum (
      'vendor', 'arbeidsmiljo', 'compliance', 'engagement', 'exit'
    );
  end if;
end $$;

-- ── Table: survey_packs ─────────────────────────────────────────────────────

create table if not exists public.survey_packs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug            public.survey_pack not null,
  short_name      text not null,
  plural_label    text not null,
  cta_label       text not null,
  description     text not null default '',
  -- Banner references rendered by ModuleLegalBanner. Curated subset; granular
  -- requirement taxonomy will live in compliance_requirements (cross-primitive
  -- in a future commit when surveys+checklists share a regulation_packs table).
  legal_references jsonb not null default '[]'::jsonb,            -- [{code, text}]
  kpi_labels      jsonb not null default '{}'::jsonb,             -- {open, critical, ytd}
  -- Per-pack behaviour defaults read by the survey lifecycle hooks/triggers.
  requires_publish_snapshot   boolean not null default false,
  default_anonymous           boolean not null default false,
  default_anonymity_threshold int     not null default 5,
  position        int not null default 100,
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug),
  check (jsonb_typeof(legal_references) = 'array')
);

create index if not exists survey_packs_org_active_idx
  on public.survey_packs (organization_id, is_active, position);

alter table public.survey_packs enable row level security;

drop policy if exists survey_packs_select_org on public.survey_packs;
create policy survey_packs_select_org
  on public.survey_packs for select
  using (organization_id = public.current_org_id());

-- WRITE policy: org-scoped. Finer-grained 'survey.manage' permission is
-- enforced in the application; RLS is the org-isolation layer.
drop policy if exists survey_packs_write_org on public.survey_packs;
create policy survey_packs_write_org
  on public.survey_packs for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.survey_packs_before_insert_defaults()
returns trigger
language plpgsql
as $$
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

drop trigger if exists survey_packs_before_insert_defaults_tg on public.survey_packs;
create trigger survey_packs_before_insert_defaults_tg
  before insert on public.survey_packs
  for each row execute function public.survey_packs_before_insert_defaults();

drop trigger if exists survey_packs_set_updated_at on public.survey_packs;
create trigger survey_packs_set_updated_at
  before update on public.survey_packs
  for each row execute function public.set_updated_at();

-- survey_packs always has organization_id NOT NULL, so the standard
-- hse_audit_trigger is safe to attach unconditionally (no NULL-org bug
-- like the one fixed for compliance_requirements in 20260809140000).
drop trigger if exists survey_packs_audit_tg on public.survey_packs;
create trigger survey_packs_audit_tg
  after insert or update or delete on public.survey_packs
  for each row execute function public.hse_audit_trigger();

-- ── Seed: five packs per existing org ──────────────────────────────────────

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop

    -- ── vendor (Leverandørkontroll) ─────────────────────────────────────
    insert into public.survey_packs (
      organization_id, slug, short_name, plural_label, cta_label,
      description, legal_references, kpi_labels,
      requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
      position
    ) values (
      v_org.id, 'vendor',
      'Leverandør', 'Leverandørundersøkelser', 'Ny leverandørundersøkelse',
      'Egenerklæringer, samsvarssjekk og åpenhetsvurderinger fra leverandører og underentreprenører.',
      jsonb_build_array(
        jsonb_build_object('code','Åpenhetsloven §4', 'text','Aktsomhetsvurderinger for grunnleggende menneskerettigheter og anstendige arbeidsforhold.'),
        jsonb_build_object('code','Åpenhetsloven §5', 'text','Plikt til å gi informasjon til allmennheten.'),
        jsonb_build_object('code','AML §2-2',         'text','Plikter overfor andre enn egne arbeidstakere (entreprenører/underleverandører).')
      ),
      jsonb_build_object(
        'open',     'Åpne forespørsler',
        'critical', 'Mangler i svar',
        'ytd',      'Fullførte i år'
      ),
      true,                     -- requires_publish_snapshot — vendor responses are evidence
      false,                    -- default_anonymous — vendor identity matters
      5,
      10
    )
    on conflict (organization_id, slug) do nothing;

    -- ── arbeidsmiljo (Arbeidsmiljøundersøkelser) ────────────────────────
    insert into public.survey_packs (
      organization_id, slug, short_name, plural_label, cta_label,
      description, legal_references, kpi_labels,
      requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
      position
    ) values (
      v_org.id, 'arbeidsmiljo',
      'HMS', 'Arbeidsmiljøundersøkelser', 'Ny arbeidsmiljøundersøkelse',
      'QPSNordic, ARK, pulsmålinger og andre kvantitative kartlegginger av arbeidsmiljøet.',
      jsonb_build_array(
        jsonb_build_object('code','AML §4-3', 'text','Krav til det psykososiale arbeidsmiljøet.'),
        jsonb_build_object('code','AML §4-1', 'text','Generelle krav til arbeidsmiljøet.'),
        jsonb_build_object('code','IK-forskriften §5 nr. 6', 'text','Kartlegging av farer og problemer.')
      ),
      jsonb_build_object(
        'open',     'Pågående undersøkelser',
        'critical', 'Lav-score områder',
        'ytd',      'Gjennomført i år'
      ),
      false,                    -- pulse-style; questions can iterate
      true,                     -- anonymous by default
      5,
      20
    )
    on conflict (organization_id, slug) do nothing;

    -- ── compliance (Compliance-erklæringer) ─────────────────────────────
    insert into public.survey_packs (
      organization_id, slug, short_name, plural_label, cta_label,
      description, legal_references, kpi_labels,
      requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
      position
    ) values (
      v_org.id, 'compliance',
      'Compliance', 'Compliance-erklæringer', 'Ny compliance-erklæring',
      'Selvrapportering og bekreftelser av samsvar med interne policyer og eksterne krav.',
      jsonb_build_array(
        jsonb_build_object('code','IK-forskriften §5 nr. 2', 'text','Tilstrekkelig kunnskap og ferdigheter hos arbeidstakere.'),
        jsonb_build_object('code','AML §3-1',                 'text','Krav til systematisk HMS-arbeid.')
      ),
      jsonb_build_object(
        'open',     'Åpne erklæringer',
        'critical', 'Manglende bekreftelser',
        'ytd',      'Bekreftet i år'
      ),
      true,                     -- compliance evidence — lock on publish
      false,                    -- identified respondents (signed attestations)
      5,
      30
    )
    on conflict (organization_id, slug) do nothing;

    -- ── engagement (Engasjements- og kulturmålinger) ────────────────────
    insert into public.survey_packs (
      organization_id, slug, short_name, plural_label, cta_label,
      description, legal_references, kpi_labels,
      requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
      position
    ) values (
      v_org.id, 'engagement',
      'Engasjement', 'Engasjementsundersøkelser', 'Ny engasjementsundersøkelse',
      'eNPS, Edmondson, Google re:Work og andre engasjements- og kulturmålinger.',
      jsonb_build_array(),
      jsonb_build_object(
        'open',     'Pågående målinger',
        'critical', 'Detraktor-andel',
        'ytd',      'Fullførte i år'
      ),
      false,
      true,
      5,
      40
    )
    on conflict (organization_id, slug) do nothing;

    -- ── exit (Exit-undersøkelser) ───────────────────────────────────────
    insert into public.survey_packs (
      organization_id, slug, short_name, plural_label, cta_label,
      description, legal_references, kpi_labels,
      requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
      position
    ) values (
      v_org.id, 'exit',
      'Exit', 'Exit-undersøkelser', 'Ny exit-undersøkelse',
      'Sluttsamtale-undersøkelser ved oppsigelse eller avslutning av arbeidsforhold.',
      jsonb_build_array(),
      jsonb_build_object(
        'open',     'Åpne exit-undersøkelser',
        'critical', 'Forfalt',
        'ytd',      'Fullførte i år'
      ),
      false,
      true,
      3,                        -- smaller anonymity threshold for low-volume exit data
      50
    )
    on conflict (organization_id, slug) do nothing;

  end loop;
end $$;
