-- Internkontroll framework seed — IK-forskriften, GDPR, Åpenhetsloven.
--
-- Phase 1 of the internkontroll module shipped a 5-framework gap
-- matrix, but seeded artefacts only systematically reference AML
-- paragraphs — the four non-AML frameworks (IK-f, GDPR,
-- Åpenhetsloven, ISO 45001) showed as walls of empty cells.
--
-- This migration closes that gap by seeding three lightweight system
-- compliance_checklist_templates — one per framework that wasn't
-- already covered. Each is a real Norwegian compliance obligation that
-- any covered org should run annually:
--
--   1. ik-forskriften-arsgjennomgang — IK-f § 5 nr. 1–8 (the full
--      eight-bullet internkontroll standard)
--   2. gdpr-arsgjennomgang        — GDPR Art. 5, 6, 13, 25, 30, 32, 33,
--      35, 37 (the controls that touch every behandlingsansvarlig)
--   3. apenhetsloven-arsgjennomgang — Åpenhetsloven § 4, 5, 6, 7 (the
--      aktsomhetsvurdering + redegjørelse loop)
--
-- ISO 45001 paragraphs are already referenced by the meetings module's
-- "ISO 45001 — Ledelsens gjennomgang" template seeded in
-- RUN_MEETINGS_MODULE.sql, so we don't duplicate that here.
--
-- Self-revisjon (Arbeidstilsynet / Datatilsynet / Forbrukertilsynet POV):
--  - IK-f § 5 (alle åtte punkter dekket av kontrollpunktene under)
--  - GDPR Art. 30 + Art. 32 (behandlingsprotokoll + sikkerhet —
--    sjekklisten dokumenterer at de er etablert + revidert)
--  - Åpenhetsloven § 5 (offentlig redegjørelse innen 30. juni —
--    sjekklisten passer som annual gate før publisering)
-- Restrisiko:
--  - Templates er kontroll-malen, ikke selve rutinen. Orgen må også
--    ha de underliggende rutinene (varslingsrutine, behandlings-
--    protokoll, aktsomhetsvurderingsrapport) som dokumenter — de
--    seedes via egen migrasjon hvis manglende.

set local search_path = public, pg_catalog;

-- ── 1. IK-forskriften årsgjennomgang ────────────────────────────────────
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      law_refs, is_active, is_system, review_status, cadence_hint
    ) values (
      v_org_id,
      'aml-amu',
      'ik-forskriften-arsgjennomgang',
      'IK-forskriften — årsgjennomgang',
      'Årlig gjennomgang av internkontrollen etter forskrift om systematisk helse-, miljø- og sikkerhetsarbeid (IK-f) § 5 nr. 1–8. Skal dokumentere at virksomheten har et reelt internkontrollsystem som dekker alle åtte bestanddelene loven krever.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','mal_bekrefte','prompt','Er virksomhetens HMS-mål skriftlige og kjent for arbeidstakerne?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 1','severity_default','medium',
                           'help','§ 5 nr. 1: sørge for at de lover og forskrifter som gjelder for virksomheten er tilgjengelige, og ha oversikt over de krav som er av særlig viktighet.'),
        jsonb_build_object('key','ansvar_oppgaver','prompt','Er det skriftlig dokumentert hvordan ansvar og oppgaver er fordelt for HMS-arbeidet?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 2','severity_default','high'),
        jsonb_build_object('key','medvirkning','prompt','Sørger virksomheten for at arbeidstakerne medvirker, og har tilstrekkelige kunnskaper og ferdigheter om HMS?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 3','severity_default','high',
                           'help','Omfatter både opplæring, kompetansetiltak og reell medvirkning fra verneombud + AMU.'),
        jsonb_build_object('key','arbeidstakers_kunnskap','prompt','Er det dokumentert hva arbeidstakerne skal kunne / vite om HMS, og er denne opplæringen gjennomført siste 12 mnd.?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 4','severity_default','medium'),
        jsonb_build_object('key','kartlegging','prompt','Foreligger det en oppdatert kartlegging av farer og problemer, og vurdering av risiko, for HMS?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 5','severity_default','critical',
                           'help','§ 5 nr. 5 = ROS-analyse. Skal foreligge skriftlig og være vurdert siste 12 mnd.'),
        jsonb_build_object('key','tiltaksplan','prompt','Er det skrevet handlingsplaner for å redusere identifiserte risikoer, og er tiltak iverksatt?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 6','severity_default','critical'),
        jsonb_build_object('key','rutiner_avvik','prompt','Har virksomheten rutiner for å avdekke, rette opp og forebygge overtredelser av HMS-lovgivningen?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 7','severity_default','critical',
                           'help','Avvikssystem + lukke-tiltak. Skal være skriftlig og operativt.'),
        jsonb_build_object('key','gjennomgang','prompt','Gjennomgår virksomheten internkontrollen systematisk og sikrer at den fungerer som forutsatt?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 8','severity_default','high',
                           'help','§ 5 nr. 8: ledelsens gjennomgang minst årlig.'),
        jsonb_build_object('key','samordning','prompt','Hvis virksomheten har leverandører/innleide som arbeider på området: er det rutiner for samordning av HMS-arbeidet?',
                           'type','yes_no_na','required',false,
                           'law_ref','IK-f § 6','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner / forbedringspunkter','type','text','required',false),
        jsonb_build_object('key','sign_hms','prompt','HMS-leders signatur','type','signature','required',true),
        jsonb_build_object('key','sign_dl','prompt','Daglig leders signatur','type','signature','required',true)
      )),
      array[
        'IK-f § 5',
        'IK-f § 5 nr. 1','IK-f § 5 nr. 2','IK-f § 5 nr. 3','IK-f § 5 nr. 4',
        'IK-f § 5 nr. 5','IK-f § 5 nr. 6','IK-f § 5 nr. 7','IK-f § 5 nr. 8',
        'IK-f § 6'
      ]::text[],
      true, true, 'draft', 'arlig'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description,
      is_system = excluded.is_system;
  end loop;
