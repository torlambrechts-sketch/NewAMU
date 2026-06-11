-- OKR review agenda item on meeting templates (H2.2)
--
-- Gap closed: the meetings module had zero connection to strategy — OKRs
-- were never reviewed in any governance rhythm. This appends an
-- «OKR-gjennomgang» agenda item (dataBinding source 'okr_status', resolved
-- by useMeetingDataBindings) to the 1:1 template (mus) and the three AMU
-- kvartalsmøter. New meetings created from these templates snapshot the
-- item; the Datapakke tab renders live KR health with in-meeting check-in.
--
-- Self-audit (Arbeidstilsynet POV): systematic review of HMS goals in
-- established fora (AML § 3-1 (2) h — systematisk overvåking av
-- arbeidsmiljøet). Restrisiko: existing meetings keep their old snapshot
-- (by design — snapshots are immutable); meeting_system_templates_locales
-- (en) not patched — the app reads the nb base definition today.

set local search_path = public, pg_catalog;

-- Append the okr_review item to a template's agendaItems unless a key
-- 'okr_review' already exists (idempotent re-run safe).
do $$
declare
  v_tpl text;
  v_item jsonb := jsonb_build_object(
    'key', 'okr_review',
    'title', 'OKR-gjennomgang — mål og nøkkelresultater',
    'description', 'Gjennomgå nøkkelresultatene fra strategiplanen: fremdrift, tillit og blokkeringer. Sjekk inn per KR — innsjekken protokollføres med møtereferanse.',
    'lawRef', 'AML § 3-1',
    'isMandatory', false,
    'recommended', true,
    'defaultPosition', 95,
    'defaultDurationMinutes', 15,
    'dataBinding', jsonb_build_object(
      'source', 'okr_status',
      'window', 'current',
      'presentation', 'table'
    )
  );
begin
  foreach v_tpl in array array[
    'mus',
    'amu-kvartalsmote-q1',
    'amu-kvartalsmote-q2',
    'amu-kvartalsmote-q3'
  ]
  loop
    update public.meeting_system_templates
       set definition = jsonb_set(
             definition,
             '{agendaItems}',
             coalesce(definition->'agendaItems', '[]'::jsonb) || v_item
           ),
           updated_at = now()
     where id = v_tpl
       and not exists (
         select 1
           from jsonb_array_elements(coalesce(definition->'agendaItems', '[]'::jsonb)) ai
          where ai->>'key' = 'okr_review'
       );
  end loop;
end$$;
