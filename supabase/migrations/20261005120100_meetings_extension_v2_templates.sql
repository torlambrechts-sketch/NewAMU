-- Meetings — research-report extension v2: 11 new system templates.
--
-- Closes the template-coverage gap identified in Research_Report.md
-- (Norwegian compliance meeting module specification). The original
-- seed shipped 18 templates + 5 compliance-gap follow-ups (total 23,
-- of which 4 are dialogmøter); this migration adds the remaining
-- statutory meeting types the research report enumerates:
--
--   1. styremote-as                          — Aksjeloven § 6-19 ff
--   2. generalforsamling-ordinaer            — Aksjeloven kap. 5
--   3. bedriftsforsamling                    — Aksjeloven § 6-35
--   4. kontaktmote-tillitsvalgte-styret      — Hovedavtalen § 9-13
--   5. forhandlingsmote-lonn                 — Hovedavtalen kap. 3-6 + Arbtv § 16
--   6. akan-oppfolgingsmote                  — AKAN-modellen + GDPR art. 9
--   7. vernerunde                            — AML § 6-2 + Forskriften § 2-2
--   8. drofting-15-1-individuell             — AML § 15-1 (individuell oppsigelse)
--   9. drofting-15-2-masseoppsigelse         — AML § 15-2 + EU-direktiv 98/59
--  10. drofting-10-3-arbeidsplan             — AML §§ 10-3 / 10-5 / 10-6 / 10-8
--  11. drofting-8-1-informasjon              — AML § 8-1 ff (≥ 50 ansatte)
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * Aksjeloven § 6-19 styremøte + § 6-29 protokoll + § 6-25 voting
--     med 1/3-gulv — voting_model = aksje_simple_majority_one_third_floor
--     på vedtaksaker. Dissens-protokollføring som obligatorisk agenda-punkt.
--     reportingObligations: Foretaksregisteret-melding ved bestemte vedtak.
--   * Aksjeloven § 5-17 ff generalforsamling — voting_model = weighted (simple);
--     vedtektsendring lar admin sette qualified manuelt. Aksjeeierbok-vedlikehold
--     som preparationChecklist.
--   * Hovedavtalen § 9-13 kontaktmøte — sjelden brukt, men nødvendig for
--     orgs med ansatterep. i styret.
--   * AML § 15-1 individuell drøftelse — separat fra drofting-omstilling
--     fordi sosiale forhold + utvelgelseskriterier er individuelle, ikke
--     kollektive. confidential as default + dataBinding: ingen.
--   * AML § 15-2 masseoppsigelse — 8-punkts skriftlig informasjon er
--     kodet som 8 isMandatory:true agenda-items (grunner, antall, gruppe,
--     kriterier, sluttvederlag, periode, NAV-tiltak, andre kriterier).
--     reportingObligations: NAV-melding + Arbeidstilsynet-kopi + 30-dagers
--     suspensiv frist.
--   * AML § 10-3 arbeidsplan/turnus — drøfting "senest 2 uker før
--     iverksettelse" → invitationLeadDays = 14.
--   * AML § 8-1 løpende informasjon — kvartalsvis, ≥ 50 ansatte. Til-
--     visningsbar i compliance-gap-analysen via minimum_employee_count = 50.
--   * AKAN-modellen — default_confidentiality_level = 'akan' (separat
--     perimeter; meetings.view_akan kreves). Helsepersonelloven § 21 +
--     GDPR art. 9.
--   * AML § 6-2 vernerunde — fysisk befaring (distinkt fra verneombud-
--     mote). dataBinding: incidents (siste halvår) på avvikspunktet.
--
-- Re-framing of existing dialogmøter:
--   The three existing dialogmøte-templates were tagged framework='AML'
--   even though their primary basis is folketrygdloven § 8-7a/§ 25-2.
--   Patched: framework -> 'Folketrygdloven', AML kept as secondary.
--
-- Restrisiko (acknowledged, deferred to follow-up):
--   * BankID legally-binding signature — protokoll-signering forblir
--     "Bekreftelse (forhåndsregistrering)" inntil Signicat-integrasjonen er klar.
--   * Aksjeloven § 6-29 (signatur av alle deltakende vs. 2 valgte ved ≥ 5
--     medlemmer) — UI-en surfacer regelen men håndhever ikke valg-flowen
--     i v1; styresekretæren styrer hvem som signerer.
--   * Hemmelig stemmesedling for vedtak i generalforsamling
--     (aksjeloven § 5-12 (5)) — ikke håndhevet i v1; voting_model
--     = 'anonymous' kan brukes.
--
-- Idempotent. Re-applying upserts only the columns we own; admin-side
-- override fields on `meeting_org_template_settings` are untouched.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Styremøte (AS) — Aksjeloven § 6-19 ff                                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'styremote-as',
  'styremote-as',
  'Styremøte (AS)',
  'Ordinært styremøte i aksjeselskap. Vedtaksført ved > 1/2 deltakelse (§ 6-24); '
  'simpelt flertall blant møtende OG > 1/3 av samtlige styremedlemmer (§ 6-25). '
  'Protokoll signeres av alle møtende, eller av 2 valgte ved ≥ 5 medlemmer (§ 6-29). '
  'Oppbevares hele selskapets levetid (§ 1-6).',
  'Aksjeloven',
  array['Aksjeloven'],
  array['Aksjeloven § 6-19', 'Aksjeloven § 6-20', 'Aksjeloven § 6-22',
        'Aksjeloven § 6-24', 'Aksjeloven § 6-25', 'Aksjeloven § 6-29',
        'Aksjeloven § 1-6'],
  'ad_hoc',
  120,
  'aksjelov',
  'standard',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'approval',
        'title', 'Godkjenning av innkalling og protokoll fra forrige styremøte',
        'lawRef', 'Aksjeloven § 6-29',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'daglig_leder_rapport',
        'title', 'Daglig leders statusrapport',
        'lawRef', 'Aksjeloven § 6-15',
        'description', 'Drift, økonomi, vesentlige hendelser siden forrige styremøte. Daglig leder har møterett og talerett (§ 6-19 (4)) men ikke stemmerett.',
        'dataBinding', jsonb_build_object(
          'source', 'open_decisions',
          'window', 'current',
          'presentation', 'table'
        ),
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'okonomi',
        'title', 'Økonomi — månedsregnskap og budsjettavvik',
        'lawRef', 'Aksjeloven § 6-12 (3)',
        'description', 'Styret skal holde seg orientert om selskapets økonomiske stilling og forsvarlig egenkapital.',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'strategi',
        'title', 'Strategiske saker',
        'lawRef', 'Aksjeloven § 6-12 (2)',
        'description', 'Styrets ansvar for selskapets strategi og overordnede ledelse.',
        'isMandatory', false,
        'defaultPosition', 40,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'risikostyring',
        'title', 'Risikostyring og internkontroll',
        'lawRef', 'Aksjeloven § 6-13 (3)',
        'description', 'Styrets ansvar for å føre tilsyn med selskapets virksomhet, herunder risikostyring.',
        'isMandatory', true,
        'defaultPosition', 45,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'vedtaksaker',
        'title', 'Vedtakssaker',
        'lawRef', 'Aksjeloven § 6-25',
        'description', 'Saker som krever styrevedtak. Voteringsregel: flertall blant møtende OG > 1/3 av samtlige styremedlemmer.',
        'voteRequired', true,
        'voting_model', 'aksje_simple_majority_one_third_floor',
        'isMandatory', false,
        'defaultPosition', 50,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'dissens_protokollforing',
        'title', 'Protokollføring av dissens',
        'lawRef', 'Aksjeloven § 6-29 (2)',
        'description', 'Styremedlem og daglig leder som er uenig i en beslutning, kan kreve sin oppfatning innført i protokollen. Skal alltid sjekkes før møtet avsluttes.',
        'isMandatory', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'eventuelt',
        'title', 'Eventuelt',
        'isMandatory', false,
        'defaultPosition', 90,
        'defaultDurationMinutes', 10
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'member'),
      jsonb_build_object('role', 'observer', 'count', 1)
    ),
    'minimumQuorum', jsonb_build_object('kind', 'percent', 'value', 50),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'innkalling_sendt',
        'label', 'Innkalling sendt med nødvendig frist (§ 6-22)',
        'isMandatory', true,
        'lawRef', 'Aksjeloven § 6-22'
      ),
      jsonb_build_object(
        'key', 'saksdokumenter',
        'label', 'Saksdokumenter sendt med innkallingen',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'styreinstruks',
        'label', 'Gjeldende styreinstruks er kjent for alle medlemmer (§ 6-23)',
        'isMandatory', false,
        'lawRef', 'Aksjeloven § 6-23'
      ),
      jsonb_build_object(
        'key', 'inhabilitet',
        'label', 'Inhabilitets-vurdering gjort per sak (§ 6-27)',
        'isMandatory', true,
        'lawRef', 'Aksjeloven § 6-27'
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 7,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'foretaksregisteret_vedtak',
        'obligation_label', 'Foretaksregisteret-melding ved vedtak som krever det (utbytte, kapitalendring, vedtektsendring)',
        'recipient', 'Foretaksregisteret',
        'law_ref', 'Aksjeloven § 4-26 / Foretaksregisterloven',
        'due_offset_days', 30
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'location', 'kind', 'location', 'label', 'Møtested', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Styremedlemmer', 'required', true)
    )
  ),
  true,
  200
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  cadence_hint = excluded.cadence_hint,
  default_duration_minutes = excluded.default_duration_minutes,
  default_category_slug = excluded.default_category_slug,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Generalforsamling — Aksjeloven kap. 5                                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'generalforsamling-ordinaer',
  'generalforsamling-ordinaer',
  'Generalforsamling — ordinær (AS)',
  'Ordinær generalforsamling skal holdes innen 6 måneder etter regnskapsårets slutt (§ 5-5). '
  'Aksjeveid stemming etter § 5-17 (simpelt flertall); vedtektsendring krever 2/3 (§ 5-18). '
  'Protokoll undertegnes av møteleder og minst én aksjeeier (§ 5-16). Oppbevares i selskapets levetid (§ 1-6).',
  'Aksjeloven',
  array['Aksjeloven'],
  array['Aksjeloven § 5-5', 'Aksjeloven § 5-7a', 'Aksjeloven § 5-11',
        'Aksjeloven § 5-13', 'Aksjeloven § 5-16', 'Aksjeloven § 5-17',
        'Aksjeloven § 5-18', 'Aksjeloven § 5-20'],
  'annual',
  90,
  'aksjelov',
  'standard',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'apning',
        'title', 'Åpning av møtet, registrering av aksjeeiere og fullmakter',
        'lawRef', 'Aksjeloven § 5-13',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'valg_moteleder',
        'title', 'Valg av møteleder',
        'lawRef', 'Aksjeloven § 5-12 (2)',
        'isMandatory', true,
        'defaultPosition', 15,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'godkjenning_innkalling',
        'title', 'Godkjenning av innkalling og dagsorden',
        'lawRef', 'Aksjeloven § 5-10',
        'voteRequired', true,
        'voting_model', 'weighted',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'arsregnskap',
        'title', 'Godkjenning av årsregnskap, årsberetning og revisjonsberetning',
        'lawRef', 'Aksjeloven § 5-5 (2) nr. 1',
        'description', 'Behandling og godkjenning av årsregnskap og årsberetning, herunder utdeling av utbytte.',
        'voteRequired', true,
        'voting_model', 'weighted',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'utbytte',
        'title', 'Beslutning om utbytte',
        'lawRef', 'Aksjeloven § 8-2',
        'description', 'Utbytte kan kun deles ut innenfor de rammer aksjeloven § 8-1 setter (utdelbar egenkapital).',
        'voteRequired', true,
        'voting_model', 'weighted',
        'isMandatory', false,
        'defaultPosition', 35,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'valg_styre',
        'title', 'Valg av styremedlemmer og revisor',
        'lawRef', 'Aksjeloven § 5-5 (2) nr. 2-3',
        'voteRequired', true,
        'voting_model', 'weighted',
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'godtgjorelse',
        'title', 'Godtgjørelse til styret og revisor',
        'lawRef', 'Aksjeloven § 5-5 (2) nr. 4',
        'voteRequired', true,
        'voting_model', 'weighted',
        'isMandatory', false,
        'defaultPosition', 50,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'vedtektsendring',
        'title', 'Eventuell vedtektsendring (krever 2/3 flertall)',
        'lawRef', 'Aksjeloven § 5-18',
        'description', 'Endring av vedtektene krever tilslutning fra minst to tredeler så vel av de avgitte stemmer som av den aksjekapital som er representert på generalforsamlingen.',
        'voteRequired', true,
        'voting_model', 'qualified',
        'isMandatory', false,
        'defaultPosition', 60,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'protokoll_undertegning',
        'title', 'Protokoll undertegnes av møteleder + minst én aksjeeier',
        'lawRef', 'Aksjeloven § 5-16',
        'isMandatory', true,
        'defaultPosition', 90,
        'defaultDurationMinutes', 5
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'member'),
      jsonb_build_object('role', 'observer')
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'aksjeeierbok',
        'label', 'Aksjeeierboken er oppdatert og tilgjengelig (§ 4-5)',
        'isMandatory', true,
        'lawRef', 'Aksjeloven § 4-5'
      ),
      jsonb_build_object(
        'key', 'innkalling_2uker',
        'label', 'Innkalling sendt senest 1 uke før generalforsamling (§ 5-10)',
        'isMandatory', true,
        'lawRef', 'Aksjeloven § 5-10'
      ),
      jsonb_build_object(
        'key', 'arsdokumenter',
        'label', 'Årsregnskap, årsberetning og revisjonsberetning vedlagt',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'fullmakter',
        'label', 'Fullmakter og forhåndsstemmer mottatt og verifisert',
        'isMandatory', false
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 14,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'foretaksregisteret_arsregnskap',
        'obligation_label', 'Foretaksregisteret-melding av årsregnskap og styreendringer',
        'recipient', 'Foretaksregisteret',
        'law_ref', 'Regnskapsloven § 8-2 / Foretaksregisterloven',
        'due_offset_days', 30
      ),
      jsonb_build_object(
        'obligation_key', 'aksjeeierbok_oppdatert',
        'obligation_label', 'Aksjeeierboken oppdateres etter aksje-/eier-endringer',
        'recipient', 'intern',
        'law_ref', 'Aksjeloven § 4-5',
        'due_offset_days', 7
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'location', 'kind', 'location', 'label', 'Møtested', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Aksjeeiere / fullmektige', 'required', true)
    )
  ),
  true,
  210
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  cadence_hint = excluded.cadence_hint,
  default_duration_minutes = excluded.default_duration_minutes,
  default_category_slug = excluded.default_category_slug,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Bedriftsforsamlingsmøte — Aksjeloven § 6-35                           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'bedriftsforsamling',
  'bedriftsforsamling',
  'Bedriftsforsamlingsmøte',
  'Selskap med ≥ 200 ansatte skal ha bedriftsforsamling med mindre annet er avtalt (§ 6-35). '
  'Bedriftsforsamlingen velger styret, behandler styrets forslag i saker som gjelder investeringer av betydelig omfang og rasjonalisering / omlegging som vil medføre større endringer eller omdisponeringer av arbeidsstyrken.',
  'Aksjeloven',
  array['Aksjeloven', 'Hovedavtalen'],
  array['Aksjeloven § 6-35', 'Aksjeloven § 6-36', 'Aksjeloven § 6-37'],
  'semiannual',
  120,
  'aksjelov',
  'standard',
  200,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'apning',
        'title', 'Åpning og konstituering',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'styre_orientering',
        'title', 'Styrets orientering om selskapets virksomhet og resultater',
        'lawRef', 'Aksjeloven § 6-37 (1)',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 30
      ),
      jsonb_build_object(
        'key', 'investeringer',
        'title', 'Investeringer av betydelig omfang — behandling',
        'lawRef', 'Aksjeloven § 6-37 (3) nr. 1',
        'voteRequired', true,
        'voting_model', 'simple',
        'isMandatory', false,
        'defaultPosition', 30,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'rasjonalisering',
        'title', 'Rasjonalisering eller omlegging med større endringer i arbeidsstyrken',
        'lawRef', 'Aksjeloven § 6-37 (3) nr. 2',
        'description', 'Bedriftsforsamlingen skal behandle styrets forslag som gjelder endringer som vil medføre større omdisponeringer av arbeidsstyrken. Det er ansatterepresentantenes hovedansvarlige sak.',
        'voteRequired', true,
        'voting_model', 'simple',
        'isMandatory', false,
        'defaultPosition', 40,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'valg_styre',
        'title', 'Valg av styremedlemmer',
        'lawRef', 'Aksjeloven § 6-37 (4)',
        'voteRequired', true,
        'voting_model', 'simple',
        'isMandatory', false,
        'defaultPosition', 50,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'eventuelt',
        'title', 'Eventuelt',
        'isMandatory', false,
        'defaultPosition', 90,
        'defaultDurationMinutes', 10
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'employer_rep'),
      jsonb_build_object('role', 'employee_rep')
    ),
    'minimumQuorum', jsonb_build_object('kind', 'percent', 'value', 50),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'sammensetning_2_3_1_3',
        'label', '2/3 aksjeeier-rep + 1/3 ansatte-rep (sammensetning § 6-35 (2))',
        'isMandatory', true,
        'lawRef', 'Aksjeloven § 6-35 (2)'
      ),
      jsonb_build_object(
        'key', 'innkalling',
        'label', 'Innkalling sendt med nødvendig frist',
        'isMandatory', true
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 7
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'location', 'kind', 'location', 'label', 'Møtested', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Bedriftsforsamlingsmedlemmer', 'required', true)
    )
  ),
  true,
  220
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  minimum_employee_count = excluded.minimum_employee_count,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. Kontaktmøte tillitsvalgte ↔ styret — Hovedavtalen § 9-13              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'kontaktmote-tillitsvalgte-styret',
  'kontaktmote-tillitsvalgte-styret',
  'Kontaktmøte tillitsvalgte ↔ styret',
  'Kontaktmøte mellom tillitsvalgte og styret etter Hovedavtalen NHO-LO § 9-13. '
  'Holdes på krav fra tillitsvalgte. Referat undertegnes av partene. '
  'Tvister om informasjons- og drøftingsplikt kan løftes til Hovedavtaleutvalget.',
  'Hovedavtalen',
  array['Hovedavtalen', 'AML'],
  array['Hovedavtalen NHO-LO § 9-13', 'AML § 8-1', 'AML § 8-2'],
  'semiannual',
  90,
  'aml-drofting',
  'restricted',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'apning_referat',
        'title', 'Åpning og godkjenning av referat fra forrige kontaktmøte',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'orientering_styret',
        'title', 'Orientering fra styret om strategi og økonomi',
        'lawRef', 'Hovedavtalen § 9-13',
        'description', 'Styret skal orientere om bedriftens utvikling, økonomi og virksomhetsplan.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 25
      ),
      jsonb_build_object(
        'key', 'tillitsvalgte_innspill',
        'title', 'Tillitsvalgtes innspill — saker reist av de ansatte',
        'lawRef', 'Hovedavtalen § 9-13',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 25
      ),
      jsonb_build_object(
        'key', 'samarbeid',
        'title', 'Samarbeid og partssammensatt arbeid (AMU / bedriftsutvalg)',
        'isMandatory', false,
        'recommended', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'eventuelt',
        'title', 'Eventuelt',
        'isMandatory', false,
        'defaultPosition', 90,
        'defaultDurationMinutes', 10
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'employer_rep'),
      jsonb_build_object('role', 'tillitsvalgt')
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'krav_fra_tv',
        'label', 'Krav fra tillitsvalgte (Hovedavtalen § 9-13 — møtet holdes på deres krav)',
        'isMandatory', true,
        'lawRef', 'Hovedavtalen § 9-13'
      ),
      jsonb_build_object(
        'key', 'saksdokumenter',
        'label', 'Bakgrunnsdokumenter sendt til tillitsvalgte før møtet',
        'isMandatory', true
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 7,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'referat_signert_av_partene',
        'obligation_label', 'Referat undertegnet av begge parter (arbeidsgiver + tillitsvalgte)',
        'recipient', 'intern',
        'law_ref', 'Hovedavtalen § 9-13',
        'due_offset_days', 14
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'location', 'kind', 'location', 'label', 'Møtested', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Deltakere (tillitsvalgte + styre/ledelse)', 'required', true)
    )
  ),
  true,
  230
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. Forhandlingsmøte — lokal lønn — Hovedavtalen kap. 3                   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'forhandlingsmote-lonn',
  'forhandlingsmote-lonn',
  'Forhandlingsmøte — lokal lønn',
  'Lokale lønnsforhandlinger mellom arbeidsgiver og tillitsvalgte. Forhandlingsprotokoll undertegnes av begge parter med krav, forhandlet utfall og enighet/uenighet. '
  'Ved uenighet løftes saken til organisasjonsnivå (Hovedavtalens § 2-3). Plassoppsigelse etter arbeidstvistloven § 16.',
  'Hovedavtalen',
  array['Hovedavtalen', 'Arbeidstvistloven'],
  array['Hovedavtalen NHO-LO § 3-1', 'Hovedavtalen NHO-LO § 3-3',
        'Hovedavtalen NHO-LO § 3-6', 'Hovedavtalen NHO-LO § 2-3',
        'Arbeidstvistloven § 16'],
  'annual',
  120,
  'aml-drofting',
  'restricted',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'apning',
        'title', 'Åpning og godkjenning av forhandlingsmandat',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'krav_arbeidstaker',
        'title', 'Arbeidstakersidens krav',
        'lawRef', 'Hovedavtalen § 3-3',
        'description', 'Tillitsvalgtes lønnskrav for perioden, med begrunnelse (kostnadsutvikling, sammenligning med tariffområdet, særlige forhold).',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 25
      ),
      jsonb_build_object(
        'key', 'tilbud_arbeidsgiver',
        'title', 'Arbeidsgiversidens tilbud',
        'lawRef', 'Hovedavtalen § 3-3',
        'description', 'Arbeidsgivers tilbud med begrunnelse (bedriftsøkonomisk situasjon, lønnsevne, konkurransesituasjon).',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 25
      ),
      jsonb_build_object(
        'key', 'drøftinger',
        'title', 'Drøftinger og kompromissforslag',
        'voteRequired', true,
        'voting_model', 'consensus',
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 40
      ),
      jsonb_build_object(
        'key', 'resultat',
        'title', 'Forhandlingsresultat — enighet eller uenighet',
        'lawRef', 'Hovedavtalen § 3-6',
        'description', 'Ved enighet: prosentvis ramme, individuell fordeling, virkningstidspunkt. Ved uenighet: konkret beskrivelse av tvistepunktene.',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'protokoll_signering',
        'title', 'Underskrift av forhandlingsprotokoll',
        'lawRef', 'Hovedavtalen § 3-6',
        'isMandatory', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 5
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'employer_rep'),
      jsonb_build_object('role', 'tillitsvalgt')
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'lonnsstatistikk',
        'label', 'Lønnsstatistikk for bransjen tilgjengelig',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'okonomi_grunnlag',
        'label', 'Bedriftens økonomiske grunnlag dokumentert',
        'isMandatory', true,
        'lawRef', 'Hovedavtalen § 3-1'
      ),
      jsonb_build_object(
        'key', 'mandat',
        'label', 'Forhandlingsmandat avklart med ledelsen / styret',
        'isMandatory', true
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 5,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'protokoll_signert_begge_parter',
        'obligation_label', 'Forhandlingsprotokoll signert av begge parter',
        'recipient', 'intern',
        'law_ref', 'Hovedavtalen § 3-6',
        'due_offset_days', 7
      ),
      jsonb_build_object(
        'obligation_key', 'organisasjonsniva_ved_uenighet',
        'obligation_label', 'Ved uenighet: løft saken til organisasjonsnivå (Hovedavtalens § 2-3)',
        'recipient', 'Hovedavtaleutvalget',
        'law_ref', 'Hovedavtalen § 2-3',
        'due_offset_days', 14
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'location', 'kind', 'location', 'label', 'Møtested', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Forhandlingsdelegasjoner', 'required', true)
    )
  ),
  true,
  240
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 6. AKAN-oppfølgingsmøte — AKAN-modellen + GDPR art. 9                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'akan-oppfolgingsmote',
  'akan-oppfolgingsmote',
  'AKAN-oppfølgingsmøte',
  'Individuell oppfølging av ansatt etter AKAN-modellen (rusmiddelproblemer, spilleavhengighet). '
  'STRENG TAUSHETSPLIKT (helsepersonelloven § 21). AKAN-perimeter — separat fra øvrige konfidensielle møter. '
  'Krever permission meetings.view_akan. Per individuell AKAN-avtale (typisk 2 år), månedlig i startfasen, sjeldnere senere.',
  'AKAN-modellen',
  array['AKAN-modellen', 'AML', 'GDPR'],
  array['AML § 4-1', 'AKAN-modellen', 'helsepersonelloven § 21',
        'GDPR Art. 6 (1) (b)', 'GDPR Art. 9 (2) (h)'],
  'ad_hoc',
  45,
  'personal',
  'akan',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'velkomst_taushetsplikt',
        'title', 'Velkomst og bekreftelse av taushetsplikt for alle tilstedeværende',
        'lawRef', 'helsepersonelloven § 21',
        'description', 'AKAN-kontaktens og BHTs taushetsplikt er den strengeste i norsk arbeidsliv. Bekreftes muntlig av alle ved møtets åpning.',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'status_siste_periode',
        'title', 'Status siden forrige oppfølgingsmøte',
        'description', 'Ansattes egen vurdering: arbeid, helse, behandlingsforløp. Ikke diagnoser i protokoll — kun funksjonsnivå og status på AKAN-avtalens vilkår.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'arbeidsgivers_observasjoner',
        'title', 'Arbeidsgivers observasjoner — oppmøte, ytelse, sikkerhet',
        'description', 'Konkret, faktabasert (ikke vurderende). Sikkerhets-kritisk arbeid prioriteres.',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'bht_innspill',
        'title', 'BHT / fastleges innspill (om tilstede)',
        'description', 'BHT kan gi medisinsk-faglig vurdering uten å oppgi diagnose. Fastleges innspill kun med ansattes samtykke.',
        'isMandatory', false,
        'defaultPosition', 40,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'avtale_vilkar',
        'title', 'Gjennomgang av AKAN-avtalens vilkår — overholdes de?',
        'description', 'Punktvis: behandling, kontrollprøver, oppmøte, sikkerhet. Konsekvenser ved brudd må være forhåndsdefinerte.',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'tilrettelegging',
        'title', 'Tilrettelegging og videre plan',
        'lawRef', 'AML § 4-6',
        'description', 'Konkrete tilretteleggingstiltak (oppgaver, arbeidstid, sikkerhet), neste oppfølgingsmøte, evaluering av avtalen.',
        'isMandatory', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 10
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'member', 'count', 1)
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'avtale_dokumentert',
        'label', 'AKAN-avtalen er signert og tilgjengelig',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'forrige_referat',
        'label', 'Referat fra forrige oppfølgingsmøte gjennomgått',
        'isMandatory', false
      ),
      jsonb_build_object(
        'key', 'samtykke_bht_fastlege',
        'label', 'Eventuelt samtykke til BHT/fastlege-deltakelse innhentet skriftlig',
        'isMandatory', false,
        'lawRef', 'helsepersonelloven § 21'
      )
    ),
    'protocolRoles', jsonb_build_array('chair'),
    'invitationLeadDays', 3
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'AKAN-kontakt + ansatt + ev. BHT', 'required', true)
    )
  ),
  true,
  250
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 7. Vernerunde (befaring) — AML § 6-2 + Forskriften § 2-2                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'vernerunde',
  'vernerunde',
  'Vernerunde (befaring)',
  'Fysisk vernerunde / arbeidsmiljøbefaring. Verneombud + arbeidsgiverrepresentant går igjennom arbeidsplassen for å kartlegge fysisk, ergonomisk og psykososialt arbeidsmiljø. '
  'Egen mal — distinkt fra verneombudsmøtet (som er internt blant verneombudene). Rapport vedlegges AMU-saksliste neste kvartal.',
  'AML',
  array['AML', 'IK-f'],
  array['AML § 6-2', 'AML § 4-1', 'Forskrift om org. ledelse § 2-2', 'IK-f § 5 nr. 1'],
  'semiannual',
  90,
  'aml-amu',
  'standard',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'apning_omfang',
        'title', 'Åpning — verneområdets omfang og rute',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'fysisk_arbeidsplass',
        'title', 'Fysisk arbeidsplass — lys, luft, temperatur, støy, ryddighet',
        'lawRef', 'AML § 4-4',
        'description', 'Sjekkpunkter: belysning, ventilasjon, romtemperatur, støynivå, fri ferdsel, branntekniske krav.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'ergonomi',
        'title', 'Ergonomi — arbeidsstillinger og hjelpemidler',
        'lawRef', 'AML § 4-4 (2)',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'kjemikalier_verneutstyr',
        'title', 'Kjemikalier, eksponering og verneutstyr',
        'lawRef', 'Forskrift om utførelse av arbeid kap. 3',
        'description', 'Kjemikalieregister oppdatert, sikkerhetsdatablader tilgjengelige, verneutstyr i orden.',
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'psykososialt',
        'title', 'Psykososialt arbeidsmiljø — observasjoner og samtaler',
        'lawRef', 'AML § 4-3',
        'description', 'Verneombudet intervjuer ansatte under befaringen (anonymisert i rapporten).',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'oppfolging_avvik',
        'title', 'Oppfølging av tidligere avvik og hendelser',
        'lawRef', 'IK-f § 5 nr. 7',
        'dataBinding', jsonb_build_object(
          'source', 'incidents',
          'window', 'last_half_year',
          'presentation', 'table'
        ),
        'isMandatory', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'nye_funn_tiltak',
        'title', 'Nye funn og foreslåtte tiltak',
        'description', 'Hver observasjon får en action_item med ansvarlig og frist. Loftes til AMU ved alvorlig avvik.',
        'isMandatory', true,
        'defaultPosition', 70,
        'defaultDurationMinutes', 15
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'verneombud'),
      jsonb_build_object('role', 'employer_rep')
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'sjekkliste',
        'label', 'Sjekkliste for verneområdet er klar',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'forrige_runde',
        'label', 'Rapport fra forrige vernerunde tilgjengelig',
        'isMandatory', false
      ),
      jsonb_build_object(
        'key', 'kjemikalieregister',
        'label', 'Kjemikalieregister og sikkerhetsdatablader oppdatert',
        'isMandatory', false,
        'lawRef', 'Forskrift om utførelse av arbeid § 3-9'
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 5,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'vernerunde_rapport_til_amu',
        'obligation_label', 'Vernerunde-rapport vedlegges neste AMU-saksliste',
        'recipient', 'intern',
        'law_ref', 'AML § 7-2 (2) bokstav b',
        'due_offset_days', 21
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'location', 'kind', 'location', 'label', 'Verneområde', 'required', true),
      jsonb_build_object('key', 'department', 'kind', 'department', 'label', 'Avdeling', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Deltakere', 'required', true)
    )
  ),
  true,
  130
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  cadence_hint = excluded.cadence_hint,
  default_duration_minutes = excluded.default_duration_minutes,
  default_category_slug = excluded.default_category_slug,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 8. Drøftelse § 15-1 — individuell (før oppsigelse)                       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'drofting-15-1-individuell',
  'drofting-15-1-individuell',
  'Drøftelsesmøte § 15-1 — individuell (før oppsigelse / avskjed)',
  'Individuell drøftelse mellom arbeidsgiver og arbeidstaker FØR beslutning om oppsigelse eller avskjed tas. '
  'Manglende drøfting er en saksbehandlingsfeil som kan flippe en oppsigelse fra saklig til usaklig '
  '(Rt. 2003 s.1071, HR-2018-1189-A). Arbeidstaker har rett til å la seg bistå av tillitsvalgt eller annen rådgiver.',
  'AML',
  array['AML'],
  array['AML § 15-1', 'AML § 15-7', 'AML § 15-11'],
  'ad_hoc',
  60,
  'aml-drofting',
  'confidential',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'overskrift',
        'title', 'Drøftelse etter aml § 15-1 — innledning og formål',
        'lawRef', 'AML § 15-1',
        'description', 'Møtet skal eksplisitt markeres som drøftelse etter § 15-1, ikke som ordinær personalsamtale. Beslutning er ikke tatt — drøftelse forutsetter åpenhet for arbeidstakers synspunkter.',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'grunnlag',
        'title', 'Grunnlag for vurdering — faktiske forhold',
        'lawRef', 'AML § 15-7 (1)',
        'description', 'Arbeidsgiver fremlegger de faktiske forhold som ligger til grunn for vurderingen (drift / arbeidstakers forhold). Skal være konkret og dokumentert.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'utvelgelseskrets',
        'title', 'Utvelgelseskrets og utvelgelseskriterier (ved nedbemanning)',
        'lawRef', 'AML § 15-7 (2)',
        'description', 'Hvis grunnlaget er virksomhetens forhold: hvilken krets ble vurdert, og hvilke kriterier (ansiennitet, kompetanse, sosiale forhold) ble brukt?',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'arbeidstakers_innsigelser',
        'title', 'Arbeidstakers innsigelser, synspunkter og opplysninger',
        'lawRef', 'AML § 15-1',
        'description', 'Hovedhensikten med drøftelsen — å gi arbeidstaker reell mulighet til å påvirke beslutningen. Skal protokollføres ordrett der det er praktisk mulig.',
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'sosiale_forhold',
        'title', 'Sosiale forhold (forsørgelsesbyrde, alder, helse)',
        'lawRef', 'AML § 15-7 (2)',
        'description', 'Avveies mot virksomhetens behov ved nedbemanning. Skal vurderes individuelt.',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'annet_passende_arbeid',
        'title', 'Annet passende arbeid i virksomheten — vurdering',
        'lawRef', 'AML § 15-7 (2)',
        'description', 'Arbeidsgiver må vurdere om annet passende arbeid kan tilbys før oppsigelse er saklig. KRITISK saksbehandlingspunkt.',
        'isMandatory', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'videre_prosess',
        'title', 'Videre prosess og frister',
        'description', 'Informasjon om at beslutning ikke er tatt; arbeidstakers rett til å bringe saken inn for forhandlinger (§ 17-3) og søksmål (§ 17-4) ved oppsigelse.',
        'isMandatory', true,
        'defaultPosition', 70,
        'defaultDurationMinutes', 5
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'member', 'count', 1)
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'innkalling_overskrift',
        'label', 'Innkalling med tekst "Drøftelse etter aml § 15-1" sendt',
        'isMandatory', true,
        'lawRef', 'AML § 15-1'
      ),
      jsonb_build_object(
        'key', 'tilbud_radgiver',
        'label', 'Arbeidstaker informert om rett til å la seg bistå av tillitsvalgt / rådgiver',
        'isMandatory', true,
        'lawRef', 'AML § 15-1'
      ),
      jsonb_build_object(
        'key', 'faktagrunnlag',
        'label', 'Faktagrunnlag dokumentert (drift / arbeidstakers forhold)',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'utvelgelsesgrunnlag',
        'label', 'Utvelgelseskrets og kriterier dokumentert (ved nedbemanning)',
        'isMandatory', false
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 3,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'protokoll_arbeidstaker_eksemplar',
        'obligation_label', 'Drøftelsesprotokoll sendt arbeidstaker (eksemplar) — bevis i evt. tvist',
        'recipient', 'intern',
        'law_ref', 'AML § 15-1',
        'due_offset_days', 7
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'department', 'kind', 'department', 'label', 'Avdeling', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Deltakere (arbeidstaker + arbeidsgiverrep + ev. tillitsvalgt)', 'required', true)
    )
  ),
  true,
  260
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 9. Drøftelse § 15-2 — masseoppsigelse                                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'drofting-15-2-masseoppsigelse',
  'drofting-15-2-masseoppsigelse',
  'Drøftelse § 15-2 — masseoppsigelse (≥ 10 ansatte / 30 dager)',
  'Drøftelse med tillitsvalgte ved masseoppsigelse (oppsigelse av minst 10 arbeidstakere innenfor 30 dager). '
  'EU-direktiv 98/59/EF implementert i § 15-2. Skriftlig melding til NAV samtidig med drøftelsesstart. '
  '30-dagers suspensiv frist før iverksettelse (arbeidsmarkedsloven § 8). Drøftelsesplikten starter når masseoppsigelse vurderes — ikke ved beslutning.',
  'AML',
  array['AML', 'Arbeidsmarkedsloven'],
  array['AML § 15-2', 'AML § 15-2 (3)', 'EU-direktiv 98/59/EF',
        'Arbeidsmarkedsloven § 8'],
  'ad_hoc',
  180,
  'aml-drofting',
  'restricted',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'innledning',
        'title', 'Innledning — § 15-2 drøftelsesplikt utløst',
        'lawRef', 'AML § 15-2 (1)',
        'description', 'Konstaterer at virksomheten vurderer masseoppsigelse (≥ 10 / 30 dager). Drøftelsesplikten gjelder selv om kontraktene ikke nødvendigvis sies opp (EFTA-domstolen).',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'grunner',
        'title', '1) Grunner for masseoppsigelse',
        'lawRef', 'AML § 15-2 (3) (a)',
        'description', 'Skriftlig redegjørelse — den ene av de 8 obligatoriske informasjonspunktene.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'antall',
        'title', '2) Antall arbeidstakere som vil bli oppsagt',
        'lawRef', 'AML § 15-2 (3) (b)',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'arbeidsgruppe',
        'title', '3) Hvilken arbeidstakergruppe som vil bli rammet',
        'lawRef', 'AML § 15-2 (3) (c)',
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'utvelgelseskriterier',
        'title', '4) Hvilke utvelgelseskriterier som vil bli brukt',
        'lawRef', 'AML § 15-2 (3) (d)',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'periode',
        'title', '5) Tidspunkt for iverksettelse av oppsigelsene',
        'lawRef', 'AML § 15-2 (3) (e)',
        'isMandatory', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'sluttvederlag',
        'title', '6) Beregningsmåten for eventuelle sluttvederlag utover lov og avtale',
        'lawRef', 'AML § 15-2 (3) (f)',
        'isMandatory', true,
        'defaultPosition', 70,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'tiltak_unngaa',
        'title', '7) Tiltak for å unngå eller redusere antall oppsigelser',
        'lawRef', 'AML § 15-2 (3) (g)',
        'description', 'Vurder permitteringer, omplassering, frivillig avtaling, redusert overtid før oppsigelse.',
        'isMandatory', true,
        'defaultPosition', 80,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'tiltak_redusere',
        'title', '8) Tiltak for å avhjelpe konsekvensene (omskolering, hjelp til ny jobb, sluttavtale)',
        'lawRef', 'AML § 15-2 (3) (h)',
        'isMandatory', true,
        'defaultPosition', 90,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'tillitsvalgtes_innspill',
        'title', 'Tillitsvalgtes innspill og motforslag',
        'lawRef', 'AML § 15-2 (2)',
        'description', 'Reell mulighet til å påvirke — protokollføres.',
        'isMandatory', true,
        'defaultPosition', 100,
        'defaultDurationMinutes', 30
      ),
      jsonb_build_object(
        'key', 'nav_melding',
        'title', 'NAV-melding — samtidig med drøftelsesstart',
        'lawRef', 'AML § 15-2 (3)',
        'description', 'Skriftlig melding til NAV kopi-leveres tillitsvalgte. Oppsigelser kan IKKE iverksettes før 30 dager etter NAV-melding (arbeidsmarkedsloven § 8).',
        'isMandatory', true,
        'defaultPosition', 110,
        'defaultDurationMinutes', 10
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'employer_rep'),
      jsonb_build_object('role', 'tillitsvalgt')
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'skriftlig_informasjon',
        'label', 'Skriftlig informasjon med alle 8 punkter ferdigstilt før drøftelsen',
        'isMandatory', true,
        'lawRef', 'AML § 15-2 (3)'
      ),
      jsonb_build_object(
        'key', 'nav_skjema',
        'label', 'NAV-skjema "Melding om masseoppsigelser" klargjort',
        'isMandatory', true,
        'lawRef', 'AML § 15-2 (3)'
      ),
      jsonb_build_object(
        'key', 'arbtilsynet_kopi',
        'label', 'Kopi til Arbeidstilsynet klargjort',
        'isMandatory', true
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 5,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'nav_masseoppsigelse_meldeskjema',
        'obligation_label', 'Melding om masseoppsigelse til NAV (samtidig med drøftelsen)',
        'recipient', 'NAV',
        'law_ref', 'AML § 15-2 (3)',
        'due_offset_days', 0
      ),
      jsonb_build_object(
        'obligation_key', 'arbeidstilsynet_15_2_kopi',
        'obligation_label', 'Kopi av melding til Arbeidstilsynet',
        'recipient', 'Arbeidstilsynet',
        'law_ref', 'AML § 15-2 (3)',
        'due_offset_days', 0
      ),
      jsonb_build_object(
        'obligation_key', 'oppsigelse_suspensiv_frist_30d',
        'obligation_label', 'Suspensiv frist før iverksettelse av oppsigelser',
        'recipient', 'intern',
        'law_ref', 'Arbeidsmarkedsloven § 8',
        'due_offset_days', 30
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'department', 'kind', 'department', 'label', 'Avdeling', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Tillitsvalgte + ledelse', 'required', true),
      jsonb_build_object('key', 'antall_berort', 'kind', 'number', 'label', 'Antall berørte arbeidstakere', 'required', true)
    )
  ),
  true,
  270
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 10. Drøftelse § 10-3 — arbeidsplan / turnus                              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'drofting-10-3-arbeidsplan',
  'drofting-10-3-arbeidsplan',
  'Drøftelse § 10-3 — arbeidsplan / turnus',
  'Drøftelse med tillitsvalgte om arbeidsplan / turnus før iverksettelse. '
  'Arbeidsplan skal være drøftet senest 2 uker før iverksettelse (§ 10-3). '
  'Skriftlig avtale med tillitsvalgte kreves ved unntak fra alminnelig arbeidstid '
  '(gjennomsnittsberegning, overtid, nattarbeid, søndagsarbeid).',
  'AML',
  array['AML'],
  array['AML § 10-3', 'AML § 10-5', 'AML § 10-6', 'AML § 10-8',
        'AML § 10-10', 'AML § 10-11'],
  'semiannual',
  90,
  'aml-drofting',
  'restricted',
  null,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'omfang',
        'title', 'Omfang — hvilke arbeidstakere og perioder gjelder turnusen',
        'lawRef', 'AML § 10-3',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'arbeidsplan_innhold',
        'title', 'Arbeidsplanens innhold — arbeidsdager, arbeidstid, fritid',
        'lawRef', 'AML § 10-3',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'gjennomsnittsberegning',
        'title', 'Gjennomsnittsberegning (om aktuelt)',
        'lawRef', 'AML § 10-5',
        'description', 'Krever skriftlig avtale med tillitsvalgte eller dispensasjon fra Arbeidstilsynet.',
        'isMandatory', false,
        'defaultPosition', 30,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'natt_sondag',
        'title', 'Nattarbeid og søndagsarbeid — vilkår og begrunnelse',
        'lawRef', 'AML § 10-10',
        'description', 'Søndagsarbeid kun når arbeidet er av en slik art at det fortløpende må foregå, eller når arbeidet er nødvendig pga. mangel på arbeidsfri tid.',
        'isMandatory', false,
        'defaultPosition', 40,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'overtid',
        'title', 'Overtid — rammer og varslingsrutine',
        'lawRef', 'AML § 10-6',
        'isMandatory', false,
        'defaultPosition', 50,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'risikovurdering',
        'title', 'Risikovurdering av arbeidsplanen (helse, sikkerhet)',
        'lawRef', 'AML § 10-2',
        'description', 'Arbeidsplanen skal være tilpasset arbeidstakernes helse og velferd.',
        'isMandatory', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 10
      ),
      jsonb_build_object(
        'key', 'tillitsvalgtes_innspill',
        'title', 'Tillitsvalgtes innspill og motforslag',
        'voteRequired', true,
        'voting_model', 'consensus',
        'isMandatory', true,
        'defaultPosition', 70,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'iverksettelse',
        'title', 'Iverksettelsestidspunkt og varslingsrutine til ansatte',
        'lawRef', 'AML § 10-3',
        'description', 'Arbeidsplanen skal iverksettes senest 2 uker etter at den er drøftet med tillitsvalgte.',
        'isMandatory', true,
        'defaultPosition', 80,
        'defaultDurationMinutes', 5
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'employer_rep'),
      jsonb_build_object('role', 'tillitsvalgt')
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'arbeidsplan_utkast',
        'label', 'Utkast til arbeidsplan sendt tillitsvalgte ≥ 2 uker før møtet',
        'isMandatory', true,
        'lawRef', 'AML § 10-3'
      ),
      jsonb_build_object(
        'key', 'forskrift_sjekk',
        'label', 'Forskrift om arbeidstid hos arbeidstakere med utvidet arbeidsperiode vurdert (om aktuelt)',
        'isMandatory', false
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 14,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'arbtilsynet_dispensasjon',
        'obligation_label', 'Søknad til Arbeidstilsynet ved unntak (om gjennomsnittsberegning kreves uten skriftlig avtale)',
        'recipient', 'Arbeidstilsynet',
        'law_ref', 'AML § 10-12 (4)',
        'due_offset_days', 14
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'department', 'kind', 'department', 'label', 'Avdeling', 'required', false),
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Tillitsvalgte + ledelse', 'required', true)
    )
  ),
  true,
  280
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 11. Drøftelse § 8-1 — løpende informasjon (≥ 50 ansatte)                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates (
  id, slug, label, description, framework, frameworks, law_refs,
  cadence_hint, default_duration_minutes, default_category_slug,
  default_confidentiality_level, minimum_employee_count,
  definition, metadata_schema, is_active, sort_order
) values (
  'drofting-8-1-informasjon',
  'drofting-8-1-informasjon',
  'Drøftelse § 8-1 — løpende informasjon (≥ 50 ansatte)',
  'Plikt til informasjon og drøfting i virksomheter med ≥ 50 ansatte. EU-direktiv 2002/14/EF implementert i AML kap. 8. '
  'Skjer løpende — typisk kvartalsvis. Tillitsvalgte skal få informasjonsgrunnlag som tillater forberedelse. '
  'Tvist kan løftes til Tvisteløsningsnemnda (AML § 17-2) av tillitsvalgte eller 1/5 av arbeidstakerne.',
  'AML',
  array['AML'],
  array['AML § 8-1', 'AML § 8-2', 'AML § 8-3', 'AML § 17-2',
        'EU-direktiv 2002/14/EF'],
  'quarterly',
  90,
  'aml-drofting',
  'restricted',
  50,
  jsonb_build_object(
    'agendaItems', jsonb_build_array(
      jsonb_build_object(
        'key', 'apning',
        'title', 'Åpning og godkjenning av referat fra forrige drøftelse',
        'isMandatory', true,
        'defaultPosition', 10,
        'defaultDurationMinutes', 5
      ),
      jsonb_build_object(
        'key', 'aktivitetsutvikling',
        'title', 'Den senere tids og forventede aktivitetsutvikling',
        'lawRef', 'AML § 8-2 (1) (a)',
        'description', 'Markedssituasjon, ordretilgang, strategiske initiativ.',
        'isMandatory', true,
        'defaultPosition', 20,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'okonomisk_situasjon',
        'title', 'Bedriftens økonomiske situasjon',
        'lawRef', 'AML § 8-2 (1) (a)',
        'description', 'Resultat, balanse, likviditet. Sammenligning med samme periode forrige år.',
        'isMandatory', true,
        'defaultPosition', 30,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'bemanningssituasjon',
        'title', 'Bemanningssituasjon — forventet utvikling',
        'lawRef', 'AML § 8-2 (1) (b)',
        'description', 'Antall ansatte, midlertidige, sluttdatoer, planlagte rekrutteringer. Kobles til § 14-9-drøfting når aktuelt.',
        'dataBinding', jsonb_build_object(
          'source', 'headcount_and_amu_composition',
          'window', 'current',
          'presentation', 'table'
        ),
        'isMandatory', true,
        'defaultPosition', 40,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'beslutninger_som_kan_endre_arbeidsorganisering',
        'title', 'Beslutninger som kan endre arbeidsorganiseringen eller ansettelsesforholdene vesentlig',
        'lawRef', 'AML § 8-2 (1) (c)',
        'description', 'Større omorganisering, outsourcing, ny teknologi, fusjon/fisjon. Drøftelsen skjer FØR beslutning tas.',
        'isMandatory', true,
        'defaultPosition', 50,
        'defaultDurationMinutes', 20
      ),
      jsonb_build_object(
        'key', 'tillitsvalgtes_synspunkter',
        'title', 'Tillitsvalgtes synspunkter — protokollført',
        'lawRef', 'AML § 8-2 (2)',
        'isMandatory', true,
        'defaultPosition', 60,
        'defaultDurationMinutes', 15
      ),
      jsonb_build_object(
        'key', 'taushetsplikt',
        'title', 'Taushetspliktige opplysninger — eksplisitt markert',
        'lawRef', 'AML § 8-3',
        'description', 'Arbeidsgiver kan pålegge tillitsvalgte taushetsplikt om informasjon som er nødvendig av hensyn til virksomhetens behov.',
        'isMandatory', true,
        'defaultPosition', 70,
        'defaultDurationMinutes', 5
      )
    ),
    'requiredAttendees', jsonb_build_array(
      jsonb_build_object('role', 'chair', 'count', 1),
      jsonb_build_object('role', 'secretary', 'count', 1),
      jsonb_build_object('role', 'employer_rep'),
      jsonb_build_object('role', 'tillitsvalgt')
    ),
    'preparationChecklist', jsonb_build_array(
      jsonb_build_object(
        'key', 'informasjonsgrunnlag_5dager',
        'label', 'Informasjonsgrunnlag sendt tillitsvalgte ≥ 5 virkedager før møtet',
        'isMandatory', true,
        'lawRef', 'AML § 8-2'
      ),
      jsonb_build_object(
        'key', 'okonomi_dokumenter',
        'label', 'Økonomi- og bemanningsrapport vedlagt',
        'isMandatory', true
      ),
      jsonb_build_object(
        'key', 'taushetsplikt_markering',
        'label', 'Taushetsplikt-pålegg klargjort der nødvendig',
        'isMandatory', false,
        'lawRef', 'AML § 8-3'
      )
    ),
    'protocolRoles', jsonb_build_array('chair', 'secretary'),
    'invitationLeadDays', 7,
    'reportingObligations', jsonb_build_array(
      jsonb_build_object(
        'obligation_key', 'tvisteloesingsnemnd_8_3',
        'obligation_label', 'Tvist om informasjons- og drøftingsplikt kan løftes til Tvisteløsningsnemnda',
        'recipient', 'Tvisteløsningsnemnda',
        'law_ref', 'AML § 17-2',
        'due_offset_days', 30
      )
    )
  ),
  jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'participants', 'kind', 'participants', 'label', 'Tillitsvalgte + ledelse', 'required', true)
    )
  ),
  true,
  290
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  default_confidentiality_level = excluded.default_confidentiality_level,
  minimum_employee_count = excluded.minimum_employee_count,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 12. Re-frame existing dialogmøter from 'AML' → 'Folketrygdloven'         │
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- The original seed tagged the three dialogmøte-templates with framework =
-- 'AML', but their primary basis is folketrygdloven § 8-7a (sykepenger og
-- arbeidsrettet oppfølging). AML § 4-6 is secondary (tilrettelegging). The
-- research report makes this explicit; the planner uses framework for the
-- "by-framework" donut on the analyse page so accuracy matters.

update public.meeting_system_templates
   set framework = 'Folketrygdloven',
       frameworks = case
         when 'Folketrygdloven' = any(frameworks)
           then frameworks
         else array_append(frameworks, 'Folketrygdloven')::text[]
       end,
       updated_at = now()
 where id in ('dialogmote-1-uke-7',
              'dialogmote-2-uke-26',
              'dialogmote-3-nav-innkalt')
   and framework <> 'Folketrygdloven';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 13. Backfill — re-run provision for every existing org                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- The provisioning function inserts settings rows for any newly-active
-- templates (system) and seeds default categories. Idempotent on PK.

do $$
declare v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform public.provision_meetings_baseline_for_org(v_org_id);
  end loop;
end $$;
