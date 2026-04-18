-- Default page layout for HSE → Inspeksjoner (inspeksjonsrunder).
-- Matches app default: pageHeading1, kpiInfoBoxes (3), actions, table + calendar (2/3 + 1/3).
-- Idempotent: only inserts when no row exists for hse.inspections.

insert into public.page_layouts (page_key, sections, published)
select
  'hse.inspections',
  '[
    {
      "id": "ins-s0",
      "preset": "full",
      "label": "Overskrift",
      "cols": [
        {
          "id": "ins-c0",
          "blocks": [
            {
              "id": "ins-b0",
              "blockId": "pageHeading1",
              "visible": true,
              "textOverride": {
                "title": "Inspeksjonsrunder",
                "description": "",
                "breadcrumb": ""
              }
            }
          ]
        }
      ]
    },
    {
      "id": "ins-s1",
      "preset": "split-2-1",
      "label": "Nøkkeltall og handlinger",
      "cols": [
        {
          "id": "ins-c1",
          "blocks": [
            {
              "id": "ins-b1",
              "blockId": "kpiInfoBoxes",
              "visible": true,
              "blockProps": { "boxCount": 3 }
            }
          ]
        },
        {
          "id": "ins-c2",
          "blocks": [
            { "id": "ins-b2", "blockId": "workplaceTasksActions", "visible": true }
          ]
        }
      ]
    },
    {
      "id": "ins-s2",
      "preset": "split-2-1",
      "label": "Tabell og kalender",
      "cols": [
        {
          "id": "ins-c3",
          "blocks": [
            {
              "id": "ins-b3",
              "blockId": "table1",
              "visible": true,
              "textOverride": {
                "title": "Inspeksjonsrunder",
                "description": "Gjennomførte og kommende runder — sortert etter tidspunkt. Bruk statusfilter og søk."
              }
            }
          ]
        },
        {
          "id": "ins-c4",
          "blocks": [
            { "id": "ins-b4", "blockId": "vernerunderScheduleCalendar", "visible": true }
          ]
        }
      ]
    }
  ]'::jsonb,
  true
where not exists (
  select 1 from public.page_layouts pl where pl.page_key = 'hse.inspections'
);
