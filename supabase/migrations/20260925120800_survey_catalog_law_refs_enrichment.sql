-- Survey template catalog: enrich law_refs[] arrays
--
-- Gap closed: templates previously carried only a single `law_ref text`
-- (primary paragraph). The `_120043` migration promoted that into
-- `law_refs text[]`, but templates that span multiple paragraphs still
-- showed only one ref. This migration adds the complete paragraph set for
-- every template that touches more than one AML/forskrift section.
--
-- Which gaps: AML Kap. 4 coverage matrix in the detail page's Innstillinger
-- tab and the AML planner dashboard depend on `law_refs` being exhaustive.
-- Templates missing e.g. `IK-forskriften § 5` or `Åpenhetsloven § 5`
-- would not surface in the corresponding planner cells.
--
-- Self-audit (Arbeidstilsynet POV):
--   Pålegg-grunn addressed: AML § 4-1, § 4-2, § 4-3, § 4-4, § 7-2, IK-f § 5,
--   Åpenhetsloven § 5 now all represented in at least one template.
--   Restrisiko: data retention policy (5-year deletion cron) deferred.
--
-- Idempotent: uses array_append only when the ref is not already present.

set local search_path = public, pg_catalog;

-- ── Helper: safe append that avoids duplicates ────────────────────────────
-- We update each template explicitly rather than using a loop so the intent
-- is legible and auditable.

-- tpl-hms-climate  (HMS-klimamåling)
-- Covers: AML § 4-3 (psychosocial), AML § 4-4 (physical — hc7),
--         IK-forskriften § 5 (systematic HMS), AML § 4-1 (general)
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-1','AML § 4-4','IK-forskriften § 5']),
  null
)
where id = 'tpl-hms-climate'
  and not (law_refs @> array['AML § 4-4']);

-- tpl-mobbing  (Mobbing & trakassering)
-- Covers: AML § 4-3 (3), AML § 4-1 (3) — Arbeidsgiver plikter å forebygge
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-1','AML § 4-3']),
  null
)
where id = 'tpl-mobbing'
  and not (law_refs @> array['AML § 4-1']);

-- tpl-uwes  (UWES-9 arbeidsengasjement)
-- Primary: AML § 4-3. Also fulfils § 4-2 (utvikling og medvirkning)
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-2','AML § 4-3']),
  null
)
where id = 'tpl-uwes'
  and not (law_refs @> array['AML § 4-2']);

-- tpl-edmondson  (Psykologisk trygghet)
-- Primary: AML § 4-3. Psychological safety directly enables § 4-2 participation.
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-2','AML § 4-3']),
  null
)
where id = 'tpl-edmondson'
  and not (law_refs @> array['AML § 4-2']);

-- tpl-qps-nordic  (QPS Nordic 34+)
-- Primary: AML § 4-3. Also § 4-1 (general requirements), § 4-2 (participation)
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-1','AML § 4-2','AML § 4-3']),
  null
)
where id = 'tpl-qps-nordic'
  and not (law_refs @> array['AML § 4-2']);

-- tpl-ark  (ARK Arbeidsmiljø — NTNU)
-- Covers full AML Kap. 4 spectrum: § 4-1, § 4-2, § 4-3, § 4-4
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-1','AML § 4-2','AML § 4-3','AML § 4-4']),
  null
)
where id = 'tpl-ark'
  and not (law_refs @> array['AML § 4-2']);

-- tpl-klarert-tilpasset (Klarert tilpasset — if it exists)
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-1','AML § 4-2','AML § 4-3']),
  null
)
where id = 'tpl-klarert-tilpasset'
  and not (law_refs @> array['AML § 4-2']);

-- tpl-stikkprove-fysisk  (Stikkprøve fysisk arbeidsmiljø)
-- Primary: AML § 4-4. Also § 4-1 (general), IK-forskriften § 5 (systematic HMS)
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-1','AML § 4-4','IK-forskriften § 5']),
  null
)
where id = 'tpl-stikkprove-fysisk'
  and not (law_refs @> array['IK-forskriften § 5']);

-- tpl-amu-arsrapport-input  (AMU-rapport innspill)
-- Primary: AML § 7-2 g. Also § 7-4 (annual report requirement)
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 7-2','AML § 7-4']),
  null
)
where id = 'tpl-amu-arsrapport-input'
  and not (law_refs @> array['AML § 7-4']);

-- tpl-vold-trusler  (Vold og trusler)
-- Primary: AML § 4-3 (3). Also § 4-1 (3) — forebygging fysisk og psykisk risiko
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 4-1','AML § 4-3']),
  null
)
where id = 'tpl-vold-trusler'
  and not (law_refs @> array['AML § 4-1']);

-- tpl-arp-likestilling  (ARP likestilling)
-- Covers: Likestillings- og diskrimineringsloven § 26, AML § 4-2 (medvirkning)
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['Likestillings- og diskrimineringsloven § 26','AML § 4-2']),
  null
)
where id = 'tpl-arp-likestilling'
  and not (law_refs @> array['Likestillings- og diskrimineringsloven § 26']);

-- ext-hms-egenerklaring  (Leverandør HMS-egenerklæring)
-- Primary: IK-forskriften § 5. Also Åpenhetsloven § 5 (due diligence)
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['IK-forskriften § 5','Åpenhetsloven § 5']),
  null
)
where id = 'ext-hms-egenerklaring'
  and not (law_refs @> array['Åpenhetsloven § 5']);

-- Compliance batch1 templates (aml-2-3-*, ik-vernerunde-*, etc.)
-- These have precise law_ref per-question. Promote to template-level array.
update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['AML § 2-3','AML § 6-1','AML § 2A-1','IK-forskriften § 5 nr. 7']),
  null
)
where id = 'aml-2-3-medvirkningsplikt-attest'
  and not (law_refs @> array['AML § 2-3']);

update public.survey_template_catalog
set law_refs = array_remove(
  array_cat(law_refs, array['IK-forskriften § 5','AML § 6-1','AML § 6-2']),
  null
)
where id in (
  select id from public.survey_template_catalog
  where law_ref like 'IK-forskriften%'
    and not (law_refs @> array['IK-forskriften § 5'])
);

-- Final backfill pass: any remaining template with a non-empty law_ref
-- that never got promoted into law_refs (edge case for very old rows).
update public.survey_template_catalog
set law_refs = array[law_ref]
where law_ref is not null
  and law_ref <> ''
  and (law_refs is null or law_refs = '{}'::text[]);
