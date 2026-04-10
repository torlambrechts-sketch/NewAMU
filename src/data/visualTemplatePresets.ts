import { newBlockId, emptyRootBlock, type VisualBlock, type VisualTemplate, type VisualTemplateSource } from '../types/visualTemplate'

function now(): string {
  return new Date().toISOString()
}

function makeTemplate(source: VisualTemplateSource, name: string, presetKey: string, root: VisualBlock): VisualTemplate {
  const t = now()
  return {
    id: crypto.randomUUID(),
    name,
    source,
    presetKey,
    root,
    createdAt: t,
    updatedAt: t,
  }
}

const card = (title: string, body: string): VisualBlock => ({
  id: newBlockId(),
  type: 'container',
  className: 'rounded-lg border border-neutral-200/80 bg-white p-4 shadow-sm',
  children: [
    { id: newBlockId(), type: 'heading', text: title, headingLevel: 3 },
    { id: newBlockId(), type: 'text', text: body, className: 'mt-2 text-sm text-neutral-600' },
    { id: newBlockId(), type: 'button', text: 'View template', className: 'mt-3 w-full' },
  ],
})

/** Pinpoint-style reference presets */
export const PINPOINT_PRESET_KEYS = [
  'library',
  'scorecard',
  'detail',
  'list',
  'dash',
  'dash2',
] as const

