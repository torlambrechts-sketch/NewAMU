-- Meetings — additive agenda + checklist items per H0 verification (H2).
--
-- Why
--   The H0 lovdata verification log identified legally-required topics
--   that the current seed templates do not surface as agenda items. This
--   migration adds those items where the law mandates them.
--
--   Skipped here (gated on reviewer confirmation per H0 §10):
--    * Hovedavtalen § 9-3 bedriftsutvalg additions (ny teknologi,
--      personalpolitikk) — Hovedavtalen text is paywalled.
--    * ISO/IEC 27001:2022 § 9.3.2 sub-letter relabelings — ISO is paywalled.
--
-- Strategy
--   Idempotent UPDATE + jsonb concat. Each addition is guarded by a
--   "key does not already exist" check so re-running is a no-op. New
--   defaultPosition values use round numbers between existing items
--   (e.g. 25 between 20 and 30) so the position-sort stays stable
--   without renumbering the existing items.
--
-- Self-audit (Arbeidstilsynet POV)
--   * AML § 7-2 (2) bokstav a (bedriftshelsetjeneste) — not surfaced
--     anywhere across the 4-meeting AMU cycle today. Adding it to
--     Q4 årsmøte as an annual BHT-årsoversikt closes the gap.
--   * AML § 7-2 (2) bokstav c (planer som krever Arbeidstilsynets
--     samtykke via § 18-9) — adding to Q1 as an "on demand"
--     non-mandatory item; relevant only when the org has bygg- /
--     prosessplaner som § 18-9 dekker.
--   * AML § 7-2 (2) bokstav f (arbeidstidsordninger) — added to
--     Q4 årsmøte as annual review of working-hours arrangements.
--   * AML § 7-2 (6) "rapport til styrende organer og arbeidstakernes
--     organisasjoner" — distribution to ansattes organisasjoner is a
--     statutory step that wasn't surfaced; added to Q4.
--   * AML § 8-2 informasjon-plikt — drofting-omstilling currently
--     conflates this with § 15-1 individual-related items. Adding
--     § 8-2-style "virksomhetens aktuelle og forventede utvikling"
--     as a distinct topic.
--   * AML § 15-2 masseoppsigelse + NAV-meldeplikt — currently missing;
--     added to drofting-omstilling.
--   * AML § 2A-3 + § 2A-4 — varslingsutvalg preparation must confirm
--     that varslingsrutiner exist and fremgangsmåte is followed.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. amu-kvartalsmote-q1 — add § 18-9 major-plans item                     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'major_plans_at_samtykke',
          'title', 'Planer som krever Arbeidstilsynets samtykke (§ 18-9) — ved behov',
          'description', 'Behandle eventuelle planer for byggearbeider eller prosesser som krever Arbeidstilsynets forhåndssamtykke. Bare aktuelt når slike planer foreligger.',
          'isMandatory', false,
          'lawRef', 'AML § 7-2 (2) bokstavene c og d',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'amu-kvartalsmote-q1'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "major_plans_at_samtykke")');

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. amu-arsrapport-q4 — add bokstav a/f + distribution                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- a) Bedriftshelsetjeneste — årsoversikt og bidrag (§ 7-2 (2) bokstav a)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'bht_annual_status',
          'title', 'Bedriftshelsetjeneste — årsoversikt og bidrag',
          'description', 'Gjennomgang av BHTs aktiviteter, rapporter og bidrag til arbeidsmiljøet det siste året.',
          'isMandatory', true,
          'lawRef', 'AML § 7-2 (2) bokstav a',
          'defaultPosition', 25
        )
      )
    ),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "bht_annual_status")');

-- f) Arbeidstidsordninger — helse og velferd (§ 7-2 (2) bokstav f)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'arbeidstidsordninger_annual',
          'title', 'Arbeidstidsordninger — helse- og velferdsmessige spørsmål',
          'description', 'Gjennomgang av virksomhetens arbeidstidsordninger og deres innvirkning på arbeidstakernes helse og velferd.',
          'isMandatory', true,
          'lawRef', 'AML § 7-2 (2) bokstav f',
          'defaultPosition', 75
        )
      )
    ),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "arbeidstidsordninger_annual")');

