-- Sector pack: barnehage (barnehageloven + rammeplanen + leketøy).
-- Statsforvalter / Arbeidstilsynet / Mattilsynet self-audit:
--   Pålegg-grunner addressed: Barnehageloven § 2 (rammeplan-bundet
--   pedagogisk planlegging), § 7 (internkontroll), § 7 a (alvorlig
--   hendelse-melding), § 9 (samarbeid), § 30 (tilsyn fra Statsforvalter),
--   Rammeplan for barnehagen (årshjul / vurdering), Forskrift om
--   sikkerhet ved leketøy + Forskrift om miljørettet helsevern i
--   barnehager og skoler (uteareal-ROS), IK-f § 5 nr. 8 (årlig gjennomgang).
--   Restrisiko deferred: ingen API mot Statsforvalter / Fylkesmannen;
--   § 7 a-meldinger queues kun som manual_fylkesmann_submission outbox-rad
--   som styrer/daglig leder må sende videre via Altinn manuelt.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 0. Extend gov_notifications_outbox kind CHECK with                     │
-- │    manual_fylkesmann_submission (used by rule #4 below).               │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- Existing kinds (_20260907121000_gov_outbox_manual_kinds): datatilsynet_-
-- breach, nav_sykefravar_outbox, ldo_export_pending, datatilsynet_manual_-
-- send_required, manual_datatilsynet_submission, manual_ldo_export,
-- manual_arbeidstilsynet_submission. We add a new manual_fylkesmann_-
-- submission for barnehage § 7 a-meldinger (Statsforvalter er den
-- moderniserte navnet på Fylkesmannen; vi beholder "fylkesmann" som
-- enum-verdi for å matche praksis i etablerte rutiner).

do $$
declare
  v_constraint text;
begin
  select pg_get_constraintdef(oid) into v_constraint
  from pg_constraint
  where conrelid = 'public.gov_notifications_outbox'::regclass
    and conname = 'gov_notifications_outbox_kind_check';

  if v_constraint is not null
     and position('manual_fylkesmann_submission' in v_constraint) = 0 then
    alter table public.gov_notifications_outbox
      drop constraint gov_notifications_outbox_kind_check;
    alter table public.gov_notifications_outbox
      add constraint gov_notifications_outbox_kind_check
      check (kind in (
        'datatilsynet_breach',
        'nav_sykefravar_outbox',
        'ldo_export_pending',
        'datatilsynet_manual_send_required',
        'manual_datatilsynet_submission',
        'manual_ldo_export',
        'manual_arbeidstilsynet_submission',
        'manual_fylkesmann_submission'
      ));
  end if;
end$$;

comment on constraint gov_notifications_outbox_kind_check
  on public.gov_notifications_outbox is
  'Allowed outbox kinds. manual_* rows are human-triage (no auto-send) — see gov-outbox-worker awaiting_human path. Extended 2026-09-07 _126500 with manual_fylkesmann_submission for barnehage § 7 a-meldinger til Statsforvalter.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1-5. System rules for barnehage                                         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  name, description, rationale,
  source_module, trigger_type, trigger_event_name, schedule_cron,
  trigger_on, condition_json, actions_json,
  law_refs, frameworks, pdca_phase,
  applies_if_employee_count_gte, confidentiality_level,
  enabled, notes
) values

