-- Survey packs provision recovery — parallel to _120033 documents bundle.
--
-- Why: the original survey_packs seed (archive/20260811120000) ran a
-- one-shot `do $$ for each org loop $$` block that only seeded the
-- five default packs (vendor / arbeidsmiljo / compliance / engagement /
-- exit) for orgs that existed *at apply time*. Orgs created after that
-- migration ran never got their per-org survey_packs rows, which
-- cascades:
--   - `useSurveyPacks()` returns empty → SurveyHubLanding shows
--     "Ingen undersøkelsespakker er lisensiert for organisasjonen ennå"
--   - `provision_survey_baseline_for_org` (called by the
--     survey_packs insert trigger) never fires → no templates land in
--     `survey_org_templates` either
--
-- Documents handles this via `documents_provision_on_org_insert_tg`.
-- Compliance has the same pattern. Survey was missing the equivalent.
--
-- This migration:
--   1. Defines `provision_survey_packs_for_org(p_org_id uuid)` that
--      seeds the five default packs idempotently (on-conflict do
--      nothing on the (organization_id, slug) unique constraint).
--   2. Wires it on `after insert on public.organizations`.
--   3. Backfills every existing org. The on-conflict guard means orgs
--      that already have rows are no-ops.
--
-- After step 3, the existing survey_packs insert trigger (from
-- archive/20260811120200) fires `provision_survey_baseline_for_org`
-- for each newly seeded (org, slug), which mirrors the system
-- templates into survey_org_templates with nav_pinned = true.
--
-- Idempotent. Safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. Provision function ─────────────────────────────────────────────────

create or replace function public.provision_survey_packs_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- vendor (Leverandørkontroll)
  insert into public.survey_packs (
    organization_id, slug, short_name, plural_label, cta_label,
    description, legal_references, kpi_labels,
    requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
    position
  ) values (
    p_org_id, 'vendor',
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
    true, false, 5, 10
  )
  on conflict (organization_id, slug) do nothing;

  -- arbeidsmiljo (Arbeidsmiljøundersøkelser)
  insert into public.survey_packs (
    organization_id, slug, short_name, plural_label, cta_label,
    description, legal_references, kpi_labels,
    requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
    position
  ) values (
    p_org_id, 'arbeidsmiljo',
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
    false, true, 5, 20
  )
  on conflict (organization_id, slug) do nothing;

  -- compliance (Compliance-erklæringer)
  insert into public.survey_packs (
    organization_id, slug, short_name, plural_label, cta_label,
    description, legal_references, kpi_labels,
    requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
    position
  ) values (
    p_org_id, 'compliance',
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
    true, false, 5, 30
  )
  on conflict (organization_id, slug) do nothing;

  -- engagement (Engasjements- og kulturmålinger)
  insert into public.survey_packs (
    organization_id, slug, short_name, plural_label, cta_label,
    description, legal_references, kpi_labels,
    requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
    position
  ) values (
    p_org_id, 'engagement',
    'Engasjement', 'Engasjementsundersøkelser', 'Ny engasjementsundersøkelse',
    'eNPS, Edmondson, Google re:Work og andre engasjements- og kulturmålinger.',
    jsonb_build_array(),
    jsonb_build_object(
      'open',     'Pågående målinger',
      'critical', 'Detraktor-andel',
      'ytd',      'Fullførte i år'
    ),
    false, true, 5, 40
  )
  on conflict (organization_id, slug) do nothing;

  -- exit (Exit-undersøkelser)
  insert into public.survey_packs (
    organization_id, slug, short_name, plural_label, cta_label,
    description, legal_references, kpi_labels,
    requires_publish_snapshot, default_anonymous, default_anonymity_threshold,
    position
  ) values (
    p_org_id, 'exit',
    'Exit', 'Exit-undersøkelser', 'Ny exit-undersøkelse',
    'Sluttsamtale-undersøkelser ved oppsigelse eller avslutning av arbeidsforhold.',
    jsonb_build_array(),
    jsonb_build_object(
      'open',     'Åpne exit-undersøkelser',
      'critical', 'Forfalt',
      'ytd',      'Fullførte i år'
    ),
    false, true, 3, 50
  )
  on conflict (organization_id, slug) do nothing;
end;
$$;

revoke all on function public.provision_survey_packs_for_org(uuid) from public, anon;
grant execute on function public.provision_survey_packs_for_org(uuid) to authenticated, service_role;

-- ── 2. Trigger: new-org auto-baseline ─────────────────────────────────────

create or replace function public.survey_packs_provision_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_survey_packs_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists survey_packs_provision_on_org_insert_tg on public.organizations;
create trigger survey_packs_provision_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.survey_packs_provision_on_org_insert();

-- ── 3. Backfill every existing org ────────────────────────────────────────
-- After the rows land, the existing
-- `survey_packs_provision_baseline_tg` insert trigger (from
-- archive/20260811120200) fires `provision_survey_baseline_for_org`
-- per (org, slug), which mirrors system templates → survey_org_templates.

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_survey_packs_for_org(v_org.id);
  end loop;
end $$;