export function createPinpointPreset(key: (typeof PINPOINT_PRESET_KEYS)[number]): VisualTemplate {
  switch (key) {
    case 'library':
      return makeTemplate('pinpoint', 'Malbibliotek', 'library', {
        id: newBlockId(),
        type: 'row',
        flexGap: '24px',
        flexWrap: true,
        alignItems: 'flex-start',
        children: [
          {
            id: newBlockId(),
            type: 'column',
            flexGap: '12px',
            className: 'w-full min-w-[200px] max-w-sm',
            style: { flex: '0 0 auto' },
            children: [
              { id: newBlockId(), type: 'input', inputType: 'search', placeholder: 'Search…' },
              { id: newBlockId(), type: 'heading', text: 'Filter by tags', headingLevel: 4, className: 'text-[10px] uppercase' },
              { id: newBlockId(), type: 'text', text: 'Metrics · Role types · Workflow', className: 'text-xs text-neutral-500' },
            ],
          },
          {
            id: newBlockId(),
            type: 'column',
            flexGap: '16px',
            className: 'min-w-0 flex-1',
            children: [
              {
                id: newBlockId(),
                type: 'row',
                flexGap: '12px',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                children: [
                  { id: newBlockId(), type: 'heading', text: 'Template Library', headingLevel: 1, className: 'font-serif text-2xl' },
                  { id: newBlockId(), type: 'button', text: 'Edit', className: 'text-xs' },
                ],
              },
              {
                id: newBlockId(),
                type: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gridGap: '16px',
                children: [
                  card('Auto-tag applications', 'Tag candidates from screening answers.'),
                  card('Interview reminders', '24h before — reduce no-shows.'),
                  card('Referral routing', 'Fast-track with SLA timers.'),
                  card('Slack scorecards', 'Post summaries to a channel.'),
                ],
              },
            ],
          },
        ],
      })
    case 'scorecard':
      return makeTemplate('pinpoint', 'Scorecard-side', 'scorecard', {
        id: newBlockId(),
        type: 'column',
        flexGap: '16px',
        children: [
          { id: newBlockId(), type: 'text', text: 'Jobs › Role › Scorecard ratings', className: 'text-xs text-neutral-500' },
          {
            id: newBlockId(),
            type: 'row',
            flexGap: '12px',
            flexWrap: true,
            justifyContent: 'space-between',
            children: [
              { id: newBlockId(), type: 'heading', text: 'Software Engineer (Internal)', headingLevel: 1, className: 'font-serif' },
              { id: newBlockId(), type: 'row', flexGap: '8px', children: [
                { id: newBlockId(), type: 'text', text: 'INTERNAL', className: 'text-xs uppercase text-orange-700' },
                { id: newBlockId(), type: 'text', text: 'OPEN', className: 'text-xs uppercase text-emerald-700' },
              ]},
            ],
          },
          { id: newBlockId(), type: 'text', text: '[Menylinje: Candidates · Scorecards · …]', className: 'rounded bg-emerald-900/10 px-3 py-2 text-sm text-emerald-900' },
          {
            id: newBlockId(),
            type: 'row',
            flexGap: '12px',
            flexWrap: true,
            className: 'rounded-lg p-3',
            style: { backgroundColor: '#EFE8DC' },
            children: [
              { id: newBlockId(), type: 'input', placeholder: 'Stage', className: 'flex-1 min-w-[120px]' },
              { id: newBlockId(), type: 'input', placeholder: 'Sort', className: 'flex-1 min-w-[120px]' },
              { id: newBlockId(), type: 'button', text: 'Export' },
            ],
          },
          {
            id: newBlockId(),
            type: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gridGap: '16px',
            children: [
              {
                id: newBlockId(),
                type: 'container',
                className: 'rounded-lg border bg-white p-4',
                children: [
                  { id: newBlockId(), type: 'heading', text: 'Candidate A', headingLevel: 3 },
                  { id: newBlockId(), type: 'text', text: 'Overall 73%', className: 'text-2xl font-bold text-emerald-800' },
                  { id: newBlockId(), type: 'divider' },
                  { id: newBlockId(), type: 'text', text: 'Skills · progress rows (demo)', className: 'text-sm text-neutral-600' },
                ],
              },
              {
                id: newBlockId(),
                type: 'container',
                className: 'rounded-lg border bg-white p-4',
                children: [
                  { id: newBlockId(), type: 'heading', text: 'Candidate B', headingLevel: 3 },
                  { id: newBlockId(), type: 'text', text: 'Overall 81%', className: 'text-2xl font-bold text-emerald-800' },
                ],
              },
            ],
          },
        ],
      })
    case 'detail':
      return makeTemplate('pinpoint', 'Kandidatdetalj', 'detail', {
        id: newBlockId(),
        type: 'column',
        flexGap: '12px',
        children: [
          { id: newBlockId(), type: 'text', text: 'Breadcrumb path…', className: 'text-xs text-neutral-500' },
          { id: newBlockId(), type: 'heading', text: 'Software Developer', headingLevel: 1, className: 'font-serif' },
          {
            id: newBlockId(),
            type: 'row',
            flexGap: '0',
            className: 'overflow-hidden rounded-lg border bg-white',
            children: [
              {
                id: newBlockId(),
                type: 'column',
                className: 'w-48 shrink-0 border-r p-2',
                style: { backgroundColor: '#EDE4D3' },
                children: [
                  { id: newBlockId(), type: 'text', text: 'Application', className: 'px-2 py-2 text-sm font-medium border-l-2 border-emerald-800' },
                  { id: newBlockId(), type: 'text', text: 'Résumé', className: 'px-2 py-2 text-sm text-neutral-600' },
                  { id: newBlockId(), type: 'text', text: 'Scorecards', className: 'px-2 py-2 text-sm text-neutral-600' },
                ],
              },
              {
                id: newBlockId(),
                type: 'column',
                flexGap: '8px',
                className: 'min-w-0 flex-1 p-6',
                children: [
                  { id: newBlockId(), type: 'heading', text: 'Application', headingLevel: 2 },
                  { id: newBlockId(), type: 'text', text: 'First name · Taneka', className: 'border-b py-2 text-sm' },
                  { id: newBlockId(), type: 'text', text: 'Email · taneka@…', className: 'border-b py-2 text-sm' },
                ],
              },
            ],
          },
        ],
      })
    case 'list':
      return makeTemplate('pinpoint', 'Kandidatliste', 'list', {
        id: newBlockId(),
        type: 'column',
        flexGap: '12px',
        children: [
          {
            id: newBlockId(),
            type: 'row',
            flexWrap: true,
            flexGap: '8px',
            children: [
              { id: newBlockId(), type: 'container', className: 'rounded border bg-white px-3 py-2 text-center', children: [
                { id: newBlockId(), type: 'text', text: '12', className: 'text-lg font-bold' },
                { id: newBlockId(), type: 'text', text: 'All', className: 'text-[10px] uppercase' },
              ]},
              { id: newBlockId(), type: 'container', className: 'rounded border-2 border-t-4 border-emerald-800 bg-white px-3 py-2', children: [
                { id: newBlockId(), type: 'text', text: '9', className: 'text-lg font-bold' },
                { id: newBlockId(), type: 'text', text: 'Applied', className: 'text-[10px] uppercase' },
              ]},
            ],
          },
          { id: newBlockId(), type: 'input', inputType: 'search', placeholder: 'Search candidates…' },
          {
            id: newBlockId(),
            type: 'container',
            className: 'rounded-lg border bg-white p-4',
            children: [
              { id: newBlockId(), type: 'heading', text: 'Table (Name · Stage · Applied)', headingLevel: 4 },
              { id: newBlockId(), type: 'text', text: 'Rediger celler under — dra rader for rekkefølge.', className: 'text-sm text-neutral-500' },
            ],
          },
        ],
      })
    case 'dash':
      return makeTemplate('pinpoint', 'Dashboard 70/30', 'dash', {
        id: newBlockId(),
        type: 'row',
        flexGap: '24px',
        flexWrap: true,
        alignItems: 'flex-start',
        children: [
          {
            id: newBlockId(),
            type: 'column',
            flexGap: '16px',
            className: 'min-w-0 flex-1',
            style: { flex: '1 1 60%', minWidth: '280px' },
            children: [
              { id: newBlockId(), type: 'heading', text: 'Welcome back', headingLevel: 1, className: 'font-serif' },
              {
                id: newBlockId(),
                type: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gridGap: '12px',
                children: [
                  {
                    id: newBlockId(),
                    type: 'container',
                    className: 'rounded-lg border p-4',
                    style: { backgroundColor: '#EFE8DC' },
                    children: [
                      { id: newBlockId(), type: 'text', text: '28', className: 'text-3xl font-bold' },
                      { id: newBlockId(), type: 'text', text: 'New applications', className: 'text-sm' },
                    ],
                  },
                  {
                    id: newBlockId(),
                    type: 'container',
                    className: 'rounded-lg border p-4',
                    style: { backgroundColor: '#EFE8DC' },
                    children: [
                      { id: newBlockId(), type: 'text', text: '12', className: 'text-3xl font-bold' },
                      { id: newBlockId(), type: 'text', text: 'Open jobs', className: 'text-sm' },
                    ],
                  },
                ],
              },
              { id: newBlockId(), type: 'container', className: 'rounded-lg border bg-white p-4', children: [
                { id: newBlockId(), type: 'heading', text: 'Latest jobs', headingLevel: 3 },
                { id: newBlockId(), type: 'text', text: 'List items…', className: 'text-sm text-neutral-600' },
              ]},
            ],
          },
          {
            id: newBlockId(),
            type: 'column',
            flexGap: '12px',
            className: 'w-full lg:w-80',
            children: [
              {
                id: newBlockId(),
                type: 'container',
                className: 'rounded-lg border bg-white p-4',
                children: [
                  { id: newBlockId(), type: 'heading', text: 'Interviews', headingLevel: 4, className: 'text-xs uppercase' },
                  { id: newBlockId(), type: 'text', text: 'Mini calendar + next meeting', className: 'text-sm' },
                ],
              },
              {
                id: newBlockId(),
                type: 'container',
                className: 'rounded-lg border bg-white p-4',
                children: [
                  { id: newBlockId(), type: 'heading', text: 'Notifications', headingLevel: 4, className: 'text-xs uppercase' },
                  { id: newBlockId(), type: 'text', text: 'Unread list…', className: 'text-sm' },
                ],
              },
            ],
          },
        ],
      })
    case 'dash2':
    default:
      return makeTemplate('pinpoint', 'Dashboard kompakt', 'dash2', {
        id: newBlockId(),
        type: 'column',
        flexGap: '16px',
        children: [
          { id: newBlockId(), type: 'heading', text: 'Dashboard', headingLevel: 1, className: 'font-serif' },
          {
            id: newBlockId(),
            type: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gridGap: '12px',
            children: [
              {
                id: newBlockId(),
                type: 'container',
                className: 'rounded border p-4',
                style: { backgroundColor: '#EFE8DC' },
                children: [
                  { id: newBlockId(), type: 'text', text: '24', className: 'text-2xl font-bold' },
                  { id: newBlockId(), type: 'text', text: 'Active pipelines', className: 'text-sm' },
                ],
              },
              {
                id: newBlockId(),
                type: 'container',
                className: 'rounded border p-4',
                style: { backgroundColor: '#EFE8DC' },
                children: [
                  { id: newBlockId(), type: 'text', text: '18', className: 'text-2xl font-bold' },
                  { id: newBlockId(), type: 'text', text: 'Interviews', className: 'text-sm' },
                ],
              },
            ],
          },
          { id: newBlockId(), type: 'container', className: 'rounded-lg border bg-white p-4', children: [
            { id: newBlockId(), type: 'heading', text: 'Candidates by stage', headingLevel: 3 },
            { id: newBlockId(), type: 'text', text: 'Bar rows — rediger tekst og farger per blokk.', className: 'text-sm text-neutral-600' },
          ]},
        ],
      })
  }
}

