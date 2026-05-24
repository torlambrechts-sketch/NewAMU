-- Close three legal coverage gaps identified in the compliance review:
--
--   1. AML § 4-6 oppfølgings-samtale — tilrettelegging for ansatte med
--      redusert arbeidsevne. Lovpålagt møte separat fra MUS.
--   2. AML § 14-9 drøfting midlertidige tilsettinger — drøftingsplikt
--      med tillitsvalgte minst en gang per år om bruk av midlertidige.
--   3. Folketrygdloven § 25-2 / AML § 4-6 dialogmøter (1, 2, 3) —
--      sykefraværsoppfølging på uke 7, uke 26, og NAV-arrangert (3).
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * AML § 4-6 (1) — arbeidsgiver skal sørge for utarbeidet
--     oppfølgingsplan i samarbeid med arbeidstaker. Mal-strukturert
--     møte sikrer at planen blir laget og protokollført.
--   * Folketrygdloven § 25-2 — arbeidsgiver er pliktig å innkalle til
--     dialogmøte 1 innen uke 7. Brudd → pålegg fra NAV/Arbeidstilsynet.
--   * AML § 14-9 (1) andre punktum — drøfting med tillitsvalgte
--     minst en gang per år; mangel → pålegg-grunn.
--
-- Idempotent — on conflict (id) do update.

set local search_path = public, pg_catalog;

-- ============================================================
-- 1. AML § 4-6 — oppfølgings-samtale (tilretteleggingsmøte)
-- ============================================================
insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_confidentiality_level,
  minimum_employee_count, definition, metadata_schema, is_active, sort_order
) values (
  'oppfolgingsmote-tilrettelegging',
  'oppfolgingsmote-tilrettelegging',
  'Oppfølgings-/tilretteleggingsmøte (§ 4-6)',
  'Lovpålagt møte mellom leder og ansatt med redusert arbeidsevne for å lage og oppdatere oppfølgingsplan med konkrete tilretteleggings­tiltak. Egnet både ved fysisk og psykisk helseutfordring. Konfidensielt som standard.',
  'AML',
  array['AML'],
  array['AML § 4-6', 'AML § 4-6 (3)', 'Folketrygdloven § 25-2'],
  'ad_hoc',
  60,
  'confidential',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'funksjonsvurdering',
        'title', 'Funksjonsvurdering — hva ansatt kan/ikke kan',
        'lawRef', 'AML § 4-6 (1)',
        'description', 'Kartlegg konkret hvilke oppgaver ansatt kan utføre, med hvilken belastning, og innenfor hvilken tidshorisont. Bygger oppfølgingsplanen.',
        'dataBinding', jsonb_build_object(
          'source', 'sick_leave_stats',
          'window', 'last_year',
          'presentation', 'summary'
        ),
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'tilretteleggingstiltak',
        'title', 'Konkrete tilretteleggingstiltak',
        'lawRef', 'AML § 4-6 (1)',
        'description', 'Endring av arbeidsoppgaver, arbeidstid, fysisk arbeidsplass, hjelpemidler, kompetansetiltak. Skal være konkret og målbart.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'oppfolgingsplan',
        'title', 'Oppfølgingsplan — frister og ansvar',
        'lawRef', 'AML § 4-6 (3)',
        'description', 'Skriftlig plan med konkrete tiltak, ansvarlig, frister og evalueringspunkt. Skal være klar innen 4 uker fra sykmelding starter.',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'bht_involvering',
        'title', 'Behov for bedriftshelsetjeneste-bistand',
        'lawRef', 'AML § 4-6 (2)',
        'description', 'Vurder om BHT bør delta i videre oppfølging. Krav til BHT-deltakelse ved behov for medisinsk-faglig vurdering.',
        'isMandatory', false,
        'recommended', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'neste_evaluering',
        'title', 'Neste evalueringstidspunkt',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 5
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'member', 'count', 1)
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'sykemelding_innhentet',
        'label', 'Sykemelding og medisinsk informasjon innhentet (med samtykke)',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'forrige_plan',
        'label', 'Forrige oppfølgingsplan tilgjengelig',
        'isMandatory', false
      )
    ),
    'invitationLeadDays', 3
  ),
  '{"fields":[]}'::jsonb,
  true,
  165
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  updated_at = now();