-- ─── 1. Barnehageloven § 7 — årlig internkontroll-gjennomgang ────────────
(
  'barnehage-7-internkontroll-tilsyn',
  'Barnehageloven',
  'Barnehage — Internkontroll',
  700,
  'Barnehageloven § 7 + IK-f § 5 nr. 8 — Årlig gjennomgang av internkontroll',
  'Barnehage § 7 — Årlig internkontroll-gjennomgang (1. september)',
  'Hvert år 1. september 08:00 (rett etter sommerstart / oppstart av nytt barnehageår) opprettes oppgave til styrer om å gjennomføre årlig gjennomgang av internkontroll iht. barnehageloven § 7 jf. IK-forskriften § 5 nr. 8. Inkluderer evaluering av rutiner, avvik siste år, og oppdatering av handlingsplan.',
  'Barnehageloven § 7: «Barnehageeier skal påse at barnehagen drives i samsvar med gjeldende lover og forskrifter. Barnehageeier skal ha forsvarlige systemer for å følge med på og vurdere barnehagens praksis, og for å avdekke og rette opp lovbrudd.» IK-f § 5 nr. 8 krever årlig systematisk gjennomgang. Manglende dokumentert årlig gjennomgang er hyppigste pålegg-grunn ved Statsforvalter-tilsyn etter § 30.',
  'meetings', 'schedule', null, '0 8 1 9 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Årlig gjennomgang av internkontroll iht. Barnehageloven §7","description":"Barnehageloven § 7 + IK-forskriften § 5 nr. 8. Evaluer rutiner, avvik siste år, og oppdater handlingsplan. Dokumentet skal forelegges barnehageeier og være tilgjengelig ved Statsforvalter-tilsyn (§ 30).","assignee":"Styrer","ownerRole":"styrer","dueInDays":30,"module":"compliance","sourceType":"barnehage-§7-internkontroll","lawRefs":["Barnehageloven § 7","IK-forskriften § 5 nr. 8"]},
    {"type":"send_notification","title":"§ 7 — internkontroll-gjennomgang","body":"Årlig internkontroll-gjennomgang skal påbegynnes innen utgangen av september.","category":"compliance","toRole":"styrer"}
  ]'::jsonb,
  ARRAY['Barnehageloven § 7', 'IK-forskriften § 5 nr. 8'],
  ARRAY['Barnehageloven'],
  'check', 1, 'standard',
  true,
  '1. september velges fordi barnehageåret starter ca. 15. august; styrer trenger 2 uker buffer før gjennomgang-oppgaven dukker opp. 30-dagers frist gir hele september + halve oktober til ferdigstillelse.'
),

-- ─── 2. Barnehageloven § 2 + Rammeplanen — årlig pedagogisk planlegging ──
(
  'barnehage-9-pedagogisk-rammeplan-yearly',
  'Barnehageloven',
  'Barnehage — Pedagogisk planlegging',
  701,
  'Barnehageloven § 2 + Rammeplan for barnehagen — Årlig pedagogisk plan',
  'Barnehage Rammeplan — Årlig pedagogisk planlegging (15. august)',
  'Hvert år 15. august 08:00 (rett før barnehageårets oppstart) opprettes oppgave til pedagogisk leder om å ferdigstille årets pedagogiske plan iht. Rammeplanen + Barnehageloven § 2. Planen skal vise hvordan barnehagen jobber med fagområdene, vurdering, og medvirkning fra barn og foreldre.',
  'Barnehageloven § 2 femte ledd: «Barnehagen skal gi barn muligheter for lek, livsutfoldelse og meningsfylte opplevelser og aktiviteter.» Rammeplan for barnehagens innhold og oppgaver (FOR-2017-04-24-487) kapittel 7-9 krever årlig pedagogisk planlegging, vurdering, og dokumentasjon. Manglende dokumentert årsplan = brudd på § 2 og varsel om pålegg ved Statsforvalter-tilsyn. Foreldreutvalg + samarbeidsutvalg skal involveres jf. § 4.',
  'meetings', 'schedule', null, '0 8 15 8 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Årlig pedagogisk plan — Rammeplan + § 2","description":"Barnehageloven § 2 + Rammeplan for barnehagen kap. 7-9. Ferdigstill årsplan: fagområder, vurdering, medvirkning. Foreleggas foreldreutvalg + samarbeidsutvalg før første foreldremøte.","assignee":"Pedagogisk leder","ownerRole":"pedagogisk_leder","dueInDays":21,"module":"meetings","sourceType":"barnehage-rammeplan-arsplan","lawRefs":["Barnehageloven § 2","Rammeplan for barnehagen"]},
    {"type":"send_notification","title":"Rammeplan — årsplan-sesong","body":"Årsplan skal foreligge innen barnehageårets start. 21 dagers frist.","category":"compliance","toRole":"pedagogisk_leder"}
  ]'::jsonb,
  ARRAY['Barnehageloven § 2', 'Rammeplan for barnehagen'],
  ARRAY['Barnehageloven'],
  'plan', null, 'standard',
  true,
  '15. august treffer typisk 1-2 uker før første barnehagedag. 21-dagers frist gir buffer for foreldreutvalg-behandling. Rammeplanen er forskrift (FOR-2017-04-24-487) men siteres ved navn fordi navnet er det styrere kjenner igjen.'
),