export const ADVANCED_PRESET_KEYS = [
  'job_cards',
  'candidates_table',
  'scorecard_compare',
  'insight_tasks',
  'charts',
  'survey',
  'reports_catalog',
  'insight_pages',
  'widget_dashboard',
] as const

const advancedNames: Record<(typeof ADVANCED_PRESET_KEYS)[number], string> = {
  job_cards: 'Stillingskort',
  candidates_table: 'Kandidater tabell',
  scorecard_compare: 'Scorecard sammenligning',
  insight_tasks: 'Innsikt oppgaver',
  charts: 'Grafer og diagrammer',
  survey: 'Undersøkelse',
  reports_catalog: 'Rapportkatalog',
  insight_pages: 'Innsikt-sider',
  widget_dashboard: 'Widget-dashboard',
}

export function createAdvancedPreset(key: (typeof ADVANCED_PRESET_KEYS)[number]): VisualTemplate {
  const baseColumn = (title: string, hint: string, extra?: VisualBlock[]): VisualTemplate =>
    makeTemplate('advanced', advancedNames[key], key, {
      id: newBlockId(),
      type: 'column',
      flexGap: '16px',
      children: [
        { id: newBlockId(), type: 'heading', text: title, headingLevel: 2, className: 'font-serif' },
        { id: newBlockId(), type: 'text', text: hint, className: 'text-sm text-neutral-600' },
        ...(extra ?? []),
      ],
    })

  switch (key) {
    case 'job_cards':
      return baseColumn(
        'Stillingsliste — horisontalt kort',
        'To kort-rader med tittel, meta, PIN og pipeline. Legg til flere containere etter behov.',
        [
          {
            id: newBlockId(),
            type: 'column',
            flexGap: '12px',
            children: [
              {
                id: newBlockId(),
                type: 'container',
                className: 'rounded-lg border border-neutral-200 bg-white p-4',
                children: [
                  { id: newBlockId(), type: 'heading', text: 'Sales Manager', headingLevel: 3 },
                  { id: newBlockId(), type: 'text', text: 'London · Sales', className: 'text-sm text-neutral-500' },
                  { id: newBlockId(), type: 'row', flexGap: '8px', className: 'mt-2', children: [
                    { id: newBlockId(), type: 'text', text: 'OPEN', className: 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs' },
                  ]},
                  { id: newBlockId(), type: 'text', text: '0 candidates · pipeline icons…', className: 'mt-3 text-sm' },
                ],
              },
            ],
          },
        ],
      )
    case 'candidates_table':
      return baseColumn('Kandidater — søk og tabell', 'Verktøylinje + tabellplassholder. Koble inn egne rader som tekstblokker eller nye rader.', [
        { id: newBlockId(), type: 'row', flexGap: '8px', flexWrap: true, children: [
          { id: newBlockId(), type: 'input', inputType: 'search', placeholder: 'Search candidates…', className: 'min-w-[200px] flex-1' },
          { id: newBlockId(), type: 'button', text: 'Advanced' },
          { id: newBlockId(), type: 'button', text: 'Filters' },
        ]},
        { id: newBlockId(), type: 'container', className: 'rounded-lg border bg-white p-4', children: [
          { id: newBlockId(), type: 'text', text: 'Table: Name · Stage · Applied · Tags · Rating', className: 'font-mono text-xs' },
        ]},
      ])
    case 'scorecard_compare':
      return baseColumn('Scorecard ratings', 'Filterstripe + to kandidat-kolonner.', [
        { id: newBlockId(), type: 'row', flexGap: '8px', flexWrap: true, className: 'rounded-lg border bg-white p-3', children: [
          { id: newBlockId(), type: 'input', placeholder: 'Stage' },
          { id: newBlockId(), type: 'button', text: 'Export' },
        ]},
        {
          id: newBlockId(),
          type: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gridGap: '16px',
          children: [
            { id: newBlockId(), type: 'container', className: 'border rounded-lg p-4', children: [
              { id: newBlockId(), type: 'heading', text: 'Tom H.', headingLevel: 3 },
              { id: newBlockId(), type: 'text', text: '73%', className: 'text-xl font-bold' },
            ]},
            { id: newBlockId(), type: 'container', className: 'border rounded-lg p-4', children: [
              { id: newBlockId(), type: 'heading', text: 'Jane D.', headingLevel: 3 },
              { id: newBlockId(), type: 'text', text: '81%', className: 'text-xl font-bold' },
            ]},
          ],
        },
      ])
    case 'insight_tasks':
      return baseColumn('Innsikt — oppgavekort', 'KPI-rader og ukevelger (forenklet tre).', [
        { id: newBlockId(), type: 'container', className: 'rounded-lg border p-4', children: [
          { id: newBlockId(), type: 'text', text: 'Pending review · Forfalt / Denne uken', className: 'text-sm' },
        ]},
      ])
    case 'charts':
      return baseColumn('Grafer og diagrammer', 'Erstatt med egne containere for hvert diagram.', [
        { id: newBlockId(), type: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridGap: '12px', children: [
          { id: newBlockId(), type: 'container', className: 'h-32 rounded border border-dashed p-2 text-center text-xs text-neutral-400', children: [
            { id: newBlockId(), type: 'text', text: 'Bar chart placeholder' },
          ]},
          { id: newBlockId(), type: 'container', className: 'h-32 rounded border border-dashed p-2 text-center text-xs text-neutral-400', children: [
            { id: newBlockId(), type: 'text', text: 'Line chart placeholder' },
          ]},
        ]},
      ])
    case 'survey':
      return baseColumn('Undersøkelse og tilbakemeldinger', 'KPI-tall + kommentarliste.', [
        { id: newBlockId(), type: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridGap: '12px', children: [
          { id: newBlockId(), type: 'container', className: 'rounded border p-4', children: [
            { id: newBlockId(), type: 'text', text: '65%', className: 'text-3xl font-bold' },
            { id: newBlockId(), type: 'text', text: 'Svarprosent', className: 'text-sm' },
          ]},
          { id: newBlockId(), type: 'container', className: 'rounded border p-4', children: [
            { id: newBlockId(), type: 'text', text: '13', className: 'text-3xl font-bold' },
            { id: newBlockId(), type: 'text', text: 'Svar', className: 'text-sm' },
          ]},
        ]},
      ])
    case 'reports_catalog':
      return baseColumn('Rapporter (katalog)', 'Rutenett av rapportkort — legg til grid og containere.', [
        { id: newBlockId(), type: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: '12px', children: [
          { id: newBlockId(), type: 'container', className: 'rounded border p-3', children: [
            { id: newBlockId(), type: 'heading', text: 'Rapport A', headingLevel: 4 },
            { id: newBlockId(), type: 'text', text: 'Beskrivelse…', className: 'text-xs' },
          ]},
          { id: newBlockId(), type: 'container', className: 'rounded border p-3', children: [
            { id: newBlockId(), type: 'heading', text: 'Rapport B', headingLevel: 4 },
          ]},
        ]},
      ])
    case 'insight_pages':
      return baseColumn('Mine innsikt-sider', 'Søk + kortliste.', [
        { id: newBlockId(), type: 'input', inputType: 'search', placeholder: 'Søk…' },
        { id: newBlockId(), type: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: '12px', children: [
          { id: newBlockId(), type: 'container', className: 'rounded border p-4 text-left', children: [
            { id: newBlockId(), type: 'heading', text: 'Side 1', headingLevel: 4 },
          ]},
        ]},
      ])
    case 'widget_dashboard':
    default:
      return baseColumn('Widget-dashboard', 'Tre kolonner + bred widget under — tilpass grid.', [
        { id: newBlockId(), type: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: '12px', children: [
          { id: newBlockId(), type: 'container', className: 'border-t-4 border-emerald-800 p-4', children: [
            { id: newBlockId(), type: 'text', text: '28,9', className: 'text-2xl font-bold' },
            { id: newBlockId(), type: 'text', text: 'dager', className: 'text-sm' },
          ]},
          { id: newBlockId(), type: 'container', className: 'border-t-4 border-emerald-800 p-4', children: [
            { id: newBlockId(), type: 'text', text: '68,1', className: 'text-2xl font-bold' },
          ]},
          { id: newBlockId(), type: 'container', className: 'border p-4', children: [
            { id: newBlockId(), type: 'text', text: 'Liste widget', className: 'text-sm' },
          ]},
        ]},
      ])
  }
}

export function newEmptyVisualTemplate(source: VisualTemplateSource, name: string): VisualTemplate {
  const t = now()
  return {
    id: crypto.randomUUID(),
    name,
    source,
    root: emptyRootBlock(),
    createdAt: t,
    updatedAt: t,
  }
}
