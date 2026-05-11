-- Meetings — citation-only template fixes (H1).
--
-- Why
--   The lovdata verification log (specs/meetings-lovdata-verification.md)
--   confirmed five sub-letter citation errors plus two factually wrong
--   forskrift references in the seed templates:
--     * AML § 7-2 (2) bokstav-mappings: vernerunder/sykefravar/opplaering
--       in Q1, arbeidsmiljoundersokelse in Q2, sykefravar_arsstats in Q4
--       all cited the wrong bokstav.
--     * Forskrift om org. ledelse § 3-4 was cited as the source of
--       AMU-årsrapport content — verified false; § 3-4 is about
--       verneombudets funksjonstid.
--     * Forskrift om org. ledelse § 3-2 was cited as the source of the
--       7-day innkallingsfrist — verified false; § 3-2 covers valg av
--       verneombud, and no 7-day rule appears anywhere in lov or
--       forskrift. The rule remains as a best-practice default but the
--       legal citation is dropped.
--     * ISO 9001:2015 § 9.3.2 audit_results was labelled c.5 — should
--       be c.6.
--
-- Strategy
--   Surgical UPDATE + jsonb_set per affected agenda item / checklist row.
--   Idempotent: re-running on already-corrected rows is a no-op.
--   Definitions are otherwise untouched so org-side override JSONs in
--   meeting_org_template_settings stay valid.
--
-- Self-audit (Arbeidstilsynet POV)
--   * Correct citations matter for AMU pålegg-grunner. A meeting whose
--     protokoll cites § 7-2 (2) bokstav c for sykefravær would invite an
--     inspector to ask "where is your § 18-9-sak?" — confusing and weak.
--   * Removing the bogus forskrift § 3-2 / § 3-4 references protects the
--     org from misleading inspector dialogue ("show me where this 7-day
--     rule comes from"). Best-practice notice remains by default.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. AML § 7-2 (2) sub-letter corrections                                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Q1 fixes: vernerunder → AML § 6-2; sykefravar → AML § 7-2 første ledd;
--           opplaering → AML § 7-2 (2) bokstav b.
update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(
        jsonb_set(
          definition,
          '{agendaItems,1,lawRef}',
          '"AML § 6-2"'::jsonb
        ),
        '{agendaItems,2,lawRef}',
        '"AML § 7-2 første ledd"'::jsonb
      ),
      '{agendaItems,3,lawRef}',
      '"AML § 7-2 (2) bokstav b"'::jsonb
    ),
    updated_at = now()
where id = 'amu-kvartalsmote-q1';

-- Q2 fix: arbeidsmiljoundersokelse → AML § 7-2 (2) bokstav e (HMS-system),
--         not bokstav d (planer).
update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,1,lawRef}',
      '"AML § 7-2 (2) bokstav e"'::jsonb
    ),
    updated_at = now()
where id = 'amu-kvartalsmote-q2';

-- Q4 fix: sykefravar_arsstats → AML § 7-2 første ledd
--         (same correction as Q1 sykefravar).
update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,4,lawRef}',
      '"AML § 7-2 første ledd"'::jsonb
    ),
    updated_at = now()
where id = 'amu-arsrapport-q4';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Drop "Forskrift om org. ledelse § 3-4" from amu-arsrapport-q4        │
-- │    (the § 3-4 cited is about verneombudets funksjonstid, not årsrapport)│
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set law_refs = array_remove(law_refs, 'Forskrift om org. ledelse § 3-4'),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and 'Forskrift om org. ledelse § 3-4' = any(law_refs);

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Re-label "Forskrift om org. ledelse § 3-2" innkallings-references     │
-- │    The 7-day rule is best-practice, not lov-grunnet. Keep the 7-day      │
-- │    default (invitationLeadDays remains in definition) but drop the       │
-- │    bogus forskrift citation from the preparationChecklist label + lawRef.│
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Templates that have the wrong § 3-2 reference in preparationChecklist[0].
-- Each is the standard "Innkalling og saksliste sendt minst 7 dager før møtet"
-- item. Re-label + drop the lawRef field via jsonb_set + minus-operator.
do $$
declare
  v_template_id text;
  v_template_ids text[] := array[
    'amu-kvartalsmote-q1',
    'amu-kvartalsmote-q2',
    'amu-kvartalsmote-q3',
    'amu-arsrapport-q4'
  ];
begin
  foreach v_template_id in array v_template_ids loop
    update public.meeting_system_templates
    set definition =
        jsonb_set(
          definition,
          '{preparationChecklist,0}',
          (definition->'preparationChecklist'->0)
            - 'lawRef'
            || jsonb_build_object(
              'label',
              'Innkalling og saksliste sendt minst 7 dager før møtet (anbefalt for god medvirkning)'
            )
        ),
        updated_at = now()
    where id = v_template_id
      and (definition->'preparationChecklist'->0->>'lawRef') = 'Forskrift om org. ledelse § 3-2';
  end loop;
end $$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. ISO 9001:2015 § 9.3.2 — audit_results was labelled c.5; should be c.6 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,5,lawRef}',
      '"ISO 9001:2015 § 9.3.2 c.6"'::jsonb
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and (definition->'agendaItems'->5->>'key') = 'audit_results';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. Verification queries — run by hand after applying to confirm.         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- expected: 'AML § 6-2'
-- select definition->'agendaItems'->1->>'lawRef' from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 'AML § 7-2 første ledd'
-- select definition->'agendaItems'->2->>'lawRef' from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 'AML § 7-2 (2) bokstav b'
-- select definition->'agendaItems'->3->>'lawRef' from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 'AML § 7-2 (2) bokstav e'
-- select definition->'agendaItems'->1->>'lawRef' from public.meeting_system_templates where id = 'amu-kvartalsmote-q2';

-- expected: 'AML § 7-2 første ledd'
-- select definition->'agendaItems'->4->>'lawRef' from public.meeting_system_templates where id = 'amu-arsrapport-q4';

-- expected: array without 'Forskrift om org. ledelse § 3-4'
-- select law_refs from public.meeting_system_templates where id = 'amu-arsrapport-q4';

-- expected: label without "iht. Forskrift" and lawRef is NULL
-- select definition->'preparationChecklist'->0 from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 'ISO 9001:2015 § 9.3.2 c.6'
-- select definition->'agendaItems'->5->>'lawRef' from public.meeting_system_templates where id = 'iso-9001-ledelsens-gjennomgang';