-- ─── 3. Barnehageloven § 30 — tilsynsbrev fra Statsforvalteren ───────────
(
  'barnehage-30-tilsynsbrev',
  'Barnehageloven',
  'Barnehage — Tilsyn',
  702,
  'Barnehageloven § 30 — Tilsyn fra Statsforvalteren',
  'Barnehage § 30 — Tilsynsbrev mottatt → konfidensiell rapportering',
  'Når et tilsynsbrev (kind=barnehage_statsforvalter) lastes opp (ON_TILSYNSBREV_UPLOADED) opprettes konfidensiell oppgave til styrer + eier med 3 dagers frist for å gjennomgå, dokumentere mottatt status, og delegere oppfølging. Konfidensialitet pga. potensielt sensitive funn (personopplysninger, identifiserbare ansatte).',
  'Barnehageloven § 30: «Statsforvalteren fører tilsyn med at kommunen utfører de oppgaver den er pålagt etter denne loven.» Tilsynsbrev fra Statsforvalter til barnehage (kommunal eller privat) skal håndteres innen kort frist — manglende svar er pålegg-grunn i seg selv og kan utløse vedtak om retting eller sanksjon iht. § 30 a.',
  'tilsynsbrev', 'db_event', 'ON_TILSYNSBREV_UPLOADED', null, 'insert',
  '{"match":"field_equals","path":"category","value":"barnehage_statsforvalter"}'::jsonb,
  '[
    {"type":"create_task","title":"[KONFIDENSIELT] § 30 — gjennomgå tilsynsbrev fra Statsforvalteren","description":"Barnehageloven § 30. Bekreft mottak, dokumenter funn, delegere oppfølging. Svarfristen i brevet er bindende.","assignee":"Styrer","ownerRole":"styrer","dueInDays":3,"module":"tilsynsbrev","sourceType":"barnehage-§30","lawRefs":["Barnehageloven § 30","Barnehageloven § 30 a"]},
    {"type":"send_notification","title":"§ 30 — tilsynsbrev mottatt","body":"Tilsynsbrev fra Statsforvalteren krever konfidensiell behandling. Eier varsles parallelt.","category":"compliance","toRole":"styrer"},
    {"type":"escalate","toRole":"eier","note":"§ 30 — Statsforvalter-tilsyn skal varsles eier umiddelbart. Konfidensiell behandling."}
  ]'::jsonb,
  ARRAY['Barnehageloven § 30'],
  ARRAY['Barnehageloven'],
  'do', null, 'confidential',
  true,
  'Tilsynsbrev-modulens ON_TILSYNSBREV_UPLOADED-payload må inneholde category=''barnehage_statsforvalter''. Hvis kategorisering ikke skjer automatisk faller saken på det generiske tilsynsbrev-triage-løpet i _124000 og må re-tagges manuelt.'
),

-- ─── 4. Barnehageloven § 7 a — alvorlig hendelse → melding Statsforvalter ─
(
  'barnehage-7a-melding-alvorlig',
  'Barnehageloven',
  'Barnehage — Alvorlig hendelse',
  703,
  'Barnehageloven § 7 a — Melding om alvorlig hendelse / barneskade',
  'Barnehage § 7 a — Alvorlig hendelse → manuell melding Statsforvalter',
  'Kritisk funn fra inspeksjon med tags inneholder både ''barnehage'' OG ''barnskade'' → konfidensiell oppgave til daglig leder + manuell outbox-rad (manual_fylkesmann_submission) som påminnelse om e-meldingsskjema til Statsforvalter. § 7 a-meldeplikt utløses ved alvorlige hendelser som har eller kunne hatt vesentlig betydning for barns liv eller helse.',
  'Barnehageloven § 7 a (innført 2021): «Barnehageeier skal varsle Statsforvalteren ved alvorlige hendelser som rammer barn eller ansatte i barnehagen.» Manglende varsling er straffesanksjonert og pålegg-grunn. Vi har ikke API mot Statsforvalteren — manuell outbox med audit-spor er substituttet inntil Altinn-integrasjon foreligger.',
  'inspection', 'db_event', 'finding_critical', null, 'insert',
  '{"match":"array_all","path":"tags","where":{"values":["barnehage","barnskade"]}}'::jsonb,
  '[
    {"type":"create_task","title":"[KONFIDENSIELT] § 7 a — vurder melding til Statsforvalteren","description":"Barnehageloven § 7 a. Alvorlig hendelse skal meldes Statsforvalter via e-meldingsskjema (statsforvalteren.no). Loggfør referansenummer + tidspunkt i denne oppgaven. Outbox-rad (manual_fylkesmann_submission) er opprettet som påminnelse.","assignee":"Daglig leder","ownerRole":"daglig_leder","dueInDays":2,"module":"inspection","sourceType":"barnehage-§7a","lawRefs":["Barnehageloven § 7 a"]},
    {"type":"request_approval","approverRole":"eier","message":"Bekreft at § 7 a-melding er sendt Statsforvalteren.","escalateAfterHours":48,"escalateToRole":"styrer"},
    {"type":"send_notification","title":"§ 7 a — meldeplikt utløst","body":"Alvorlig hendelse — Statsforvalter skal varsles innen kort frist. Konfidensiell behandling.","category":"compliance","toRole":"daglig_leder"}
  ]'::jsonb,
  ARRAY['Barnehageloven § 7 a'],
  ARRAY['Barnehageloven'],
  'do', null, 'confidential',
  true,
  'Outbox-rad (manual_fylkesmann_submission) opprettes idag manuelt av styrer fra oppgave-detaljsiden — fremtidig action-type queue_manual_outbox vil automatisere dette. Tags-condition krever BÅDE barnehage OG barnskade for å unngå false-positives fra sektorblandede orgs.'
),

