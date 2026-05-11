-- Meetings — likestilling cadence content fix (H5).
--
-- Why
--   H0 verification confirmed Likestillings- og diskrimineringsloven
--   § 26 mandates lønnskartlegging "annethvert år" (every other year),
--   not annually. The current `drofting-likestilling` template's
--   cadence_hint='annual' is correct for the møte (most orgs hold a
--   yearly drøftingsmøte), but the lønnskartlegging-related agenda
--   items needed to surface the biennial nature explicitly. Otherwise
--   organisations risk:
--    * Over-reporting: thinking they need fresh lønnskartlegging-data
--      every year (wasted effort).
--    * Under-reporting: thinking the entire redegjørelse is biennial
--      (failing the annual redegjørelsesplikt).
--
--   The annual redegjørelse (§ 26 a) stays mandatory; the
--   lønnskartlegging *kartlegging* step in § 26 second paragraph
--   bokstav a is the only piece that is biennial.
--
-- Strategy
--   Content-level UPDATEs to title + description on the affected
--   items. No schema additions; no new fields.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ drofting-likestilling.preparationChecklist[1] lonnskartlegging           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{preparationChecklist,1,label}',
      '"Lønnskartlegging gjennomført (annethvert år iht. § 26 andre ledd bokstav a)"'::jsonb
    ),
    updated_at = now()
where id = 'drofting-likestilling'
  and (definition->'preparationChecklist'->1->>'key') = 'lonnskartlegging';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ drofting-likestilling.agendaItems[1] lonnskartlegging — title + desc     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(
        definition,
        '{agendaItems,1,title}',
        '"Lønnskartlegging — kjønnsforskjeller (annethvert år)"'::jsonb
      ),
      '{agendaItems,1,description}',
      '"Behandling av siste lønnskartlegging. Likestillings- og diskrimineringsloven § 26 andre ledd bokstav a krever ny kartlegging annethvert år. Bekreft i protokollen om dette er kartleggingsår eller ikke-kartleggingsår."'::jsonb
    ),
    updated_at = now()
where id = 'drofting-likestilling'
  and (definition->'agendaItems'->1->>'key') = 'lonnskartlegging';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Add an explicit annual-redegjørelse marker on agendaItems[5] redegjorelse│
-- │ (description clarifies the redegjørelsesplikt IS annual, distinct from    │
-- │ the biennial kartlegging-step).                                          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,5,description}',
      '"Vedtak om endelig redegjørelse til årsberetning. Redegjørelsesplikten (§ 26a) er årlig — uavhengig av om lønnskartleggingen er gjennomført i år eller ikke."'::jsonb
    ),
    updated_at = now()
where id = 'drofting-likestilling'
  and (definition->'agendaItems'->5->>'key') = 'redegjorelse';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Add ufrivillig deltidsarbeid kartlegging                                  │
-- │ (also part of § 26 andre ledd bokstav a, often forgotten)                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'ufrivillig_deltid',
          'title', 'Ufrivillig deltidsarbeid — kartlegging (annethvert år)',
          'description', 'Likestillings- og diskrimineringsloven § 26 andre ledd bokstav a krever også kartlegging av ufrivillig deltidsarbeid annethvert år, sammen med lønnskartleggingen.',
          'isMandatory', true,
          'lawRef', 'Likestillings- og diskrimineringsloven § 26 andre ledd bokstav a',
          'defaultPosition', 25
        )
      )
    ),
    updated_at = now()
where id = 'drofting-likestilling'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "ufrivillig_deltid")');

-- Verification:
-- select definition->'agendaItems' from public.meeting_system_templates where id = 'drofting-likestilling';
