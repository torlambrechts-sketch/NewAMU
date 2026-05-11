-- Meetings — mandatory-flag honesty pass (H2b).
--
-- Why
--   The H0 verification log called out that several agenda items in
--   `allmote`, `personalmote`, and `mus` carry `isMandatory: true` with
--   a generic AML § 4-2 / § 4-3 citation, but AML does not legally
--   mandate the *form* of these meetings — only the underlying
--   medvirkning / psykososialt arbeidsmiljø obligations at workplace
--   level. Marking items as mandatory when they aren't lov-grunnet
--   misleads auditors and inflates the mandatory-topics gap detector.
--
--   This migration flips those flags to `isMandatory: false` and adds
--   a `recommended: true` field so the UI can still surface them as
--   "anbefalt" without claiming legal force.
--
--   `mus.varsling` is kept mandatory but its lawRef corrected from
--   § 2A-7 (taushetsplikt) to § 2A-3 (rutiner finnes — kjennskap)
--   which is the actual legal hook for "ansatte skal kjenne
--   varslingsrutinene".
--
-- Strategy
--   Idempotent jsonb_set with WHERE guard on current isMandatory state.
--   The `recommended` field is added regardless of prior state.
--
-- Self-audit (Arbeidstilsynet POV)
--   * Honest framing protects the org during inspection — inspectors
--     don't see false "lov-pålagte" claims they can challenge.
--   * The mandatory-topics gap detector in MeetingsDetailView now only
--     warns on items that are truly lov-grunnet, so the warning means
--     something.

set local search_path = public, pg_catalog;

-- Helper: flip isMandatory false + add recommended true at a given path.
-- (Inlined per-item for readability; SQL is repetitive but reviewable.)

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ allmote — items at index 2 (hms) + 3 (sporsmal)                          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,2,isMandatory}', 'false'::jsonb),
      '{agendaItems,2,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'allmote'
  and (definition->'agendaItems'->2->>'key') = 'hms';

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,3,isMandatory}', 'false'::jsonb),
      '{agendaItems,3,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'allmote'
  and (definition->'agendaItems'->3->>'key') = 'sporsmal';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ personalmote — item at index 1 (hms)                                     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,1,isMandatory}', 'false'::jsonb),
      '{agendaItems,1,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'personalmote'
  and (definition->'agendaItems'->1->>'key') = 'hms';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ mus — items 0 (trivsel), 1 (mal), 2 (utvikling), 3 (hms)                 │
-- │  + lawRef correction on item 4 (varsling): § 2A-7 → § 2A-3                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,0,isMandatory}', 'false'::jsonb),
      '{agendaItems,0,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->0->>'key') = 'trivsel';

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,1,isMandatory}', 'false'::jsonb),
      '{agendaItems,1,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->1->>'key') = 'mal';

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,2,isMandatory}', 'false'::jsonb),
      '{agendaItems,2,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->2->>'key') = 'utvikling';

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,3,isMandatory}', 'false'::jsonb),
      '{agendaItems,3,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->3->>'key') = 'hms';

-- mus.varsling stays mandatory, but lawRef is corrected:
-- § 2A-7 is taushetsplikt (about case-handling); the obligation that
-- ansatte SKAL kjenne varslingsrutinene is § 2A-3 + § 2A-4. Use § 2A-3.
update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,4,lawRef}',
      '"AML § 2A-3"'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->4->>'key') = 'varsling'
  and (definition->'agendaItems'->4->>'lawRef') = 'AML § 2A-7';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Update mus.law_refs: drop § 2A-7, add § 2A-3                             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set law_refs =
    array(
      select distinct unnest(
        array_remove(law_refs, 'AML § 2A-7') || array['AML § 2A-3']
      )
    ),
    updated_at = now()
where id = 'mus'
  and ('AML § 2A-7' = any(law_refs) or not ('AML § 2A-3' = any(law_refs)));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Verification queries                                                     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- expected: allmote.hms.isMandatory=false, recommended=true
-- select definition->'agendaItems'->2 from public.meeting_system_templates where id = 'allmote';

-- expected: personalmote.hms.isMandatory=false, recommended=true
-- select definition->'agendaItems'->1 from public.meeting_system_templates where id = 'personalmote';

-- expected: mus.trivsel/mal/utvikling/hms.isMandatory=false, recommended=true
-- expected: mus.varsling.lawRef='AML § 2A-3' (still mandatory)
-- select definition->'agendaItems' from public.meeting_system_templates where id = 'mus';