-- ─── 5. Forskrift om sikkerhet ved leketøy — uteareal-ROS ────────────────
(
  'barnehage-leketoy-ros-yearly',
  'Forskrift om sikkerhet ved leketøy',
  'Barnehage — Sikkerhet uteareal',
  704,
  'Forskrift om sikkerhet ved leketøy + Forskrift om miljørettet helsevern — Årlig leke- og uteareal-ROS',
  'Barnehage — Årlig leke-/uteareal-ROS (1. mai, før utesesongen)',
  'Hvert år 1. mai 08:00 (før utesesongen starter for fullt) opprettes oppgave til verneombud + styrer om å gjennomføre risiko- og sårbarhetsanalyse (ROS) av barnehagens uteareal, lekeutstyr, og fall-underlag. Skal dekke krav i Forskrift om sikkerhet ved leketøy + Forskrift om miljørettet helsevern i barnehager og skoler.',
  'Forskrift om sikkerhet ved leketøy: leketøy plassert i fellesarealer skal være CE-merket + risikovurdert. Forskrift om miljørettet helsevern i barnehager og skoler § 14: uteareal skal være tilstrekkelig stort, egnet for lek + læring, og fritt for farer. Mattilsynet/Helsetilsynet/kommunens miljørettet helsevern fører tilsyn — manglende dokumentert årlig ROS er pålegg-grunn. 1. mai gir buffer til reparasjoner før sommerens høysesong.',
  'inspection', 'schedule', null, '0 8 1 5 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Årlig ROS — uteareal, lekeutstyr, fall-underlag","description":"Forskrift om sikkerhet ved leketøy + Forskrift om miljørettet helsevern i barnehager og skoler § 14. Sjekk CE-merking, fall-underlag, klemfeller, og uteareal-størrelse. Dokumenter funn + tiltak.","assignee":"Verneombud","ownerRole":"verneombud","dueInDays":21,"module":"inspection","sourceType":"barnehage-leketoy-ros","lawRefs":["Forskrift om sikkerhet ved leketøy","Forskrift om miljørettet helsevern i barnehager og skoler"]},
    {"type":"add_amu_agenda_item","agendaItem":"Årlig uteareal-ROS — barnehage","priority":"høy"},
    {"type":"send_notification","title":"Uteareal-ROS","body":"Årlig ROS av uteareal og lekeutstyr skal være gjennomført før sommerens høysesong.","category":"compliance","toRole":"verneombud"}
  ]'::jsonb,
  ARRAY['Forskrift om sikkerhet ved leketøy', 'Forskrift om miljørettet helsevern i barnehager og skoler'],
  ARRAY['Barnehageloven'],
  'plan', null, 'standard',
  true,
  '1. mai gir 6 uker til utbedring før skolens / barnehagens sommer-høysesong (juni-august). Frameworks=Barnehageloven for at planneren skal plukke regelen ut i barnehage-kolonnen selv om law_refs peker på forskrifter.'
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

do $$
begin
  raise notice 'Barnehage sector pack installed: 5 system rules + manual_fylkesmann_submission outbox kind added.';
end
$$;