-- Distribusjon til ansattes organisasjoner (§ 7-2 (6) statutory step)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'distribution_to_organisations',
          'title', 'Distribusjon — styrende organer og ansattes organisasjoner',
          'description', 'Bekreft at AMU-årsrapporten distribueres til både styrende organer og arbeidstakernes organisasjoner per AML § 7-2 (6).',
          'isMandatory', true,
          'lawRef', 'AML § 7-2 (6)',
          'defaultPosition', 85
        )
      )
    ),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "distribution_to_organisations")');

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. drofting-omstilling — § 8-2 informasjon + § 15-2 NAV-meldeplikt       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- § 8-2 informasjon-topic: "virksomhetens aktuelle og forventede utvikling"
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'org_informasjon',
          'title', 'Informasjon om virksomhetens aktuelle og forventede utvikling',
          'description', 'AML § 8-2 (2) — gi informasjon om virksomhetens drift, sysselsetting og vesentlige endringer i arbeidsorganiseringen, før eller samtidig med drøfting av tiltaket.',
          'isMandatory', true,
          'lawRef', 'AML § 8-2',
          'defaultPosition', 5
        )
      )
    ),
    updated_at = now()
where id = 'drofting-omstilling'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "org_informasjon")');

-- § 15-2 masseoppsigelse — NAV-meldeplikt (only when applicable)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'masseoppsigelse_nav',
          'title', 'Masseoppsigelse — meldeplikt til NAV',
          'description', 'AML § 15-2 — ved 10+ oppsigelser innen 30 dager skal melding sendes NAV samtidig som drøfting starter. Bare aktuelt ved masseoppsigelse.',
          'isMandatory', false,
          'lawRef', 'AML § 15-2',
          'defaultPosition', 35
        )
      )
    ),
    updated_at = now()
where id = 'drofting-omstilling'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "masseoppsigelse_nav")');

-- Individuell drøftelsessamtale-spor (når kollektiv drøfting følges av oppsigelser)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'individuell_droftelse',
          'title', 'Plan for individuell drøftelsessamtale per ansatt',
          'description', 'AML § 15-1 første ledd — bekreft at individuell drøftelsessamtale gjennomføres med hver berørt ansatt før oppsigelse. Kollektiv drøfting erstatter ikke individuell.',
          'isMandatory', true,
          'lawRef', 'AML § 15-1',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'drofting-omstilling'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "individuell_droftelse")');

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. varslingsutvalg — fix "ved behov" wording + add § 2A-3/-4 checklist   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Re-label agendaItems[1] sak — anonymization is mandatory, not optional
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems,1,title}',
      '"Saksgjennomgang (anonymisert oversikt — lovpålagt)"'::jsonb
    ),
    updated_at = now()
where id = 'varslingsutvalg'
  and (definition->'agendaItems'->1->>'key') = 'sak'
  and (definition->'agendaItems'->1->>'title') = 'Saksgjennomgang (anonymisert ved behov)';

-- Add § 2A-3 / § 2A-4 confirmation to preparationChecklist
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{preparationChecklist}',
      (definition->'preparationChecklist') || jsonb_build_array(
        jsonb_build_object(
          'key', 'varslingsrutiner_exists',
          'label', 'Varslingsrutiner finnes og er oppdatert (gjelder § 2A-3 og § 2A-4)',
          'isMandatory', true,
          'lawRef', 'AML § 2A-3'
        )
      )
    ),
    updated_at = now()
where id = 'varslingsutvalg'
  and not (definition->'preparationChecklist' @? '$[*] ? (@.key == "varslingsrutiner_exists")');

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. Update law_refs[] arrays to include the newly-cited paragraphs        │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Q1: add § 18-9 to top-level law_refs
update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array['AML § 18-9'])),
    updated_at = now()
where id = 'amu-kvartalsmote-q1'
  and not ('AML § 18-9' = any(law_refs));

-- Q4: add bokstav a/f references to top-level
update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'AML § 7-2 (2) bokstav a',
      'AML § 7-2 (2) bokstav f'
    ])),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and not ('AML § 7-2 (2) bokstav a' = any(law_refs));

-- drofting-omstilling already lists § 8-2 + § 15-2; no top-level changes needed.

-- varslingsutvalg: add § 2A-3 + § 2A-4 (in addition to existing § 2A-7)
update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'AML § 2A-3',
      'AML § 2A-4'
    ])),
    updated_at = now()
where id = 'varslingsutvalg'
  and not ('AML § 2A-3' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 6. Verification queries                                                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- expected: array contains major_plans_at_samtykke
-- select jsonb_path_query(definition, '$.agendaItems[*].key') from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 3 new keys (bht_annual_status, arbeidstidsordninger_annual, distribution_to_organisations)
-- select jsonb_path_query(definition, '$.agendaItems[*].key') from public.meeting_system_templates where id = 'amu-arsrapport-q4';

-- expected: 3 new keys (org_informasjon, masseoppsigelse_nav, individuell_droftelse)
-- select jsonb_path_query(definition, '$.agendaItems[*].key') from public.meeting_system_templates where id = 'drofting-omstilling';

-- expected: sak.title contains "anonymisert oversikt — lovpålagt"; preparationChecklist contains varslingsrutiner_exists
-- select definition from public.meeting_system_templates where id = 'varslingsutvalg';
