-- Meetings · seed three system workflow rules that operationalize the
-- existing event surface (ON_MEETING_SCHEDULED / SIGNED / DECISION_LOGGED).
--
-- Why
--   The DB-side workflow event emitters (archive/20260901120050) and the
--   workflow scope (`src/pages/meetings/workflows/meetingsWorkflowScope.ts`)
--   are wired and emit, but no system-level rules consume them. Customers
--   can hand-roll rules in the Arbeidsflyt admin tab, but the out-of-box
--   compliance behavior is empty. This migration seeds three high-value
--   rules:
--
--   1. ON_MEETING_SCHEDULED → 24h pre-reminder task to chair (innkalling
--      double-check: agenda + recipients ready?)
--   2. ON_MEETING_SIGNED → opprett oppgave til sekretær: planlegg neste
--      møte iht. cadence_hint på malen.
--   3. ON_MEETING_DECISION_LOGGED → oppgave til ansvarlig medlem +
--      automatisk tagget med møte-id slik at den vises i
--      Vedtaksregister-visningen.
--
--   These reuse the existing `create_task` action — no new schema, no
--   new code path. Customers can disable any rule via the admin tab.
--
-- Self-audit (Arbeidstilsynet POV)
--   No new pålegg-grunn; the rules add operational reliability around the
--   existing AML § 7-2 obligations (innkalling, vedtak-oppfølging,
--   kontinuitet i utvalget).

set local search_path = public, pg_catalog;

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  description, rationale, source_module, trigger_type, trigger_event_name,
  schedule_cron, trigger_on, condition_json, actions_json, law_refs,
  frameworks, pdca_phase, applies_if_employee_count_gte, enabled, notes
) values

(
  'meetings-scheduled-chair-prep-reminder',
  'AML', 'Kap. 7 — AMU og verneombud', 7, 'AML § 7-2 — Innkalling og forberedelse',
  'Når et møte planlegges → oppgave til møteleder: bekreft innkalling og agenda er klart minst 7 dager før.',
  'AML § 7-2 forutsetter at AMU-medlemmer har reell forberedelsestid. Forskrift om org. ledelse § 3-16 forutsetter referatkrav og dermed at agenda er distribuert i forveien. Denne regelen fanger opp møter som er planlagt men hvor innkalling ennå ikke er registrert som sendt.',
  'meetings', 'db_event', 'ON_MEETING_SCHEDULED', null, 'insert',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Bekreft innkalling sendt: {{event.title}}","description":"Send innkalling og saksliste (anbefalt 7 dager før). Bruk «Send innkalling»-knappen i møtedetaljene for å registrere distribusjonen.","assignee":"{{event.createdByUserId}}","ownerRole":"HMS","dueInDays":-7,"module":"meetings","sourceType":"meeting_invitation_check"}
  ]'::jsonb,
  ARRAY['AML § 7-2'], ARRAY['aml-amu'], 'do', null, true,
  'dueInDays er negativ — oppgaven forfaller 7 dager *før* møtet (relativt scheduled_at).'
),

(
  'meetings-signed-schedule-next',
  'AML', 'Kap. 7 — AMU og verneombud', 7, 'AML § 7-2 — Kontinuitet i utvalget',
  'Når protokoll er signert → oppgave til sekretær: planlegg neste møte iht. malens cadence_hint.',
  'AML § 7-2 jf. forskrift § 3-16 forutsetter normalt 4 AMU-møter per år. Hvis neste møte ikke planlegges raskt etter forrige, mister utvalget rytmen — vanlig pålegg-grunn.',
  'meetings', 'db_event', 'ON_MEETING_SIGNED', null, 'update',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Planlegg neste {{event.meetingType}}-møte","description":"Forrige møte ble signert {{event.signedAt}}. Bruk «Nytt møte fra mal» i Møter-hubben for å sette opp neste møte iht. cadence på malen.","assignee":"{{event.protocolSignedBy}}","ownerRole":"AMU","dueInDays":14,"module":"meetings","sourceType":"meeting_next_in_cadence"}
  ]'::jsonb,
  ARRAY['AML § 7-2', 'Forskrift om org. ledelse § 3-16'], ARRAY['aml-amu'], 'do', null, true, null
),

(
  'meetings-decision-owner-task',
  'AML', 'Kap. 7 — AMU og verneombud', 7, 'AML § 7-2 (4) — Vedtak skal følges opp',
  'Når et vedtak logges → oppgave til ansvarlig medlem med møte-id slik at Vedtaksregister-visningen finner den.',
  'AML § 7-2 (4): «Utvalget skal hvert år avgi rapport om sin virksomhet …» Forutsetter sporbar vedtaks-oppfølging. Uten en oppgavekjede risikerer org å «glemme» åpne vedtak mellom møter.',
  'meetings', 'db_event', 'ON_MEETING_DECISION_LOGGED', null, 'insert',
  '{"match":"field_not_equals","path":"status","value":"dropped"}'::jsonb,
  '[
    {"type":"create_task","title":"Følg opp vedtak: {{event.decisionText}}","description":"Vedtak fra møte {{event.title}} ({{event.scheduledAt}}). Marker som «iverksatt» når oppfølging er fullført.","assignee":"{{event.ownerUserId}}","ownerRole":"AMU","dueInDays":30,"module":"meetings","sourceType":"meeting_decision_followup"}
  ]'::jsonb,
  ARRAY['AML § 7-2 (4)'], ARRAY['aml-amu'], 'do', null, true,
  'Eksisterende preset meetings.decision_to_tasks gjør samme jobben i workflowScope; denne system-regelen er den DB-seedede ekvivalenten slik at orgs uten egendefinert workflow likevel får oppfølging.'
)

on conflict (slug) do update set
  description = excluded.description,
  rationale = excluded.rationale,
  actions_json = excluded.actions_json,
  condition_json = excluded.condition_json,
  law_refs = excluded.law_refs,
  notes = excluded.notes,
  updated_at = now();
