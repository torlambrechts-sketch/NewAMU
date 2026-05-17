-- Seed 5 missing baseline workflow_system_rules identified by the
-- compliance audit (specs/workflow-engine-review.md §4). Each row is a
-- non-optional rule the platform claims to enforce but did not actually
-- ship a row for in _122200 / _122300.
--
-- Arbeidstilsynet / LDO / Datatilsynet self-audit (6-8 lines):
--   Pålegg-grunner addressed: Likestillings- og diskrimineringsloven
--   § 26 + § 26 a (ARP-redegjørelse + lønnskartlegging for ≥50 ansatte),
--   AML § 7-2 (3) bokstav f (AMU-årsrapport, ≥30 ansatte), AML § 5-2
--   første ledd (parallell-varsling til nærmeste politimyndighet),
--   GDPR Art. 30 (årlig revisjon av behandlingsprotokoll),
--   GDPR Art. 35 (DPIA før behandling som krever vurdering iverksettes).
--   Restrisiko deferred: § 5-2 politi-meldingen er en strukturert
--   påminnelse-oppgave med audit-spor — ikke en automatisert melding,
--   fordi det ikke finnes API mot politidistriktene. Daglig leder må
--   selv ringe og loggføre nummer/tidspunkt.

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  name, description, rationale,
  source_module, trigger_type, trigger_event_name, schedule_cron,
  trigger_on, condition_json, actions_json,
  law_refs, frameworks, pdca_phase,
  applies_if_employee_count_gte, confidentiality_level,
  enabled, notes
) values

-- ─── 1. LDL § 26 — ARP årlig redegjørelse ───────────────────────────────
(
  'ldl-26-arp-yearly-report',
  'Likestillingsloven',
  'Likestillings- og diskrimineringsloven — Aktivitets- og redegjørelsesplikt',
  300,
  'LDL § 26 / § 26 a — ARP-redegjørelse + lønnskartlegging',
  'LDL § 26 / § 26 a — Årlig ARP-redegjørelse (1. februar) for org ≥50 ansatte',
  'Hvert år (1. februar 08:00) opprettes en oppgave for HR-leder om å utarbeide aktivitets- og redegjørelsespliktens årlige redegjørelse, og en AMU-agendapost om gjennomgang. Lønnskartlegging skal gjennomføres annethvert år som del av samme redegjørelse.',
  'Likestillings- og diskrimineringsloven § 26 (aktivitetsplikt) + § 26 a (redegjørelsesplikt): arbeidsgivere med ≥50 ansatte skal redegjøre for aktivitetsplikten i årsberetning eller annet offentlig dokument. Lønnskartlegging hvert 2. år er minimum. Manglende redegjørelse er pålegg-grunn fra Diskrimineringsnemnda/LDO.',
  'internkontroll', 'schedule', null, '0 8 1 2 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"add_amu_agenda_item","agendaItem":"ARP-redegjørelse — gjennomgang","priority":"høy"},
    {"type":"create_task","title":"Utarbeid ARP-redegjørelse for fjoråret, lever i årsberetning","description":"Likestillings- og diskrimineringsloven § 26 og § 26 a. Inkluder lønnskartlegging annethvert år. Skal publiseres i årsberetning eller annet offentlig dokument.","assignee":"HR","ownerRole":"hr_leder","dueInDays":60,"module":"internkontroll","sourceType":"§26-arp"}
  ]'::jsonb,
  ARRAY['Likestillings- og diskrimineringsloven § 26', 'Likestillings- og diskrimineringsloven § 26 a'],
  ARRAY['Likestillingsloven'],
  'check', 50, 'standard',
  true,
  'Pack=null — kjøres uavhengig av aml-amu/iso-45001/gdpr-pakke. 1. februar gir ~2 mnd til typisk årsberetnings-frist.'
),

