-- W0.1 — extend the action enum with verbs needed by W1..W5 modules.
-- One migration adds them all so per-module migrations stay focused
-- on wiring. See specs/endringslogg-rollout-plan.md §3.2.

alter table public.audit_events
  drop constraint if exists audit_events_action_check;

alter table public.audit_events
  add constraint audit_events_action_check check (action in (
    -- v1 (already shipped)
    'opprettet','endret','lukket','gjenapnet',
    'tildelt','omfordelt','kommentert',
    'signert','attestert','avvist','godkjent',
    'lastet_opp_vedlegg','slettet_vedlegg',
    'versjon_bumpet','eskalert',
    'eksportert','delt','arkivert',
    -- W0 additions
    'besvart',          -- survey: response submitted
    'publisert',        -- documents/learning/survey: draft → live
    'protokollert',     -- meetings: protokoll finalised
    'votert',           -- meetings: vote cast
    'innkalt',          -- meetings: invitation sent
    'mottatt',          -- alerts: case created
    'fullfort',         -- learning: course completion (no 'ø' in DB enum — keep ASCII)
    'slettet_kommentar' -- comment delete (previously mis-mapped to 'endret')
  ));
