import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  ClipboardCheck,
  GitBranch,
  HardHat,
  HeartPulse,
  LayoutDashboard,
  ListTodo,
  Scale,
  UsersRound,
} from 'lucide-react'
import { DEFAULT_COMPLIANCE_REQUIREMENTS } from '../../data/complianceRequirements'
import { useCouncil } from '../../hooks/useCouncil'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'
import { useHse } from '../../hooks/useHse'
import { useInternalControl } from '../../hooks/useInternalControl'
import { useLearning } from '../../hooks/useLearning'
import { useOrgHealth } from '../../hooks/useOrgHealth'
import { useTasks } from '../../hooks/useTasks'
import { useWorkflows } from '../../hooks/useWorkflows'
import { complianceCoverage, learningCompletionStats } from '../../lib/dashboardMetrics'

function KpiCard({
  label,
  value,
  hint,
  to,
  variant = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  to?: string
  variant?: 'neutral' | 'amber' | 'emerald' | 'rose'
}) {
  const bg =
    variant === 'amber'
      ? 'bg-amber-50 ring-amber-200/80'
      : variant === 'emerald'
        ? 'bg-emerald-50 ring-emerald-200/80'
        : variant === 'rose'
          ? 'bg-rose-50 ring-rose-200/80'
          : 'bg-[#faf8f4] ring-neutral-100'
  const inner = (
    <div className={`rounded-xl p-4 ring-1 ${bg}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#1a3d32]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-600">{hint}</div> : null}
    </div>
  )
  if (to) {
    return (
      <Link to={to} className="block transition hover:opacity-90">
        {inner}
      </Link>
    )
  }
  return inner
}

export function DashboardsPage() {
  const tasks = useTasks()
  const ic = useInternalControl()
  const oh = useOrgHealth()
  const learning = useLearning()
  const doc = useDocumentCenter()
  const wf = useWorkflows()
  const council = useCouncil()
  const hse = useHse()

  const taskOverdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return tasks.tasks.filter((t) => t.status !== 'done' && t.dueDate !== '—' && t.dueDate < today).length
  }, [tasks.tasks])

  const taskByStatus = useMemo(() => {
    const m = { todo: 0, in_progress: 0, done: 0 } as Record<string, number>
    for (const t of tasks.tasks) {
      m[t.status] = (m[t.status] ?? 0) + 1
    }
    return m
  }, [tasks.tasks])

  const taskByModule = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of tasks.tasks) {
      if (t.status === 'done') continue
      m[t.module] = (m[t.module] ?? 0) + 1
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [tasks.tasks])

  const learnCompletion = useMemo(
    () => learningCompletionStats(learning.courses, learning.progress),
    [learning.courses, learning.progress],
  )

  const compliance = useMemo(
    () => complianceCoverage(DEFAULT_COMPLIANCE_REQUIREMENTS, doc.documents),
    [doc.documents],
  )

  const openElections = useMemo(
    () => council.elections.filter((e) => e.status === 'open').length,
    [council.elections],
  )

  const nextMeetings = useMemo(() => {
    return [...council.meetings]
      .filter((m) => m.status === 'planned')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 3)
  }, [council.meetings])

  const orgSurveyHighlights = useMemo(() => {
    return oh.surveys.map((s) => {
      const agg = oh.aggregates[s.id]
      const npsKeys = agg?.npsByQuestionId ? Object.keys(agg.npsByQuestionId) : []
      let npsLine: string | null = null
      for (const k of npsKeys) {
        const n = agg?.npsByQuestionId?.[k]
        if (n?.score != null) {
          npsLine = `NPS ${n.score}`
          break
        }
      }
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        count: agg?.count ?? 0,
        responseRate: agg?.responseRate,
        npsLine,
        psy: agg?.psykosocialIndex,
      }
    })
  }, [oh.surveys, oh.aggregates])

  const navTrend = useMemo(() => {
    const r = oh.navReports
    if (r.length < 2) return null
    const a = r[0]?.sickLeavePercent
    const b = r[1]?.sickLeavePercent
    if (a == null || b == null) return null
    return { latest: a, prev: b, delta: Math.round((a - b) * 10) / 10 }
  }, [oh.navReports])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Prosjekter
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Dashboards</span>
      </nav>

      <header className="border-b border-neutral-200/80 pb-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#1a3d32] text-[#c9a227]">
            <LayoutDashboard className="size-7" />
          </div>
          <div>
            <h1
              className="text-2xl font-semibold text-neutral-900 md:text-3xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Oversikt og KPI
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-600">
              Samlet status på tvers av moduler (demo-data i nettleser). Tall erstatter ikke faglig vurdering,
              AMU-protokoller eller BHT — bruk som utgangspunkt for oppfølging.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <a href="#ledelse" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            Ledelse
          </a>
          <a href="#internkontroll" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            Internkontroll
          </a>
          <a href="#org-health" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            Org. helse
          </a>
          <a href="#laring" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            Læring
          </a>
          <a href="#oppgaver" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            Oppgaver
          </a>
          <a href="#compliance" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            Compliance
          </a>
          <a href="#amu" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            AMU / råd
          </a>
          <a href="#prosesser" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            Prosesser
          </a>
          <a href="#hse" className="rounded-full bg-white px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50">
            HSE
          </a>
        </div>
      </header>

      {/* Ledelse */}
      <section id="ledelse" className="scroll-mt-24 border-b border-neutral-100 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <Building2 className="size-5 text-[#1a3d32]" />
          Ledelse — er vi i rute?
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Åpne varslingssaker"
            value={ic.stats.whistleOpen}
            to="/internal-control?tab=whistle"
            variant={ic.stats.whistleOpen > 0 ? 'amber' : 'neutral'}
          />
          <KpiCard
            label="Dokumenter — revisjon forfalt"
            value={doc.stats.dueReview}
            to="/documents"
            variant={doc.stats.dueReview > 0 ? 'rose' : 'neutral'}
          />
          <KpiCard
            label="Uleste bekreftelser (publ.)"
            value={doc.stats.pendingReads}
            to="/documents"
            variant={doc.stats.pendingReads > 0 ? 'amber' : 'neutral'}
          />
          <KpiCard
            label="Oppgaver forfalt"
            value={taskOverdue}
            to="/tasks"
            variant={taskOverdue > 0 ? 'rose' : 'neutral'}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <KpiCard label="Compliance krav tilfredsstilt" value={`${compliance.satisfied}/${compliance.total}`} to="/documents/compliance" variant="emerald" />
          <KpiCard label="ROS med åpne risiko≥6" value={ic.stats.rosOpenRiskRows} to="/internal-control?tab=ros" />
          <KpiCard
            label="Årsgjennomgang neste frist"
            value={ic.stats.nextAnnualDue ? new Date(ic.stats.nextAnnualDue).toLocaleDateString('nb-NO') : '—'}
            hint={ic.stats.annualOverdue ? 'Forfalt — se internkontroll' : undefined}
            to="/internal-control?tab=annual"
            variant={ic.stats.annualOverdue ? 'rose' : 'neutral'}
          />
        </div>
      </section>

      {/* Internkontroll */}
      <section id="internkontroll" className="scroll-mt-24 border-b border-neutral-100 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <Scale className="size-5 text-[#1a3d32]" />
          HMS / internkontroll
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-neutral-800">Varslingssaker etter status</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {(
                [
                  ['received', 'Mottatt'],
                  ['triage', 'Vurdering'],
                  ['investigation', 'Undersøkelse'],
                  ['internal_review', 'Intern revisjon'],
                  ['closed', 'Avsluttet'],
                ] as const
              ).map(([k, lab]) => (
                <li key={k} className="flex justify-between border-b border-neutral-50 pb-1">
                  <span className="text-neutral-600">{lab}</span>
                  <span className="font-medium text-[#1a3d32]">{ic.stats.whistleByStatus[k]}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/internal-control?tab=whistle"
              className="mt-3 inline-flex items-center gap-1 text-sm text-[#1a3d32] underline"
            >
              Gå til saker <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-neutral-800">ROS og årsgjennomgang</h3>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              <li>
                ROS-vurderinger: <strong>{ic.stats.rosCount}</strong>
              </li>
              <li>
                Åpne høyrisiko-rader (score ≥ 6, ikke lukket): <strong>{ic.stats.rosOpenRiskRows}</strong>
              </li>
              <li>
                Registrerte årsgjennomganger: <strong>{ic.stats.annualCount}</strong>
              </li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/internal-control?tab=ros"
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-[#1a3d32]"
              >
                ROS
              </Link>
              <Link
                to="/internal-control?tab=annual"
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-[#1a3d32]"
              >
                Årsgjennomgang
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Org health */}
      <section id="org-health" className="scroll-mt-24 border-b border-neutral-100 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <HeartPulse className="size-5 text-[#1a3d32]" />
          Organisasjonshelse
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Åpne undersøkelser" value={oh.surveys.filter((s) => s.status === 'open').length} to="/org-health?tab=surveys" />
          <KpiCard label="Svar (totalt)" value={oh.responses.length} to="/org-health?tab=surveys" />
          <KpiCard label="Anonyme AML-henvendelser" value={oh.amlReportStats.total} to="/org-health?tab=reporting" />
          <KpiCard
            label="Siste sykefravær %"
            value={oh.navSummary.latestPercent != null ? `${oh.navSummary.latestPercent}%` : '—'}
            hint={navTrend ? `Trend vs forrige: ${navTrend.delta >= 0 ? '+' : ''}${navTrend.delta} pp` : undefined}
            to="/org-health?tab=nav"
          />
        </div>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-neutral-800">Undersøkelser (høydepunkter)</h3>
          {orgSurveyHighlights.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Ingen undersøkelser.</p>
          ) : (
            <ul className="mt-2 divide-y divide-neutral-100 text-sm">
              {orgSurveyHighlights.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium text-neutral-800">{s.title}</span>
                  <span className="text-xs text-neutral-500">
                    {s.status} · n={s.count}
                    {s.responseRate != null ? ` · ${s.responseRate}% svar` : ''}
                    {s.npsLine ? ` · ${s.npsLine}` : ''}
                    {s.psy != null ? ` · PSI ${s.psy}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-amber-900">
            <AlertTriangle className="mr-1 inline size-3" />
            Ved lav n — tolkes forsiktig; se undersøkelsesdetaljer.
          </p>
        </div>
      </section>

      {/* Læring */}
      <section id="laring" className="scroll-mt-24 border-b border-neutral-100 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <BookOpen className="size-5 text-[#1a3d32]" />
          Læring
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Publiserte kurs" value={learnCompletion.publishedCount} to="/learning/courses" />
          <KpiCard label="Fullførte kurs (minst én)" value={learnCompletion.completedCourses} to="/learning/certifications" />
          <KpiCard label="Påbegynt / ikke fullført" value={learnCompletion.inProgressCourses} to="/learning/courses" />
          <KpiCard label="Ikke startet" value={learnCompletion.notStarted} to="/learning/courses" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="text-neutral-600">Sertifikater utstedt:</span>
          <strong>{learning.stats.certs}</strong>
          <Link to="/learning/insights" className="ml-2 text-[#1a3d32] underline">
            Innsikt
          </Link>
        </div>
      </section>

      {/* Oppgaver */}
      <section id="oppgaver" className="scroll-mt-24 border-b border-neutral-100 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <ListTodo className="size-5 text-[#1a3d32]" />
          Oppgaver
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <KpiCard label="Todo" value={taskByStatus.todo ?? 0} to="/tasks" />
          <KpiCard label="Pågår" value={taskByStatus.in_progress ?? 0} to="/tasks" />
          <KpiCard label="Ferdig" value={taskByStatus.done ?? 0} to="/tasks?view=audit" />
        </div>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-neutral-800">Åpne oppgaver etter modul (topp)</h3>
          {taskByModule.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Ingen åpne oppgaver.</p>
          ) : (
            <ul className="mt-2 text-sm">
              {taskByModule.map(([mod, n]) => (
                <li key={mod} className="flex justify-between py-1">
                  <span className="capitalize text-neutral-700">{mod.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Compliance */}
      <section id="compliance" className="scroll-mt-24 border-b border-neutral-100 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <ClipboardCheck className="size-5 text-[#1a3d32]" />
          Compliance (illustrativ matrise)
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <KpiCard label="Tilfredsstilt" value={compliance.satisfied} to="/documents/compliance" variant="emerald" />
          <KpiCard label="Delvis / ikke godkjent" value={compliance.partial} to="/documents/compliance" variant="amber" />
          <KpiCard label="Ikke koblet" value={compliance.unsatisfied} to="/documents/compliance" />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Krav hentet fra illustrativ liste — verifiser mot lovdata.no og sektor.
        </p>
      </section>

      {/* AMU */}
      <section id="amu" className="scroll-mt-24 border-b border-neutral-100 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <UsersRound className="size-5 text-[#1a3d32]" />
          AMU / arbeidsmiljøråd
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <KpiCard label="Åpne valg" value={openElections} to="/council?tab=board" />
          <KpiCard label="Medlemmer i styret" value={council.board.length} to="/council?tab=board" />
        </div>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-neutral-800">Kommende møter</h3>
          {nextMeetings.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Ingen planlagte møter funnet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {nextMeetings.map((m) => (
                <li key={m.id}>
                  <Link to="/council?tab=meetings" className="font-medium text-[#1a3d32] hover:underline">
                    {m.title}
                  </Link>
                  <span className="text-neutral-500">
                    {' '}
                    — {new Date(m.startsAt).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Prosesser */}
      <section id="prosesser" className="scroll-mt-24 border-b border-neutral-100 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <GitBranch className="size-5 text-[#1a3d32]" />
          Prosessbygger
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <KpiCard label="Definerte prosesser" value={wf.workflows.length} to="/workflows" />
          <KpiCard label="Malbibliotek" value={wf.presets.length} to="/workflows" hint="Forhåndsdefinerte maler" />
        </div>
      </section>

      {/* HSE */}
      <section id="hse" className="scroll-mt-24 py-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <HardHat className="size-5 text-[#1a3d32]" />
          HSE
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Vernerunder" value={hse.stats.rounds} to="/hse?tab=rounds" />
          <KpiCard label="Inspeksjoner (klassisk)" value={hse.stats.inspections} to="/hse?tab=inspections" />
          <KpiCard label="Malbaserte runder" value={hse.stats.runsTotal} to="/hse?tab=inspections" />
          <KpiCard label="Åpne mal-runder" value={hse.stats.runsOpen} to="/hse?tab=inspections" />
          <KpiCard label="Åpne inspeksjoner" value={hse.stats.openInspections} to="/hse?tab=inspections" />
          <KpiCard label="Hendelser / nestenulykker" value={hse.stats.incidents + hse.stats.nearMiss} to="/hse?tab=incidents" />
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        <Link to="/" className="text-[#1a3d32] underline">
          Tilbake til prosjekter
        </Link>
        <span className="mx-2">·</span>
        <Link to="/documents" className="text-[#1a3d32] underline">
          Dokumenter
        </Link>
        <span className="mx-2">·</span>
        <Link to="/tasks" className="text-[#1a3d32] underline">
          Oppgaver
        </Link>
      </footer>
    </div>
  )
}