-- ─── 2. AML § 7-2 (3) f — AMU-årsrapport ────────────────────────────────
(
  'aml-7-2-amu-arsrapport-yearly',
  'AML',
  'Kap. 7 — Arbeidsmiljøutvalg',
  7,
  'AML § 7-2 (3) bokstav f — AMU årsrapport',
  'AML § 7-2 (3) f — AMU-årsrapport (15. desember)',
  'Hvert år (15. desember 09:00) opprettes en AMU-agendapost og en oppgave til AMU-leder om å utarbeide og signere AMU-årsrapporten. Kopi skal sendes til Arbeidstilsynet.',
  'AML § 7-2 (3) bokstav f: AMU skal hvert år avgi rapport om sin virksomhet til virksomhetens styrende organer og arbeidstakernes organisasjoner. Forskrift om organisering, ledelse og medvirkning § 3-22: kopi sendes Arbeidstilsynet. Manglende årsrapport er pålegg-grunn ved tilsyn.',
  'meetings', 'schedule', null, '0 9 15 12 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"add_amu_agenda_item","agendaItem":"AMU-årsrapport — utarbeidelse og signering","priority":"høy"},
    {"type":"create_task","title":"Utarbeid AMU-årsrapport iht. § 7-2 (3) bokstav f. Send kopi til Arbeidstilsynet.","description":"AML § 7-2 (3) f krever årlig rapport fra AMU. Forskrift om organisering, ledelse og medvirkning § 3-22 krever kopi til Arbeidstilsynet.","assignee":"AMU-leder","ownerRole":"amu_leder","dueInDays":20,"module":"meetings","sourceType":"§7-2-f"}
  ]'::jsonb,
  ARRAY['AML § 7-2', 'AML § 7-2 (3) bokstav f'],
  ARRAY['AML', 'aml-amu'],
  'check', 30, 'standard',
  true,
  '15. desember gir ~3 uker til årsskifte for å fullføre og levere rapporten.'
),

-- ─── 3. AML § 5-2 første ledd — Politimyndighet-melding (parallell) ────
(
  'aml-5-2-politi-parallel',
  'AML',
  'Kap. 5 — Meldeplikt',
  5,
  'AML § 5-2 første ledd — Varsling av nærmeste politimyndighet',
  'AML § 5-2 første ledd — parallell-varsling av politimyndighet ved alvorlig skade',
  'Alvorlig personskade flagget i inspeksjon → påminnelses-oppgave + 24t-varsel til daglig leder om å ringe nærmeste politimyndighet. Parallel til Arbeidstilsynet-melding (aml-5-2-arbeidstilsynet-24h).',
  'AML § 5-2 første ledd: «Hvis arbeidstaker omkommer eller blir alvorlig skadet ved en arbeidsulykke, skal arbeidsgiver straks og senest innen 24 timer varsle Arbeidstilsynet og nærmeste politimyndighet.» Politi-leg er parallell til Arbeidstilsynet-leg — ikke alternativ. Forsinket eller manglende politi-varsling kan medføre straffansvar.',
  'inspection', 'db_event', 'finding_critical', null, 'insert',
  '{"match":"field_equals","path":"category","value":"alvorlig_personskade"}'::jsonb,
  '[
    {"type":"create_task","title":"Varsle nærmeste politimyndighet jf. AML § 5-2 første ledd","description":"AML § 5-2 første ledd krever varsling av nærmeste politimyndighet ved alvorlig personskade. Dette er parallel til Arbeidstilsynet-meldingen. Plattformen kan ikke automatisere dette steget — daglig leder må selv ringe lokal politi-distrikt og loggføre nummer + tidspunkt i denne oppgaven.","assignee":"Daglig leder","ownerRole":"daglig_leder","dueInDays":1,"module":"inspection","sourceType":"§5-2-politi","lawRefs":["AML § 5-2"]},
    {"type":"send_notification","title":"Politianmeldelse-frist 24h","message":"Husk: AML § 5-2 første ledd krever også varsling til nærmeste politimyndighet.","toRole":"daglig_leder","deadlineHours":24,"reminderHoursBeforeDeadline":[12,4,1]}
  ]'::jsonb,
  ARRAY['AML § 5-2'],
  ARRAY['AML'],
  'do', null, 'restricted',
  true,
  'NewAMU kan ikke sende strukturert melding til politiet (ingen API for politidistrikt). Regelens jobb er påminnelse + audit-log slik at daglig leder ikke glemmer parallell-leget. TODO: kan i fremtidig P2 promoteres til en gov_politi_log_only action-type som speiler rapporter_alvorlig_skade_arbeidstilsynet (audit-only).'
),

