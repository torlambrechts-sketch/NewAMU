-- Seeding fix: new organizations never received compliance checklist templates.
--
-- Gap closed: every capability module (alerts, meetings, tasks, registers,
-- regulations, survey packs, learning categories, studio ISO seed) has an
-- AFTER INSERT trigger on `organizations` that provisions its baseline. The
-- compliance module is the exception — `provision_compliance_baseline_for_org`
-- is driven by `compliance_pack_provision_tg`, a trigger on `compliance_packs`,
-- on the premise that "the licence grant is the trigger event". But the only
-- org-creation path (`create_organization_with_brreg`) never inserts a
-- `compliance_packs` row, and the Compliance Studio wizard that was meant to
-- be the fallback called the RPC with the wrong argument name. Net effect:
-- brand-new tenants got document/survey/register/etc. baselines but ZERO
-- compliance checklist templates, sjekkliste-kategorier, or template
-- requirements.
--
-- Fix: add an AFTER INSERT trigger on `organizations` that grants every new
-- org the Norwegian baseline compliance pack (`aml-amu`, the AML/AMU pack
-- every virksomhet needs under arbeidsmiljøloven). Inserting that
-- `compliance_packs` row cascades through the existing
-- `compliance_pack_provision_tg`, which runs `provision_compliance_baseline_for_org`
-- and seeds the checklist categories + template requirements. ISO packs
-- (45001/9001/14001/27001) stay opt-in — certification scopes a tenant
-- chooses explicitly.
--
-- short_name / plural_label / cta_label are NOT NULL on compliance_packs and
-- are NOT auto-filled by compliance_packs_before_insert_defaults, so the full
-- canonical aml-amu display row is inserted here.
--
-- Backfill: any existing organization missing the aml-amu pack row gets one,
-- so any tenant created before this migration converges.
--
-- Self-audit (Arbeidstilsynet POV): pålegg-grunn addressed — a new virksomhet
-- previously had no internkontroll-sjekklister at all (IK-forskriften § 5),
-- which is itself a pålegg-grunn. Restrisiko deferred: documents baseline
-- provisioning has no live org-insert trigger and no provision function;
-- tracked separately.

-- Prerequisite repair: the BEFORE INSERT trigger organizations_set_alerts_slug()
-- still referenced `new.whistle_public_slug`, a column that was renamed to
-- `alerts_public_slug`. plpgsql resolves record fields at runtime, so EVERY
-- insert into `organizations` was failing with
-- `record "new" has no field "whistle_public_slug"` — org creation (and
-- therefore onboarding and all of the provisioning below) was completely
-- broken. Rewritten to use only the current column.
create or replace function public.organizations_set_alerts_slug()
returns trigger
language plpgsql
as $function$
begin
  if new.alerts_public_slug is null or length(trim(new.alerts_public_slug)) < 8 then
    new.alerts_public_slug := replace(new.id::text, '-', '');
  end if;
  return new;
end;
$function$;

create or replace function public.compliance_provision_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Idempotent: the unique (organization_id, slug) constraint plus
  -- `compliance_pack_provision_on_change` make a re-grant a no-op.
  insert into public.compliance_packs (
    organization_id, slug, short_name, plural_label, cta_label, description,
    position, is_active, requires_verneombud_signing,
    legal_references, kpi_labels, severity_labels
  )
  values (
    new.id, 'aml-amu', 'AML', 'Vernerunder', 'Ny vernerunde',
    'Vernerunder og avvik etter arbeidsmiljøloven og internkontrollforskriften.',
    10, true, true,
    ('[{"code":"AML §3-1","text":"Krav til systematisk HMS-arbeid (internkontroll)."},'
    || '{"code":"AML §4-1","text":"Generelle krav til arbeidsmiljøet."},'
    || '{"code":"IK-forskriften §5","text":"Internkontrollens innhold (sjekklister, avvik, oppfølging)."}]')::jsonb,
    '{"ytd":"Vernerunder i år","open":"Åpne vernerunder","critical":"Kritiske avvik"}',
    '{"low":"Forbedringspotensial","medium":"Mindre avvik","high":"Vesentlig avvik","critical":"Kritisk avvik"}'
  )
  on conflict (organization_id, slug) do nothing;

  return new;
end;
$function$;

drop trigger if exists compliance_provision_on_org_insert_tg on public.organizations;
create trigger compliance_provision_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.compliance_provision_on_org_insert();

-- Backfill organizations that predate this trigger.
insert into public.compliance_packs (
  organization_id, slug, short_name, plural_label, cta_label, description,
  position, is_active, requires_verneombud_signing,
  legal_references, kpi_labels, severity_labels
)
select
  o.id, 'aml-amu', 'AML', 'Vernerunder', 'Ny vernerunde',
  'Vernerunder og avvik etter arbeidsmiljøloven og internkontrollforskriften.',
  10, true, true,
  ('[{"code":"AML §3-1","text":"Krav til systematisk HMS-arbeid (internkontroll)."},'
  || '{"code":"AML §4-1","text":"Generelle krav til arbeidsmiljøet."},'
  || '{"code":"IK-forskriften §5","text":"Internkontrollens innhold (sjekklister, avvik, oppfølging)."}]')::jsonb,
  '{"ytd":"Vernerunder i år","open":"Åpne vernerunder","critical":"Kritiske avvik"}',
  '{"low":"Forbedringspotensial","medium":"Mindre avvik","high":"Vesentlig avvik","critical":"Kritisk avvik"}'
from public.organizations o
on conflict (organization_id, slug) do nothing;
