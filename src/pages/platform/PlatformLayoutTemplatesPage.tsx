import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, LayoutTemplate } from 'lucide-react'
import {
  PlatformDashboardLayoutDemo,
  PlatformSplit7030LayoutDemo,
  PlatformStandardListLayoutDemo,
  type LayoutKitPreviewSurface,
} from './platformLayoutKitDemos'
import {
  BackgroundChecksPageBlock,
  CandidateDetailBlock,
  CandidatesListBlock,
  CandidatesVideoScreenBlock,
  DashboardMainRightBlock,
  JobPostingsPageBlock,
  JobScorecardPageBlock,
  JobsListPinpointBlock,
  SimpleDashboardBlock,
  SurveyInsights7070Block,
  TemplateLibraryBlock,
} from './platformReferenceLayoutBlocks'

/* ── Types ──────────────────────────────────────────────────────────────── */

type TemplateCategory = 'list' | 'dashboard' | 'detail' | 'form' | 'report' | 'reference'

type LayoutTemplate = {
  id: string
  name: string
  norskNavn: string
  category: TemplateCategory
  description: string
  useCases: string[]
  /** The live preview component — rendered in a scaled container */
  Preview: React.ComponentType<{ surface: LayoutKitPreviewSurface }>
  builderPath?: string
}

/* ── Reference block wrappers (no-prop components → accept surface) ─────── */

function wrapRef(Block: React.ComponentType): React.ComponentType<{ surface: LayoutKitPreviewSurface }> {
  // eslint-disable-next-line react/display-name
  return function RefWrapper() {
    return (
      <div className="rounded-xl border border-white/10 p-4 md:p-6" style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#F9F7F2', color: '#171717' }}>
        <Block />
      </div>
    )
  }
}

const DashboardMainRightPreview = wrapRef(DashboardMainRightBlock)
const SimpleDashboardPreview = wrapRef(SimpleDashboardBlock)
const JobsListPreview = wrapRef(JobsListPinpointBlock)
const JobScorecardPreview = wrapRef(JobScorecardPageBlock)
const SurveyInsightsPreview = wrapRef(SurveyInsights7070Block)
const JobPostingsPreview = wrapRef(JobPostingsPageBlock)
const CandidateDetailPreview = wrapRef(CandidateDetailBlock)
const CandidatesListPreview = wrapRef(CandidatesListBlock)
const VideoScreenPreview = wrapRef(CandidatesVideoScreenBlock)
const BackgroundChecksPreview = wrapRef(BackgroundChecksPageBlock)
const TemplateLibraryPreview = wrapRef(TemplateLibraryBlock)

/* ── Template catalogue ─────────────────────────────────────────────────── */