-- ─── 4. GDPR Art. 30 — ROPA årlig revisjon ──────────────────────────────
(
  'gdpr-30-ropa-yearly-review',
  'GDPR',
  'GDPR / Personopplysningsloven — Behandlingsansvar',
  200,
  'GDPR Art. 30 — Behandlingsprotokoll (ROPA) årlig revisjon',
  'GDPR Art. 30 — Årlig revisjon av behandlingsprotokollen (1. mars)',
  'Hvert år (1. mars 08:00) opprettes en oppgave til personvernombud om å revidere behandlingsprotokollen iht. GDPR Art. 30. Bekreft at alle dataflyter, formål, kategorier og oppbevaringstider stemmer.',
  'GDPR Art. 30 + Personopplysningsloven § 11: behandlingsansvarlig (og databehandler) skal føre protokoll over behandlingsaktivitetene. Datatilsynet ber alltid om ROPA ved tilsyn — utdaterte oppføringer er pålegg-grunn. Årlig revisjon er beste praksis fra Datatilsynet og EDPB.',
  'internkontroll', 'schedule', null, '0 8 1 3 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Revider behandlingsprotokollen iht. GDPR Art. 30","description":"GDPR Art. 30 — bekreft at alle dataflyter, formål, kategorier av registrerte, kategorier av personopplysninger, mottakere og oppbevaringstider stemmer. Oppdater der noe er endret.","assignee":"Personvernombud","ownerRole":"personvernombud","dueInDays":30,"module":"internkontroll","sourceType":"gdpr-30-ropa","lawRefs":["GDPR Art. 30"]}
  ]'::jsonb,
  ARRAY['GDPR Art. 30', 'Personopplysningsloven § 11'],
  ARRAY['gdpr'],
  'check', null, 'standard',
  true,
  '1. mars plasserer revisjonen etter ARP-redegjørelsen (1. feb) slik at HR-leder og DPO ikke får sammenfallende frister.'
),

-- ─── 5. GDPR Art. 35 — DPIA før publisering ─────────────────────────────
(
  'gdpr-35-dpia-on-publish',
  'GDPR',
  'GDPR / Personopplysningsloven — Behandlingsansvar',
  200,
  'GDPR Art. 35 — DPIA før behandling iverksettes',
  'GDPR Art. 35 — DPIA-vurdering før publisering av dokument som krever vurdering av personvernkonsekvenser',
  'Dokument publisert med legal_basis som inneholder «GDPR Art. 35» → DPIA-oppgave til personvernombud (14d) + godkjenningskjede (DPO → daglig leder hvis eskalert).',
  'GDPR Art. 35 nr. 1: «Hvis en type behandling … sannsynligvis vil medføre en høy risiko for fysiske personers rettigheter og friheter, skal den behandlingsansvarlige før behandlingen foreta en vurdering av de planlagte behandlingsaktivitetenes konsekvenser for vern av personopplysninger.» DPIA SKAL skje før behandling iverksettes — uten DPIA er behandlingen ulovlig.',
  'documents', 'db_event', 'ON_DOCUMENT_PUBLISHED', null, 'insert',
  '{"match":"array_any","path":"legal_basis","where":{"value":"GDPR Art. 35"}}'::jsonb,
  '[
    {"type":"create_task","title":"DPIA-vurdering før behandling iverksettes","description":"GDPR Art. 35 krever DPIA før behandling som sannsynligvis medfører høy risiko iverksettes. Dokumentet erklærer at det implementerer en slik behandling — DPIA må fullføres innen 14 dager.","assignee":"Personvernombud","ownerRole":"personvernombud","dueInDays":14,"module":"documents","sourceType":"gdpr-35-dpia","lawRefs":["GDPR Art. 35"]},
    {"type":"request_approval","approverRole":"personvernombud","message":"Bekreft at DPIA er gjennomført og at behandlingen kan iverksettes (GDPR Art. 35).","escalateAfterHours":168,"escalateToRole":"daglig_leder"}
  ]'::jsonb,
  ARRAY['GDPR Art. 35'],
  ARRAY['gdpr'],
  'plan', null, 'restricted',
  true,
  'array_any match-syntax mirrorer _122200-pattern (samme som aml-4-3-psychosocial-confidential). Pack=gdpr.'
)

on conflict (slug) do update set
  framework = excluded.framework,
  category = excluded.category,
  category_order = excluded.category_order,
  subcategory = excluded.subcategory,
  name = excluded.name,
  description = excluded.description,
  rationale = excluded.rationale,
  source_module = excluded.source_module,
  trigger_type = excluded.trigger_type,
  trigger_event_name = excluded.trigger_event_name,
  schedule_cron = excluded.schedule_cron,
  trigger_on = excluded.trigger_on,
  condition_json = excluded.condition_json,
  actions_json = excluded.actions_json,
  law_refs = excluded.law_refs,
  frameworks = excluded.frameworks,
  pdca_phase = excluded.pdca_phase,
  applies_if_employee_count_gte = excluded.applies_if_employee_count_gte,
  confidentiality_level = excluded.confidentiality_level,
  enabled = excluded.enabled,
  notes = excluded.notes,
  updated_at = now();
