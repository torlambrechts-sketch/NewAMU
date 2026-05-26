// Min innsikt — bedriftens tverrgående dashboard med faner per modul.
//
// Hostet under "Mitt arbeid" som hovedinngangen til analyser. Hver fane
// monterer den eksisterende AnalysePage for tilhørende scope, slik at
// alle widget-konfigurasjoner, drill-downs og lagrede oppsett gjenbrukes
// uten duplisering. URL-driven faneval (?tab=…) bevarer dyplenker.
//
// Fanene kalles inn betinget — bare aktiv fane monteres, slik at vi ikke
// kjører alle moduldatahooks samtidig på første treff. Bytter brukeren
// fane så avmonteres forrige scope og det nye lastes; bevisst trade-off
// mot å holde alt varmt (HmsOverviewPage gjør det og betaler i lastetid).
import { lazy, Suspense, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Kanban,
  Loader2,
  Megaphone,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'

type TabId =
  | 'hms'
  | 'sjekklister'
  | 'undersokelser'
  | 'oppgaver'
  | 'laring'
  | 'dokumenter'
  | 'moter'
  | 'register'

const TABS: Array<{ id: TabId; label: string; Icon: typeof Activity }> = [
  { id: 'hms', label: 'HMS-oversikt', Icon: Activity },
  { id: 'sjekklister', label: 'Sjekklister', Icon: ClipboardList },
  { id: 'undersokelser', label: 'Undersøkelser', Icon: Megaphone },
  { id: 'oppgaver', label: 'Oppgaver', Icon: Kanban },
  { id: 'laring', label: 'Læring', Icon: GraduationCap },
  { id: 'dokumenter', label: 'Dokumenter', Icon: FileText },
  { id: 'moter', label: 'Møter', Icon: CalendarDays },
  { id: 'register', label: 'Register', Icon: Database },
]

const VALID_TABS = new Set<TabId>(TABS.map((t) => t.id))

// Lazy-load per fane så bare aktiv modulside drar inn sitt avhengighetstre
// (datahooks, dashboard-scope-registrering, widget-renderer). Suspense
// fanger den korte spinneren mellom valg.
const HmsOverviewPage = lazy(() =>
  import('../overview/HmsOverviewPage').then((m) => ({ default: m.HmsOverviewPage })),
)
const ChecklistsAnalysePage = lazy(() =>
  import('../../../modules/compliance/ChecklistsAnalysePage').then((m) => ({
    default: m.ChecklistsAnalysePage,
  })),
)
const SurveyAnalysePage = lazy(() =>
  import('../../../modules/survey/SurveyAnalysePage').then((m) => ({
    default: m.SurveyAnalysePage,
  })),
)
const TasksAnalysePage = lazy(() =>
  import('../../../modules/tasks/TasksAnalysePage').then((m) => ({
    default: m.TasksAnalysePage,
  })),
)
const LearningAnalysePage = lazy(() =>
  import('../learning/LearningAnalysePage').then((m) => ({
    default: m.LearningAnalysePage,
  })),
)
const DocumentsAnalysePage = lazy(() =>
  import('../documents/DocumentsAnalysePage').then((m) => ({
    default: m.DocumentsAnalysePage,
  })),
)
const MeetingsAnalysePage = lazy(() =>
  import('../meetings/MeetingsAnalysePage').then((m) => ({
    default: m.MeetingsAnalysePage,
  })),
)
const RegistersAnalysePage = lazy(() =>
  import('../registers/RegistersAnalysePage').then((m) => ({
    default: m.RegistersAnalysePage,
  })),
)

export function MinInnsiktPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab')
  const tab: TabId = raw && VALID_TABS.has(raw as TabId) ? (raw as TabId) : 'hms'

  const setTab = (next: TabId) => {
    const sp = new URLSearchParams(searchParams)
    sp.set('tab', next)
    setSearchParams(sp, { replace: true })
  }

  const ActiveContent = useMemo(() => {
    switch (tab) {
      case 'hms':
        return <HmsOverviewPage />
      case 'sjekklister':
        return <ChecklistsAnalysePage />
      case 'undersokelser':
        return <SurveyAnalysePage />
      case 'oppgaver':
        return <TasksAnalysePage />
      case 'laring':
        return <LearningAnalysePage />
      case 'dokumenter':
        return <DocumentsAnalysePage />
      case 'moter':
        return <MeetingsAnalysePage />
      case 'register':
        return <RegistersAnalysePage />
    }
  }, [tab])

  return (
    <div className="flex min-h-full flex-col bg-[var(--ui-page)]">
      {/* Fane-stripe — sticky-top inne i scrollområdet, slik at fanene
          alltid er for hånden mens dashboards lengre nede scrolles.
          Bevisst plassert UTENFOR ModulePageShell-en til den embedded
          AnalysePage-en så de to ikke sloss om y-offsett. */}
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-[var(--ui-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--ui-surface)]/80">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 pb-2 pt-3 md:px-8">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            <BarChart3 className="size-3.5" aria-hidden />
            Mitt arbeid · Min innsikt
          </div>
          <nav
            className="flex flex-wrap items-center gap-1"
            aria-label="Min innsikt – faner"
          >
            {TABS.map(({ id, label, Icon }) => {
              const active = id === tab
              return (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => setTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'inline-flex h-auto items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--ui-accent)] text-white hover:bg-[var(--ui-accent)] hover:text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{label}</span>
                </Button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Aktiv fane-innhold. Hver embedded AnalysePage drar inn egen
          ModulePageShell med tittel + brødsmuler — vi lar det stå da
          det fungerer som "du ser nå dashboardet for X". */}
      <div className="flex-1">
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2
                className="size-6 animate-spin text-[var(--ui-accent)]"
                aria-hidden
              />
            </div>
          }
        >
          {ActiveContent}
        </Suspense>
      </div>
    </div>
  )
}
