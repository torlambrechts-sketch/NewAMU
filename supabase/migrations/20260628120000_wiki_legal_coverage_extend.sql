-- Extend legal coverage catalog: requirement text, applicability, consequences, new entries.

-- ---------------------------------------------------------------------------
-- 1. Columns (idempotent)
-- ---------------------------------------------------------------------------

alter table public.wiki_legal_coverage_items
  add column if not exists requirement text,
  add column if not exists category text not null default 'compliance',
  add column if not exists mandatory_for_all boolean not null default true,
  add column if not exists min_employees int not null default 1,
  add column if not exists max_revision_months int not null default 12,
  add column if not exists legal_consequence text;

-- Backfill requirement from legacy label
update public.wiki_legal_coverage_items
set requirement = coalesce(nullif(trim(requirement), ''), nullif(trim(label), ''), ref)
where requirement is null or trim(requirement) = '';

alter table public.wiki_legal_coverage_items
  alter column requirement set not null;

-- ---------------------------------------------------------------------------
-- 2. Seed / upsert new coverage items + attribute updates
-- ---------------------------------------------------------------------------

insert into public.wiki_legal_coverage_items (ref, label, requirement, category, template_ids, mandatory_for_all, min_employees, max_revision_months, legal_consequence)
values
  ('AML §2A-6', 'Skriftlig varslingsrutine', 'Skriftlig varslingsrutine (for virksomheter med >5 ansatte)', 'varsling', array['tpl-varsling']::text[], true, 5, 12, 'Pålegg fra Arbeidstilsynet, overtredelsesgebyr (AML §18-10)'),
  ('AML §2A-7', 'Varslingskanal', 'Krav til varslingskanal — konfidensialitet og tilbakemelding', 'varsling', array['tpl-varsling']::text[], true, 5, 12, 'Pålegg fra Arbeidstilsynet, overtredelsesgebyr (AML §18-10)'),
  ('GDPR Art. 13', 'Personvernerklæring', 'Personvernerklæring — informasjon til ansatte om behandling av personopplysninger', 'personvern', array['tpl-personvern-ansatt']::text[], true, 1, 12, 'Pålegg fra Datatilsynet, gebyr inntil 4% av global omsetning (GDPR Art. 83)'),
  ('GDPR Art. 30', 'Behandlingsprotokoll', 'Behandlingsprotokoll — oversikt over behandlingsaktiviteter', 'personvern', array['tpl-behandlingsprotokoll']::text[], true, 1, 12, 'Pålegg fra Datatilsynet, gebyr inntil 4% av global omsetning (GDPR Art. 83)'),
  ('AML §14-5', 'Arbeidsavtale', 'Skriftlig arbeidsavtale innen 1 måned etter ansettelse', 'ansettelse', array['tpl-arbeidsavtale']::text[], true, 1, 12, null),
  ('AML §4-3', 'Psykososialt arbeidsmiljø', 'Kartlegging og tiltak — psykososialt arbeidsmiljø', 'arbeidsmiljoe', array['tpl-psykososialt']::text[], true, 1, 12, null),
  ('AML §3-4 / IA', 'IA-rutine sykmeldte', 'Rutine for oppfølging av sykmeldte og tilrettelegging (IA-avtalen)', 'tilrettelegging', array['tpl-ia-rutine']::text[], true, 1, 12, null),
  ('AML §10-2', 'Redusert arbeidstid', 'Rutine for søknad om redusert arbeidstid og tilrettelegging', 'tilrettelegging', array['tpl-redusert-tid']::text[], true, 1, 12, null),
  ('Regnskapsloven §2-7', 'Oppbevaring personaldokumenter', 'Oppbevaringsplikt — lønns- og personaldokumenter (5 år)', 'arkiv', array[]::text[], true, 1, 12, null),
  ('Forskrift om organisering §3-18', 'HMS-opplæring ledere', 'Dokumentasjon av HMS-opplæring for ledere', 'opplaering', array['tpl-opplaering']::text[], true, 1, 12, null)
on conflict (ref) do update set
  label = excluded.label,
  requirement = excluded.requirement,
  category = excluded.category,
  template_ids = excluded.template_ids,
  mandatory_for_all = excluded.mandatory_for_all,
  min_employees = excluded.min_employees,
  max_revision_months = excluded.max_revision_months,
  legal_consequence = excluded.legal_consequence;

update public.wiki_legal_coverage_items set
  min_employees = 5,
  legal_consequence = 'Pålegg fra Datatilsynet, gebyr inntil 4% av global omsetning (GDPR Art. 83)'
where ref in ('GDPR Art. 13', 'GDPR Art. 30');

update public.wiki_legal_coverage_items set
  min_employees = 5,
  legal_consequence = 'Pålegg fra Arbeidstilsynet, overtredelsesgebyr (AML §18-10)'
where ref in ('AML §2A-6', 'AML §2A-7');

update public.wiki_legal_coverage_items set
  max_revision_months = 12,
  legal_consequence = coalesce(legal_consequence, 'Kan utgjøre brudd på IK-forskriften § 5')
where ref like 'IK-f%';

-- ---------------------------------------------------------------------------
-- 3. Compliance summary view: expose catalog category + requirement text
-- ---------------------------------------------------------------------------

drop view if exists public.wiki_compliance_summary cascade;

create or replace view public.wiki_compliance_summary as
select
  c.id,
  c.ref,
  coalesce(nullif(trim(c.requirement), ''), nullif(trim(c.label), ''), c.ref) as requirement,
  coalesce(nullif(trim(c.category), ''), 'compliance'::text) as category,
  o.organization_id,
  count(p.id) filter (
    where p.id is not null
      and p.status = 'published'
      and (
        p.next_revision_due_at is null
        or (p.next_revision_due_at at time zone 'UTC')::date > (timezone('UTC', now()))::date
      )
  ) as covered_count,
  min(p.next_revision_due_at) filter (where p.status = 'published') as earliest_revision_due,
  bool_or(
    p.id is not null
    and p.status = 'published'
    and p.next_revision_due_at is not null
    and (p.next_revision_due_at at time zone 'UTC')::date <= (timezone('UTC', now()))::date
  ) as has_overdue
from public.wiki_legal_coverage_items c
cross join (
  select distinct organization_id from public.wiki_pages
  union
  select distinct organization_id from public.wiki_spaces
) o
left join public.wiki_pages p
  on p.organization_id = o.organization_id
  and c.ref = any (p.legal_refs)
group by c.id, c.ref, c.label, c.requirement, c.category, o.organization_id;

comment on view public.wiki_compliance_summary is
  'Per (coverage item, organization): covered_count = published pages with ref and revision current; has_overdue = any published match with revision due on or before today (UTC date).';

grant select on public.wiki_compliance_summary to authenticated;
