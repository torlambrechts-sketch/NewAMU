-- Meetings · drop bogus "Forskrift om org. ledelse § 3-2" citation from
-- innkalling-related preparation-checklist items.
--
-- Why
--   Live lovdata verification (specs/meetings-lovdata-verification.md §3)
--   confirmed twice that § 3-2 of Forskrift om organisering, ledelse og
--   medvirkning does NOT specify a 7-day innkallingsfrist — § 3-2 is about
--   *valg av verneombud*. § 3-16 covers AMU saksbehandling but also has no
--   notice-period clause. The 7-day rule is convention + tariff, not lov.
--
--   The H1 fix migration 20260901120040 stripped this citation from the
--   four legacy AMU templates (q1/q2/q3/arsrapport-q4). The later
--   consolidate migration 20260904120000 re-introduced it on the new
--   `amu-mote` template (line 85). This migration is the defensive
--   cleanup pass: any preparationChecklist item that still cites
--   § 3-2 is re-labelled honestly and the lawRef is dropped.
--
-- Self-audit (Arbeidstilsynet POV)
--   No pålegg-grunn removed — only an inaccurate legal reference fixed.
--   The 7-day default (definition.invitationLeadDays = 7) is unchanged.

set local search_path = public, pg_catalog;

do $$
declare
  v_row record;
  v_idx int;
  v_items jsonb;
  v_item jsonb;
  v_changed boolean;
begin
  for v_row in
    select id, definition
    from public.meeting_system_templates
    where definition ? 'preparationChecklist'
      and exists (
        select 1
        from jsonb_array_elements(definition->'preparationChecklist') x
        where x->>'lawRef' = 'Forskrift om org. ledelse § 3-2'
      )
  loop
    v_items := v_row.definition->'preparationChecklist';
    v_changed := false;
    for v_idx in 0 .. jsonb_array_length(v_items) - 1 loop
      v_item := v_items->v_idx;
      if v_item->>'lawRef' = 'Forskrift om org. ledelse § 3-2' then
        v_item := (v_item - 'lawRef')
                  || jsonb_build_object(
                       'label',
                       'Innkalling og saksliste sendt minst 7 dager før møtet (anbefalt for god medvirkning)'
                     );
        v_items := jsonb_set(v_items, array[v_idx::text], v_item, false);
        v_changed := true;
      end if;
    end loop;
    if v_changed then
      update public.meeting_system_templates
      set definition = jsonb_set(definition, '{preparationChecklist}', v_items, false),
          updated_at = now()
      where id = v_row.id;
    end if;
  end loop;
end $$;

-- Same defensive cleanup on per-org custom templates (rare but possible
-- if an admin copied a system template post-regression).
do $$
declare
  v_row record;
  v_idx int;
  v_items jsonb;
  v_item jsonb;
  v_changed boolean;
begin
  for v_row in
    select id, definition
    from public.meeting_org_templates
    where definition ? 'preparationChecklist'
      and exists (
        select 1
        from jsonb_array_elements(definition->'preparationChecklist') x
        where x->>'lawRef' = 'Forskrift om org. ledelse § 3-2'
      )
  loop
    v_items := v_row.definition->'preparationChecklist';
    v_changed := false;
    for v_idx in 0 .. jsonb_array_length(v_items) - 1 loop
      v_item := v_items->v_idx;
      if v_item->>'lawRef' = 'Forskrift om org. ledelse § 3-2' then
        v_item := (v_item - 'lawRef')
                  || jsonb_build_object(
                       'label',
                       'Innkalling og saksliste sendt minst 7 dager før møtet (anbefalt for god medvirkning)'
                     );
        v_items := jsonb_set(v_items, array[v_idx::text], v_item, false);
        v_changed := true;
      end if;
    end loop;
    if v_changed then
      update public.meeting_org_templates
      set definition = jsonb_set(definition, '{preparationChecklist}', v_items, false),
          updated_at = now()
      where id = v_row.id;
    end if;
  end loop;
end $$;