const TEMPLATES: LayoutTemplate[] = [
  // ── List / table layouts (from Layout arbeidsflate) ──
  {
    id: 'standard-list',
    name: 'Standard List Layout',
    norskNavn: 'Standard listeside',
    category: 'list',
    description: 'WorkplaceStandardListLayout med hub-faner, søk, filter, sortering og visningsveksler (tabell/boks/liste). Den mest brukte helsidestrukturen i appen.',
    useCases: ['Vernerunder', 'Inspeksjoner', 'Hendelser', 'Sykefravær', 'Opplæring'],
    Preview: PlatformStandardListLayoutDemo,
    builderPath: '/platform-admin/layout#standard',
  },
  {
    id: 'postings-list',
    name: 'Postings / Jobs List',
    norskNavn: 'Oppføringer (liste + kort)',
    category: 'list',
    description: 'Mørk fanebar øverst (Active/Archived), søk og grid/list-veksler, jobbkort med kandidatlinje. Fra referanseeksempel «Stillinger».',
    useCases: ['Stillingsannonser', 'Kursregister', 'Malbibliotek', 'Saksregister'],
    Preview: JobsListPreview,
    builderPath: '/platform-admin/layout-reference',
  },
  {
    id: 'candidates-list',
    name: 'Candidates / Records List',
    norskNavn: 'Persons-/elementliste',
    category: 'list',
    description: 'Tall-faner, søk og tabell med merker og stjerner. Brukes til lister over personer, saker eller elementer med filtrerbare kolonner.',
    useCases: ['Ansatteliste', 'Kandidatliste', 'Saksbehandling'],
    Preview: CandidatesListPreview,
    builderPath: '/platform-admin/layout-reference',
  },
  {
    id: 'background-checks',
    name: 'Status-tab List',
    norskNavn: 'Statusbasert listeside',
    category: 'list',
    description: 'Serif-tittel, statusfaner (Alle / Under arbeid / Krever handling / …), søk og filterrad, tabell og paginering.',
    useCases: ['Sertifiseringsregister', 'Tilsyn', 'Revisjonspunkter', 'Godkjenningsliste'],
    Preview: BackgroundChecksPreview,
    builderPath: '/platform-admin/layout-reference',
  },

  // ── Dashboard layouts ──
  {
    id: 'dashboard-7030',
    name: 'Dashboard Shell (70/30)',
    norskNavn: 'Dashbord med sidepanel',
    category: 'dashboard',
    description: 'WorkplaceDashboardShell med KPI-rad, hub-faner og WorkplaceSplit7030Layout. Hoveddelen 70 % til venstre, sidekolonne 30 % til høyre.',
    useCases: ['Prosjektdashboard', 'HMS-oversikt', 'Lederrapport', 'AMU-oversikt'],
    Preview: PlatformDashboardLayoutDemo,
    builderPath: '/platform-admin/layout#dashboard',
  },
  {
    id: 'dashboard-main-right',
    name: 'Dashboard 70/30 (full reference)',
    norskNavn: 'Dashbord 70/30 (full side)',
    category: 'dashboard',
    description: 'Velkomst, KPI-kort, stillingskort, smultring — med intervjuer og varsler til høyre. Komplett referanseeksempel fra Layout-referanse.',
    useCases: ['Velkomstside', 'Lederoversikt', 'Årshjul-dashboard'],
    Preview: DashboardMainRightPreview,
    builderPath: '/platform-admin/layout-reference',
  },
  {
    id: 'dashboard-compact',
    name: 'Compact Dashboard',
    norskNavn: 'Kompakt dashbord',
    category: 'dashboard',
    description: 'Enklere dashbord-variant med søyler og jobbkort. Egner seg når du vil ha oversikt uten KPI-rad.',
    useCases: ['Team-oversikt', 'Avdelingsstatus', 'Aktivitetsfeed'],
    Preview: SimpleDashboardPreview,
    builderPath: '/platform-admin/layout-reference',
  },

  // ── Report / analytics ──
  {
    id: 'survey-insights',
    name: 'Survey Insights 70/30',
    norskNavn: 'Rapport med innsikt',
    category: 'report',
    description: 'Overskrift + filter/eksport, to KPI-kort, NPS-donut, trendgraf, høyre kolonne med svar og paginering. Laget for analyse og rapporter.',
    useCases: ['Medarbeiderundersøkelse', 'HMS-rapport', 'Sykefravær-analyse', 'NPS-rapportering'],
    Preview: SurveyInsightsPreview,
    builderPath: '/platform-admin/layout-reference',
  },

  // ── Split layout ──
  {
    id: 'split-7030',
    name: 'Split 7/3 Layout',
    norskNavn: '7/3-split — to kolonner',
    category: 'list',
    description: 'WorkplaceSplit7030Layout med og uten kortramme (cardWrap). Tabell eller innhold venstre, kalender eller side-panel høyre. Stables på mobil.',
    useCases: ['Tabell + kalender', 'Saker + detalj', 'Oppgaver + tidslinje'],
    Preview: PlatformSplit7030LayoutDemo,
    builderPath: '/platform-admin/layout#split',
  },

  // ── Detail pages ──
  {
    id: 'candidate-detail',
    name: 'Detail Page (side nav)',
    norskNavn: 'Detaljside med sidemeny',
    category: 'detail',
    description: 'Beige seksjonsnavigasjon (~22 %) + hvit hovedflate med detaljrader. Brukes for dype detalj-/profilsider.',
    useCases: ['Ansattside', 'Hendelsesdetalj', 'Inspeksjonsdetalj', 'Saksbehandling'],
    Preview: CandidateDetailPreview,
    builderPath: '/platform-admin/layout-reference',
  },
  {
    id: 'scorecard',
    name: 'Scorecard / Evaluation',
    norskNavn: 'Scorecard — evalueringsside',
    category: 'detail',
    description: 'Breadcrumb, meta, flere faner, søk, filterrad og tre kolonner med kandidatkort og skills-rader. Ideal for sammenligning og vurdering.',
    useCases: ['Medarbeidervurdering', 'Risikovurdering', 'Revisjonsscore'],
    Preview: JobScorecardPreview,
    builderPath: '/platform-admin/layout-reference',
  },
  {
    id: 'video-screen',
    name: 'Pipeline / Process Screen',
    norskNavn: 'Pipeline-side',
    category: 'detail',
    description: 'Hub-fane aktiv, pipeline-seksjoner, søk, segmentert filter og prosesstabellvisning. Egner seg for arbeidsflytvisning.',
    useCases: ['Saksflyt', 'Onboarding-pipeline', 'Prosessoversikt'],
    Preview: VideoScreenPreview,
    builderPath: '/platform-admin/layout-reference',
  },

  // ── Form / postings ──
  {
    id: 'postings-full',
    name: 'Postings Full Page',
    norskNavn: 'Oppføringer — fullside',
    category: 'form',
    description: 'Brødsmule, H1 serif, hub med aktiv fane, Postings-kort med søk, tabell og paginering. Kombinerer heading og listeinnhold.',
    useCases: ['Registrering', 'Publisering', 'Dokumentliste'],
    Preview: JobPostingsPreview,
    builderPath: '/platform-admin/layout-reference',
  },

  // ── Reference ──
  {
    id: 'template-library',
    name: 'Template Library',
    norskNavn: 'Malbibliotek',
    category: 'reference',
    description: 'Filter-sidebar + 4-kolonne kort. Referanseeksempel for malsider med kategorier og søk.',
    useCases: ['Malbibliotek', 'Dokumentarkiv', 'Ressurssenter', 'Komponentgalleri'],
    Preview: TemplateLibraryPreview,
    builderPath: '/platform-admin/layout-reference',
  },
]