-- ============================================================
-- 2. AML § 14-9 — drøfting midlertidige tilsettinger
-- ============================================================
insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_confidentiality_level,
  minimum_employee_count, definition, metadata_schema, is_active, sort_order
) values (
  'drofting-midlertidige-tilsettinger',
  'drofting-midlertidige-tilsettinger',
  'Drøfting — midlertidige tilsettinger (§ 14-9)',
  'AML § 14-9 (1) andre punktum: arbeidsgiver skal minst en gang per år drøfte bruken av midlertidige tilsettinger med tillitsvalgte. Egen mal — ikke kollektiv drøfting (§ 15-1), ikke MUS.',
  'AML',
  array['AML', 'Hovedavtalen'],
  array['AML § 14-9', 'AML § 14-9 (1)', 'Hovedavtalen kap. II'],
  'annual',
  60,
  'standard',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'omfang',
        'title', 'Omfang av midlertidige tilsettinger siste 12 måneder',
        'lawRef', 'AML § 14-9 (1)',
        'description', 'Antall midlertidige stillinger, hjemmel for hvert (vikariat, prosjekt, sesong, første gang ansatt), gjennomsnittlig varighet.',
        'dataBinding', jsonb_build_object(
          'source', 'headcount_and_amu_composition',
          'window', 'last_year',
          'presentation', 'table'
        ),
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'begrunnelse',
        'title', 'Begrunnelse for bruk per type tilsetting',
        'lawRef', 'AML § 14-9 (1)',
        'description', 'Gjennomgang av hvilke hjemler i § 14-9 (1) a–f som er brukt, og om alternativene (fast tilsetting, omplassering) er vurdert.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'overgang_fast',
        'title', 'Overgang til fast tilsetting — § 14-9 (7) regelen',
        'lawRef', 'AML § 14-9 (7)',
        'description', 'Ansatte som har vært midlertidig tilsatt sammenhengende i mer enn 3 (eller 4) år har krav på fast tilsetting. Status per ansatt.',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'tillitsvalgte_synspunkt',
        'title', 'Tillitsvalgtes synspunkt',
        'lawRef', 'Hovedavtalen kap. II',
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'tiltak_neste_ar',
        'title', 'Tiltak / endringer for neste år',
        'isMandatory', false,
        'recommended', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 5
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'employer_rep'),
      jsonb_build_object('role', 'tillitsvalgt')
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'midlertidige_liste',
        'label', 'Oversikt over alle midlertidige tilsettinger klar',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'hjemmel_per_stilling',
        'label', 'Hjemmel (§ 14-9 1.a-f) dokumentert per stilling',
        'isMandatory', true
      )
    ),
    'invitationLeadDays', 7
  ),
  '{"fields":[]}'::jsonb,
  true,
  170
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  law_refs = excluded.law_refs,
  definition = excluded.definition,
  updated_at = now();

-- ============================================================
-- 3a. Folketrygdloven § 25-2 — dialogmøte 1 (uke 7)
-- ============================================================
insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_confidentiality_level,
  minimum_employee_count, definition, metadata_schema, is_active, sort_order
) values (
  'dialogmote-1-uke-7',
  'dialogmote-1-uke-7',
  'Dialogmøte 1 — uke 7 (Folketrygdloven § 25-2)',
  'Lovpålagt dialogmøte mellom arbeidsgiver, ansatt og (etter samtykke) sykmelder/BHT. Skal avholdes senest uke 7 av sykefravær. Tema: funksjon, tilretteleggingsmuligheter, oppdatert oppfølgingsplan. Konfidensielt.',
  'AML',
  array['AML', 'INTERNAL'],
  array['Folketrygdloven § 25-2', 'AML § 4-6 (4)'],
  'ad_hoc',
  60,
  'confidential',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'status_sykefravar',
        'title', 'Status — sykmeldingsperiode og funksjonsendringer',
        'lawRef', 'Folketrygdloven § 25-2',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'oppfolgingsplan_oppdatering',
        'title', 'Oppdatering av oppfølgingsplan (§ 4-6)',
        'lawRef', 'AML § 4-6 (3)',
        'description', 'Plan skal være laget innen uke 4, oppdatert senest i dette møtet. Send signert kopi til sykmelder.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'tilrettelegging_drofting',
        'title', 'Drøfting av tilretteleggingsmuligheter',
        'lawRef', 'AML § 4-6 (1)',
        'description', 'Konkrete tiltak: endring av oppgaver, arbeidstid, hjelpemidler, hjemmekontor, gradvis tilbakeføring.',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'bht_sykmelder',
        'title', 'BHT/sykmelder-rolle videre',
        'description', 'Vurder om BHT eller sykmelder bør delta i neste dialogmøte.',
        'isMandatory', false,
        'recommended', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'neste_steg',
        'title', 'Neste evalueringspunkt — innen uke 26',
        'lawRef', 'Folketrygdloven § 25-2',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 10
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'member', 'count', 1)
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'sykmelder_invitert',
        'label', 'Sykmelder/lege er forespurt om deltakelse (med ansatts samtykke)',
        'lawRef', 'Folketrygdloven § 25-2',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'oppfolgingsplan_forberedt',
        'label', 'Forrige oppfølgingsplan medbrakt',
        'isMandatory', true
      )
    ),
    'invitationLeadDays', 7
  ),
  '{"fields":[]}'::jsonb,
  true,
  180
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  updated_at = now();

