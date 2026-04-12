import { useId, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { VisualTemplateEditor } from '../../components/platform/VisualTemplateEditor'
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

const CREAM = '#F9F7F2'
const SANS = "Inter, system-ui, sans-serif"

function shellStyle(): CSSProperties {
  return {
    fontFamily: SANS,
    backgroundColor: CREAM,
    color: '#171717',
  }
}

const SECTIONS = [
  { id: 'library', label: 'Malbibliotek', desc: 'Filter sidebar + 4-kolonne kort (referanse: Template Library).' },
  { id: 'jobs', label: 'Stillinger (Jobs)', desc: 'Topp-linje, mørk fanebar Active/Archived, søk, jobbkort med kandidatlinje (uten venstremeny).' },
  {
    id: 'scorecard',
    label: 'Scorecard (detalj)',
    desc: 'Breadcrumb, meta, flere faner, søk, filterrad (stage/scorecards/order/show detail), 3 kolonner kandidatkort med job skills-rader.',
  },
  {
    id: 'survey7070',
    label: 'Survey insights 70/30',
    desc: 'Overskrift + filter/export, to KPI-kort, NPS-donut, trendgraf, høyre kolonne med svar og paginering.',
  },
  {
    id: 'postings',
    label: 'Stillingsannonser (Postings)',
    desc: 'Brødsmule Stillinger › Stillingsannonser, H1, hub med Stillingsannonser aktiv, Postings-kort med søk, tabell og paginering.',
  },
  { id: 'detail', label: 'Kandidatdetalj', desc: 'Beige seksjonsnavigasjon (~22 %) + hvit hovedflate med detaljrader.' },
  { id: 'list', label: 'Kandidatliste', desc: 'Tall-faner, søk og tabell med merker og stjerner.' },
  {
    id: 'video_screen',
    label: 'Video screen (Interviews)',
    desc: 'Hub med Interviews aktiv, pipeline-faner, søk, segmentert filter (All / Uninvited / Invited), Configure og tabell (Name, Template, Tags, Status).',
  },
  {
    id: 'background_checks',
    label: 'Background checks (Certn)',
    desc: 'Serif-tittel, statusfaner (All / In progress / Action required / …), søk og filterrad, tabell og paginering.',
  },
  { id: 'dash', label: 'Dashboard 70/30', desc: 'Velkomst, KPI-kort, stillinger, smultring — med intervjuer og varsler til høyre.' },
  { id: 'dash2', label: 'Dashboard (kompakt)', desc: 'Enkel variant med søyler og jobbkort.' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function PlatformPinpointLayoutsPage() {
  const [section, setSection] = useState<SectionId>('library')
  const [view, setView] = useState<'examples' | 'builder'>('examples')
  const baseId = useId()

  return (
    <div className="space-y-8 text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold text-white">Referanselayout (hoved + høyre)</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Statiske mockups inspirert av rekrutterings-ATS (Pinpoint-lignende): krem bakgrunn, serif titler, grønn menybar der det passer, og{' '}
          <strong className="font-medium text-neutral-200">70/30</strong> der oppsettet krever hovedkolonne og høyre kolonne. Den mørke venstremenyen i
          appen er ikke med — kun arbeidsflaten.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Juster globale tokens i{' '}
          <Link to="/platform-admin/layout-lab" className="text-amber-400/90 hover:underline">
            Layout-lab
          </Link>{' '}
          for å sammenligne med egne verdier. Avanserte mønstre finnes under{' '}
          <Link to="/platform-admin/ui-advanced" className="text-amber-400/90 hover:underline">
            Avansert UI
          </Link>
          . Samme elementer finnes som blokker under{' '}
          <Link to="/platform-admin/layout#composer" className="text-amber-400/90 hover:underline">
            Layout (arbeidsflate) — komponer
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('examples')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            view === 'examples' ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40' : 'text-neutral-400 hover:bg-white/5'
          }`}
        >
          Statiske eksempler
        </button>
        <button
          type="button"
          onClick={() => setView('builder')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            view === 'builder' ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40' : 'text-neutral-400 hover:bg-white/5'
          }`}
        >
          Malbygger (CRUD, dra-og-slipp)
        </button>
      </div>

      {view === 'examples' ? (
        <>
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-900/40 p-2">
            {SECTIONS.map((s) => {
              const sid = `${baseId}-${s.id}`
              return (
                <button
                  key={s.id}
                  type="button"
                  id={sid}
                  onClick={() => setSection(s.id)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    section === s.id ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40' : 'text-neutral-300 hover:bg-white/5'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          <p className="text-sm text-neutral-400">{SECTIONS.find((s) => s.id === section)?.desc}</p>

          <div className="rounded-xl border border-white/10 p-4 shadow-lg md:p-6" style={shellStyle()}>
            {section === 'library' ? <TemplateLibraryBlock /> : null}
            {section === 'jobs' ? <JobsListPinpointBlock /> : null}
            {section === 'scorecard' ? <JobScorecardPageBlock /> : null}
            {section === 'survey7070' ? <SurveyInsights7070Block /> : null}
            {section === 'postings' ? <JobPostingsPageBlock /> : null}
            {section === 'detail' ? <CandidateDetailBlock /> : null}
            {section === 'list' ? <CandidatesListBlock /> : null}
            {section === 'video_screen' ? <CandidatesVideoScreenBlock /> : null}
            {section === 'background_checks' ? <BackgroundChecksPageBlock /> : null}
            {section === 'dash' ? <DashboardMainRightBlock /> : null}
            {section === 'dash2' ? <SimpleDashboardBlock /> : null}
          </div>
        </>
      ) : null}

      {view === 'builder' ? (
        <VisualTemplateEditor
          source="pinpoint"
          title="Egendefinerte referansemaler"
          description={
            <span>
              Start fra <strong className="font-medium text-neutral-200">Fra eksempel</strong> for å kopiere strukturen fra fanene over som redigerbar tre-mal. Klikk et element for popup, dra håndtaket for å flytte. Alt lagres i nettleseren per bruker.
            </span>
          }
        />
      ) : null}
    </div>
  )
}