end $$;

-- ── 2. GDPR årsgjennomgang ────────────────────────────────────────────
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      law_refs, is_active, is_system, review_status, cadence_hint
    ) values (
      v_org_id,
      'aml-amu',
      'gdpr-arsgjennomgang',
      'GDPR — årsgjennomgang',
      'Årlig kontroll av at virksomhetens behandling av personopplysninger oppfyller GDPR. Dekker behandlingsprotokoll, lovlighet, registrertes rettigheter, sikkerhet, brudd-rutiner og personvernombud.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','prinsipper','prompt','Er behandlingen i tråd med GDPR-prinsippene (lovlighet, formålsbegrensning, dataminimering, riktighet, lagringsbegrensning, integritet)?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 5','severity_default','critical'),
        jsonb_build_object('key','rettsgrunnlag','prompt','Er rettsgrunnlaget for all behandling av personopplysninger skriftlig dokumentert (samtykke / kontrakt / berettiget interesse / lovkrav / vital interesse)?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 6','severity_default','critical'),
        jsonb_build_object('key','informasjonsplikt','prompt','Får de registrerte tilstrekkelig informasjon om behandlingen ved innsamling (personvernerklæring)?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 13','severity_default','high'),
        jsonb_build_object('key','innebygd_personvern','prompt','Er prinsippene om innebygd og standardinnstilt personvern (data protection by design and by default) hensyntatt ved nye systemer / endringer?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 25','severity_default','high'),
        jsonb_build_object('key','protokoll','prompt','Er behandlingsprotokollen (ROPA) oppdatert siste 12 mnd. og dekker alle aktive behandlinger?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 30','severity_default','critical',
                           'help','Art. 30 krever skriftlig protokoll for behandlinger.'),
        jsonb_build_object('key','sikkerhet','prompt','Er det iverksatt egnede tekniske og organisatoriske tiltak for å sikre personopplysninger (tilgangsstyring, kryptering, backup, logging)?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 32','severity_default','critical'),
        jsonb_build_object('key','brudd_rutine','prompt','Har virksomheten rutiner for å varsle Datatilsynet om brudd innen 72 timer, og melde registrerte ved høy risiko?',
                           'type','yes_no_na','required',true,
                           'law_ref','GDPR Art. 33','severity_default','critical'),
        jsonb_build_object('key','dpia','prompt','Er det gjennomført personvernkonsekvensvurdering (DPIA) for behandlinger med høy risiko?',
                           'type','yes_no_na','required',false,
                           'law_ref','GDPR Art. 35','severity_default','high'),
        jsonb_build_object('key','personvernombud','prompt','Er personvernombud (DPO) utpekt der dette er krav, og er kontaktinformasjonen kommunisert?',
                           'type','yes_no_na','required',false,
                           'law_ref','GDPR Art. 37','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner / forbedringspunkter','type','text','required',false),
        jsonb_build_object('key','sign_dpo','prompt','Personvernombuds / personvernansvarliges signatur','type','signature','required',true),
        jsonb_build_object('key','sign_dl','prompt','Daglig leders signatur','type','signature','required',true)
      )),
      array[
        'GDPR Art. 5','GDPR Art. 6','GDPR Art. 13','GDPR Art. 25',
        'GDPR Art. 30','GDPR Art. 32','GDPR Art. 33','GDPR Art. 35',
        'GDPR Art. 37'
      ]::text[],
      true, true, 'draft', 'arlig'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description,
      is_system = excluded.is_system;
  end loop;