/* ── Category metadata ────────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  list:      'Liste / Tabell',
  dashboard: 'Dashbord',
  detail:    'Detalj',
  form:      'Skjema / Innhold',
  report:    'Rapport',
  reference: 'Referanse',
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  list:      '#1a3d32',
  dashboard: '#8b5cf6',
  detail:    '#0891b2',
  form:      '#f97316',
  report:    '#3b82f6',
  reference: '#737373',
}

const ALL_CATS = ['all', ...Object.keys(CATEGORY_LABELS)] as const
type FilterCat = typeof ALL_CATS[number]

/* ── Copy helper ─────────────────────────────────────────────────────────── */

function CopyId({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text).catch(() => null); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1.5 rounded bg-slate-800 px-2 py-1 font-mono text-xs text-amber-300/90 hover:bg-slate-700"
    >
      {copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
      {text}
    </button>
  )
}

/* ── Template card ─────────────────────────────────────────────────────────── */

function TemplateCard({
  template,
  surface,
  onSelect,
}: {
  template: LayoutTemplate
  surface: LayoutKitPreviewSurface
  onSelect: (t: LayoutTemplate) => void
}) {
  const col = CATEGORY_COLORS[template.category]
  return (
    <div
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 transition hover:border-white/20 hover:bg-slate-900/80"
      onClick={() => onSelect(template)}
    >
      {/* Scaled live preview */}
      <div className="relative overflow-hidden bg-neutral-200" style={{ height: 220 }}>
        <div style={{ transform: 'scale(0.38)', transformOrigin: 'top left', width: '263%', height: '263%', pointerEvents: 'none' }}>
          <template.Preview surface={surface} />
        </div>
        {/* Category badge */}
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold shadow" style={{ backgroundColor: `${col}22`, color: col, border: `1px solid ${col}44` }}>
            {CATEGORY_LABELS[template.category]}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm font-semibold text-white">{template.norskNavn}</p>
        <p className="text-[11px] leading-relaxed text-neutral-400">{template.description}</p>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {template.useCases.slice(0, 3).map(u => (
            <span key={u} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-500">{u}</span>
          ))}
          {template.useCases.length > 3 && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-500">+{template.useCases.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Detail modal ─────────────────────────────────────────────────────────── */

function TemplateDetail({
  template,
  surface,
  onClose,
}: {
  template: LayoutTemplate
  surface: LayoutKitPreviewSurface
  onClose: () => void
}) {
  const col = CATEGORY_COLORS[template.category]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm md:p-8">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <LayoutTemplate className="size-5 shrink-0 text-amber-400/80" />
            <h2 className="min-w-0 truncate text-base font-semibold text-white">{template.norskNavn}</h2>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${col}22`, color: col }}>
              {CATEGORY_LABELS[template.category]}
            </span>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white">
            <svg className="size-4" viewBox="0 0 16 16" fill="currentColor"><path d="M3.22 3.22a.75.75 0 0 1 1.06 0L8 6.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L9.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg>
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_300px]">
          {/* Live preview — larger */}
          <div className="overflow-hidden rounded-xl border border-white/10" style={{ height: 420 }}>
            <div style={{ transform: 'scale(0.52)', transformOrigin: 'top left', width: '192%', height: '192%', pointerEvents: 'none' }}>
              <template.Preview surface={surface} />
            </div>
          </div>

          {/* Details panel */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Navn (engelsk)</p>
              <p className="text-sm text-neutral-300">{template.name}</p>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Beskrivelse</p>
              <p className="text-sm leading-relaxed text-neutral-300">{template.description}</p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Bruksområder</p>
              <div className="flex flex-wrap gap-1.5">
                {template.useCases.map(u => (
                  <span key={u} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-neutral-300">{u}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Mal-ID</p>
              <CopyId text={template.id} />
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-2">
              {template.builderPath && (
                <Link
                  to={template.builderPath}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Åpne i Layout-arbeidsflate
                </Link>
              )}
              <Link
                to="/platform-admin/layout"
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5"
              >
                Layout (arbeidsflate)
              </Link>
              <Link
                to="/platform-admin/layout-reference"
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5"
              >
                Layout-referanse
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */

export function PlatformLayoutTemplatesPage() {
  const [selected, setSelected] = useState<LayoutTemplate | null>(null)
  const [filter, setFilter] = useState<FilterCat>('all')
  const [surface, setSurface] = useState<LayoutKitPreviewSurface>('cream')

  const filtered = filter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter)

  return (
    <div className="space-y-8 text-neutral-100">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="size-6 text-amber-400/80" />
            <h1 className="text-2xl font-semibold text-white">Layout-maler</h1>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-neutral-400">
            Ferdige sideoppsett basert på komponentene fra{' '}
            <Link to="/platform-admin/layout" className="text-amber-400/90 hover:underline">Layout (arbeidsflate)</Link>{' '}
            og referanseeksemplene fra{' '}
            <Link to="/platform-admin/layout-reference" className="text-amber-400/90 hover:underline">Layout-referanse</Link>.
            Forhåndsvisningen er live — samme komponenter som brukes i appen.
          </p>
        </div>
        {/* Surface toggle */}
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 p-1">
          {(['cream', 'white'] as LayoutKitPreviewSurface[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSurface(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${surface === s ? 'bg-amber-500/90 text-slate-950' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'}`}
            >
              {s === 'cream' ? 'Krem arbeidsflate' : 'Helhvit'}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_CATS.map(cat => {
          const count = cat === 'all' ? TEMPLATES.length : TEMPLATES.filter(t => t.category === cat).length
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === cat
                  ? 'bg-amber-500/90 text-slate-950'
                  : 'border border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-200'
              }`}
            >
              {cat === 'all' ? `Alle (${count})` : `${CATEGORY_LABELS[cat as TemplateCategory]} (${count})`}
            </button>
          )
        })}
      </div>

      {/* Template grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map(t => (
          <TemplateCard key={t.id} template={t} surface={surface} onSelect={setSelected} />
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <TemplateDetail template={selected} surface={surface} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