-- ============================================================
-- 3b. Folketrygdloven § 25-2 — dialogmøte 2 (uke 26, NAV-medvirkning)
-- ============================================================
insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_confidentiality_level,
  minimum_employee_count, definition, metadata_schema, is_active, sort_order
) values (
  'dialogmote-2-uke-26',
  'dialogmote-2-uke-26',
  'Dialogmøte 2 — uke 26 (NAV-arrangert)',
  'Dialogmøte 2 arrangeres normalt av NAV ved sykefravær over 26 uker, men kan også innkalles av arbeidsgiver. NAV-veileder, ansatt, leder og evt. sykmelder deltar. Tema: arbeidsutprøving, arbeidsrettede tiltak, omplassering, AAP.',
  'AML',
  array['AML', 'INTERNAL'],
  array['Folketrygdloven § 25-2', 'AML § 4-6', 'Folketrygdloven § 8-7a'],
  'ad_hoc',
  90,
  'confidential',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'status_etter_d1',
        'title', 'Status siden dialogmøte 1',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'arbeidsutproving',
        'title', 'Arbeidsutprøving — muligheter og hindringer',
        'lawRef', 'AML § 4-6',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'arbeidsrettede_tiltak',
        'title', 'Arbeidsrettede tiltak (NAV)',
        'lawRef', 'Folketrygdloven § 8-7a',
        'description', 'Veiledning, opplæring, hjelpemidler, ev. AAP-vurdering.',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'omplassering',
        'title', 'Omplassering / annen stilling vurdert',
        'lawRef', 'AML § 4-6 (1)',
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'oppfolgingsplan_oppdatering',
        'title', 'Oppdatert oppfølgingsplan',
        'lawRef', 'AML § 4-6 (3)',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'dialogmote_3',
        'title', 'Behov for dialogmøte 3 (NAV-innkalt)',
        'isMandatory', false,
        'recommended', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 5
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'member', 'count', 1),
      jsonb_build_object('role', 'guest', 'count', 1)
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'nav_invitert',
        'label', 'NAV-veileder invitert (deltar normalt)',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'oppfolgingsplan_med',
        'label', 'Oppdatert oppfølgingsplan tilgjengelig',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'sykmelder_invitert',
        'label', 'Sykmelder forespurt om deltakelse',
        'isMandatory', false
      )
    ),
    'invitationLeadDays', 7
  ),
  '{"fields":[]}'::jsonb,
  true,
  185
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  updated_at = now();

-- ============================================================
-- 3c. Folketrygdloven § 25-2 — dialogmøte 3 (etter behov, NAV-innkalt)
-- ============================================================
insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_confidentiality_level,
  minimum_employee_count, definition, metadata_schema, is_active, sort_order
) values (
  'dialogmote-3-nav-innkalt',
  'dialogmote-3-nav-innkalt',
  'Dialogmøte 3 — etter behov (NAV-innkalt)',
  'Dialogmøte 3 innkalles av NAV ved særlig komplekse saker, typisk etter uke 39. Alle parter og NAV deltar. Tema: realitetsavklaring av arbeidsevne, AAP, uføretrygd, omskolering.',
  'AML',
  array['AML', 'INTERNAL'],
  array['Folketrygdloven § 25-2', 'Folketrygdloven § 11-5'],
  'ad_hoc',
  90,
  'confidential',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'status_full',
        'title', 'Full statusoversikt — sykefravær, oppfølgingsplan, alle tiltak',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'arbeidsevne_avklaring',
        'title', 'Realitetsavklaring — arbeidsevne på sikt',
        'lawRef', 'Folketrygdloven § 11-5',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 25
      ),
      jsonb_build_object(
        'key', 'aap_omskolering',
        'title', 'AAP / omskolering / uføretrygd vurdert',
        'lawRef', 'Folketrygdloven § 11-5',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'oppsigelsesvern',
        'title', 'Oppsigelsesvern (§ 15-8) — informasjon til partene',
        'lawRef', 'AML § 15-8',
        'description', 'AML § 15-8: vern mot oppsigelse under sykefravær opphører normalt etter 12 måneder. Husk å informere ansatt før beslutning tas.',
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'beslutning',
        'title', 'Beslutning om videre prosess',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 10
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'member', 'count', 1),
      jsonb_build_object('role', 'guest', 'count', 1)
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'nav_innkalt',
        'label', 'NAV har innkalt eller godkjent møtet',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'all_dokumentasjon',
        'label', 'All oppfølgingsdokumentasjon medbrakt',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'oppsigelsesvern_kjent',
        'label', 'Oppsigelsesvern-status (§ 15-8) avklart med HR',
        'lawRef', 'AML § 15-8',
        'isMandatory', true
      )
    ),
    'invitationLeadDays', 7
  ),
  '{"fields":[]}'::jsonb,
  true,
  190
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  updated_at = now();