end $$;

-- ── 3. Åpenhetsloven årsgjennomgang ─────────────────────────────────────
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      law_refs, is_active, is_system, review_status, cadence_hint
    ) values (
      v_org_id,
      'aml-amu',
      'apenhetsloven-arsgjennomgang',
      'Åpenhetsloven — årsgjennomgang og redegjørelse',
      'Årlig kontroll av åpenhetslov-pliktene: aktsomhetsvurderinger av egen virksomhet + leverandørkjeden, oppdatert redegjørelse innen 30. juni, og rutiner for informasjonskrav fra offentligheten.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','virkeomraadeavklart','prompt','Er det skriftlig avklart at virksomheten faller inn under åpenhetslovens virkeområde?',
                           'type','yes_no_na','required',true,
                           'law_ref','Åpenhetsloven § 3','severity_default','high',
                           'help','§ 3 definerer "større virksomheter" — over 50 ansatte, eller over visse omsetningsterskler.'),
        jsonb_build_object('key','aktsomhet_egen','prompt','Er det utført aktsomhetsvurdering av risiko for negative konsekvenser i egen virksomhet?',
                           'type','yes_no_na','required',true,
                           'law_ref','Åpenhetsloven § 4','severity_default','critical'),
        jsonb_build_object('key','aktsomhet_leverandor','prompt','Er det utført aktsomhetsvurdering av leverandørkjede og forretningsforbindelser?',
                           'type','yes_no_na','required',true,
                           'law_ref','Åpenhetsloven § 4','severity_default','critical',
                           'help','OECDs retningslinjer + ILOs kjernekonvensjoner skal være referansegrunnlag.'),
        jsonb_build_object('key','tiltak_lukket','prompt','Er identifiserte negative konsekvenser fulgt opp med konkrete tiltak (stansing, forebygging, gjenoppretting)?',
                           'type','yes_no_na','required',true,
                           'law_ref','Åpenhetsloven § 4','severity_default','high'),
        jsonb_build_object('key','redegjorelse','prompt','Er årlig redegjørelse offentliggjort innen 30. juni, signert av styret / øverste ledelse?',
                           'type','yes_no_na','required',true,
                           'law_ref','Åpenhetsloven § 5','severity_default','critical',
                           'help','§ 5 krever redegjørelse på virksomhetens nettside, lett tilgjengelig.'),
        jsonb_build_object('key','informasjonskrav_rutine','prompt','Har virksomheten en rutine for å svare på informasjonskrav fra offentligheten innen tre uker?',
                           'type','yes_no_na','required',true,
                           'law_ref','Åpenhetsloven § 6','severity_default','high'),
        jsonb_build_object('key','informasjonskrav_logg','prompt','Føres det logg over mottatte informasjonskrav og svartider siste 12 mnd.?',
                           'type','yes_no_na','required',false,
                           'law_ref','Åpenhetsloven § 7','severity_default','medium'),
        jsonb_build_object('key','tilsyn_kjent','prompt','Er ledelsen kjent med at Forbrukertilsynet fører tilsyn og kan ilegge tvangsmulkt?',
                           'type','yes_no_na','required',false,
                           'law_ref','Åpenhetsloven § 8','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner / forbedringspunkter','type','text','required',false),
        jsonb_build_object('key','sign_apenhet','prompt','Åpenhetslov-ansvarliges signatur','type','signature','required',true),
        jsonb_build_object('key','sign_dl','prompt','Daglig leders signatur','type','signature','required',true)
      )),
      array[
        'Åpenhetsloven § 3','Åpenhetsloven § 4','Åpenhetsloven § 5',
        'Åpenhetsloven § 6','Åpenhetsloven § 7','Åpenhetsloven § 8'
      ]::text[],
      true, true, 'draft', 'arlig'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description,
      is_system = excluded.is_system;
  end loop;
end $$;
