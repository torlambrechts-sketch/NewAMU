import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  BookMarked,
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  HeartPulse,
  History,
  Plus,
  Send,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { AML_REPORT_KINDS, labelForAmlReportKind } from '../data/amlAnonymousReporting'
import { definitionForKey } from '../data/orgHealthMetrics'
import { ALL_SURVEY_TEMPLATES, TEMPLATE_CATEGORIES } from '../data/surveyTemplates'
import { useOrgHealth } from '../hooks/useOrgHealth'
import { useOrganisation } from '../hooks/useOrganisation'
import type { AmlReportKind, LaborMetricKey, Survey, SurveyQuestion, SurveySchedule, SurveyScheduleKind } from '../types/orgHealth'

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: HeartPulse },
  { id: 'surveys' as const, label: 'Undersøkelser', icon: ClipboardCheck },
  { id: 'nav' as const, label: 'Sykefravær (NAV)', icon: FileSpreadsheet },
  { id: 'metrics' as const, label: 'AML-indikatorer', icon: BarChart3 },
  { id: 'reporting' as const, label: 'Anonym rapportering', icon: ShieldAlert },
  { id: 'audit' as const, label: 'Logg', icon: History },
]

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function OrgHealthModule() {
  const oh = useOrgHealth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Check scheduled surveys on every mount
  useMemo(() => { oh.checkAndTriggerSchedules() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')
  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'
  const setTab = (id: TabId) => setSearchParams({ tab: id }, { replace: true })
  const [respondSurveyId, setRespondSurveyId] = useState('')
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [navForm, setNavForm] = useState({
    periodLabel: '',
    periodStart: '',
    periodEnd: '',
    sickLeavePercent: '',
    selfCertifiedDays: '',
    documentedSickDays: '',
    employeeCount: '',
    notes: '',
    sourceNote: 'Manuell registrering fra NAV A-melding / sykefraværsstatistikk.',
  })
  const [metricForm, setMetricForm] = useState({
    metricKey: 'work_environment_assessment' as LaborMetricKey,
    periodStart: '',
    periodEnd: '',
    value: '',
    textValue: '',
    notes: '',
  })
  const [reportKind, setReportKind] = useState<AmlReportKind>('psychosocial')
  const [reportUrgency, setReportUrgency] = useState<'low' | 'medium' | 'high'>('medium')
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)

  const openSurveys = useMemo(
    () => oh.surveys.filter((s) => s.status === 'open'),
    [oh.surveys],
  )

  const sortedAudit = useMemo(
    () => [...oh.auditTrail].sort((a, b) => a.at.localeCompare(b.at)),
    [oh.auditTrail],
  )

  const activeRespondSurvey = respondSurveyId
    ? oh.surveys.find((s) => s.id === respondSurveyId)
    : openSurveys[0]

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Prosjekter
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Organisasjonshelse</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Organisasjonshelse
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Medarbeiderundersøkelser (valgfritt anonyme), aggregerte resultater, sykefravær fra NAV-rapportering
            (manuell import), og AML-relaterte indikatorer. Ikke juridisk eller medisinsk rådgivning — verifiser mot{' '}
            <a href="https://lovdata.no" className="text-[#1a3d32] underline" target="_blank" rel="noreferrer">
              lovdata.no
            </a>{' '}
            og interne kilder.
          </p>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900">Hurtigstatus</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{openSurveys.length}</div>
                <div className="text-sm text-neutral-600">Åpne undersøkelser</div>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{oh.responses.length}</div>
                <div className="text-sm text-neutral-600">Innsendte svar (totalt)</div>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">
                  {oh.navSummary.latestPercent != null ? `${oh.navSummary.latestPercent}%` : '—'}
                </div>
                <div className="text-sm text-neutral-600">Siste sykefravær (NAV-felt)</div>
              </div>
              <div className="rounded-xl bg-amber-50/90 p-4 ring-1 ring-amber-200/80 sm:col-span-3">
                <div className="text-2xl font-semibold text-[#1a3d32]">{oh.amlReportStats.total}</div>
                <div className="text-sm text-neutral-600">Anonyme AML-henvendelser (totalt)</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              Gjennomsnitt sykefravær registrert:{' '}
              <strong>{oh.navSummary.avgPercent != null ? `${oh.navSummary.avgPercent}%` : '—'}</strong>
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Snarveier</h2>
            <button
              type="button"
              onClick={() => setTab('surveys')}
              className="mt-4 w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
            >
              Undersøkelser
            </button>
            <button
              type="button"
              onClick={() => setTab('nav')}
              className="mt-2 w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
            >
              Sykefravær
            </button>
            <button
              type="button"
              onClick={() => setTab('metrics')}
              className="mt-2 w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
            >
              AML-indikatorer
            </button>
            <button
              type="button"
              onClick={() => setTab('reporting')}
              className="mt-2 w-full rounded-xl border border-amber-200/90 bg-amber-50/80 py-2.5 text-sm font-medium text-[#1a3d32] hover:bg-amber-50"
            >
              Anonym rapportering (AML)
            </button>
            <Link
              to="/org-health/settings"
              className="mt-2 block w-full rounded-xl border border-neutral-200 py-2.5 text-center text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
            >
              Veikart & planer
            </Link>
            <Link
              to="/internal-control"
              className="mt-2 block w-full rounded-xl border border-neutral-200 py-2.5 text-center text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
            >
              Internkontroll & varslingssaker
            </Link>
            <div className="mt-3 flex justify-center">
              <AddTaskLink
                title="Oppfølging organisasjonshelse"
                module="org_health"
                sourceType="manual"
                ownerRole="HR / HMS"
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'surveys' && (
        <div className="mt-8 space-y-8">
          <SurveyCreator oh={oh} />


          <div className="space-y-6">
            {oh.surveys.map((s) => (
            <SurveyAdminCard
              key={s.id}
              survey={s}
              aggregate={oh.aggregates[s.id]}
              onOpen={() => oh.openSurvey(s.id)}
              onClose={() => oh.closeSurvey(s.id)}
              onAddQuestion={(text, type, req) => oh.addQuestion(s.id, text, type, req)}
              onSetSchedule={(sched) => oh.setSchedule(s.id, sched)}
            />
            ))}
          </div>

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Simuler svar (demo)</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Én innsending per nettleserøkt per undersøkelse. Ved anonym undersøkelse vises ikke fritekst i rapport
              før undersøkelsen er lukket.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <select
                value={activeRespondSurvey?.id ?? ''}
                onChange={(e) => {
                  setRespondSurveyId(e.target.value)
                  setAnswers({})
                }}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                {openSurveys.length === 0 ? (
                  <option value="">Ingen åpne undersøkelser</option>
                ) : (
                  openSurveys.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))
                )}
              </select>
            </div>
            {activeRespondSurvey && activeRespondSurvey.status === 'open' ? (
              <ResponseForm
                survey={activeRespondSurvey}
                answers={answers}
                setAnswers={setAnswers}
                onSubmit={() => {
                  for (const q of activeRespondSurvey.questions) {
                    if (!q.required) continue
                    if (q.type === 'likert_5' && answers[q.id] == null) {
                      alert(`Besvar: ${q.text.slice(0, 80)}…`)
                      return
                    }
                    if (q.type === 'text' && !(typeof answers[q.id] === 'string' && String(answers[q.id]).trim())) {
                      alert(`Besvar: ${q.text.slice(0, 80)}…`)
                      return
                    }
                  }
                  const ok = oh.submitResponse(activeRespondSurvey.id, answers)
                  if (ok) setAnswers({})
                  else alert('Kunne ikke sende (allerede svart eller lukket).')
                }}
              />
            ) : (
              <p className="mt-4 text-sm text-neutral-500">Velg en åpen undersøkelse.</p>
            )}
          </section>
        </div>
      )}

      {tab === 'nav' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <strong>NAV / A-melding:</strong> Ekte sykefraværsdata hentes fra lønns- og personalsystem via NAVs
            rapportering. Her registrerer du <strong>aggregerte tall manuelt</strong> (f.eks. fra sykefraværsrapport
            eller lederverktøy). Kobling til API kan legges til senere.
          </div>
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Registrer periode</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!navForm.periodLabel.trim() || !navForm.periodStart || !navForm.periodEnd) return
                oh.addNavReport({
                  periodLabel: navForm.periodLabel.trim(),
                  periodStart: navForm.periodStart,
                  periodEnd: navForm.periodEnd,
                  sickLeavePercent: navForm.sickLeavePercent
                    ? Number(navForm.sickLeavePercent)
                    : null,
                  selfCertifiedDays: navForm.selfCertifiedDays
                    ? Number(navForm.selfCertifiedDays)
                    : null,
                  documentedSickDays: navForm.documentedSickDays
                    ? Number(navForm.documentedSickDays)
                    : null,
                  employeeCount: navForm.employeeCount ? Number(navForm.employeeCount) : null,
                  notes: navForm.notes,
                  sourceNote: navForm.sourceNote,
                })
                setNavForm((n) => ({
                  ...n,
                  periodLabel: '',
                  sickLeavePercent: '',
                  selfCertifiedDays: '',
                  documentedSickDays: '',
                }))
              }}
            >
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Periodenavn</label>
                <input
                  value={navForm.periodLabel}
                  onChange={(e) => setNavForm((n) => ({ ...n, periodLabel: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="F.eks. Februar 2026"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Fra</label>
                <input
                  type="date"
                  value={navForm.periodStart}
                  onChange={(e) => setNavForm((n) => ({ ...n, periodStart: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Til</label>
                <input
                  type="date"
                  value={navForm.periodEnd}
                  onChange={(e) => setNavForm((n) => ({ ...n, periodEnd: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Sykefravær (% av avtalt tid)</label>
                <input
                  type="number"
                  step="0.1"
                  value={navForm.sickLeavePercent}
                  onChange={(e) => setNavForm((n) => ({ ...n, sickLeavePercent: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Antall ansatte (nevner)</label>
                <input
                  type="number"
                  value={navForm.employeeCount}
                  onChange={(e) => setNavForm((n) => ({ ...n, employeeCount: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Egenmelding — dager (totalt)</label>
                <input
                  type="number"
                  value={navForm.selfCertifiedDays}
                  onChange={(e) => setNavForm((n) => ({ ...n, selfCertifiedDays: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Sykmelding — dager (totalt)</label>
                <input
                  type="number"
                  value={navForm.documentedSickDays}
                  onChange={(e) => setNavForm((n) => ({ ...n, documentedSickDays: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Kilde / merknad</label>
                <input
                  value={navForm.sourceNote}
                  onChange={(e) => setNavForm((n) => ({ ...n, sourceNote: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Notater</label>
                <textarea
                  value={navForm.notes}
                  onChange={(e) => setNavForm((n) => ({ ...n, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2"
              >
                <Activity className="size-4" />
                Lagre periode
              </button>
            </form>
          </section>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Historikk</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-600">
                    <th className="px-4 py-3 font-medium">Periode</th>
                    <th className="px-4 py-3 font-medium">Sykefravær %</th>
                    <th className="px-4 py-3 font-medium">Egenmelding (d)</th>
                    <th className="px-4 py-3 font-medium">Sykmelding (d)</th>
                    <th className="px-4 py-3 font-medium">Ansatte</th>
                    <th className="px-4 py-3 font-medium">Oppgave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {oh.navReports.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{r.periodLabel}</div>
                        <div className="text-xs text-neutral-500">
                          {r.periodStart} — {r.periodEnd}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.sickLeavePercent != null ? `${r.sickLeavePercent}%` : '—'}
                      </td>
                      <td className="px-4 py-3">{r.selfCertifiedDays ?? '—'}</td>
                      <td className="px-4 py-3">{r.documentedSickDays ?? '—'}</td>
                      <td className="px-4 py-3">{r.employeeCount ?? '—'}</td>
                      <td className="px-4 py-3 align-top">
                        <AddTaskLink
                          title={`IA-oppfølging sykefravær ${r.periodLabel}`}
                          description={r.notes?.slice(0, 200)}
                          module="org_health"
                          sourceType="nav_report"
                          sourceId={r.id}
                          sourceLabel={r.periodLabel}
                          ownerRole="Leder / IA"
                          requiresManagementSignOff
                          className="text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'reporting' && (
        <div className="mt-8 space-y-8">
          <div className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <strong>Anonym rapportering.</strong> Fritekst du skriver nedenfor{' '}
            <strong>lagres ikke</strong> — kun kategori, hastegrad og om du indikerte at du hadde mer å si. HR ser
            aggregerte oppføringer for oppfølging. For strukturert oppfølging med status, bruk{' '}
            <Link to="/internal-control?tab=whistle" className="font-medium underline">
              Internkontroll → varslingssaker
            </Link>
            . Henvisninger til AML er illustrative — verifiser mot{' '}
            <a href="https://lovdata.no" className="font-medium underline" target="_blank" rel="noreferrer">
              lovdata.no
            </a>{' '}
            og interne rutiner. Ved akutt fare: ring 113.
          </div>

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Send anonym melding</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Velg type henvendelse i tråd med arbeidsmiljøloven (varsling, arbeidsskade, trakassering, vold, psykososialt
              miljø m.m.).
            </p>
            {reportSubmitted ? (
              <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                Takk — meldingen er registrert anonymt. Ta kontakt med verneombud eller HR etter avtalte kanaler om du
                trenger oppfølging.
              </p>
            ) : (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const detailsIndicated = reportDetails.trim().length > 0
                  oh.submitAnonymousAmlReport(reportKind, {
                    detailsIndicated,
                    urgency: reportUrgency,
                  })
                  setReportDetails('')
                  setReportSubmitted(true)
                }}
              >
                <div>
                  <label className="text-xs font-medium text-neutral-500">Kategori</label>
                  <select
                    value={reportKind}
                    onChange={(e) => setReportKind(e.target.value as AmlReportKind)}
                    className="mt-1 w-full max-w-lg rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  >
                    {AML_REPORT_KINDS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-neutral-500">
                    {AML_REPORT_KINDS.find((k) => k.id === reportKind)?.hint}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500">Hastegrad (internt skjønn)</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(
                      [
                        ['low', 'Lav'],
                        ['medium', 'Middels'],
                        ['high', 'Høy'],
                      ] as const
                    ).map(([v, lab]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setReportUrgency(v)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                          reportUrgency === v
                            ? 'bg-[#1a3d32] text-white'
                            : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {lab}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500">
                    Merknad (valgfritt) — lagres <strong>ikke</strong>
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    rows={4}
                    placeholder="Skriv her om du vil — innholdet slettes ved innsending og lagres ikke."
                    className="mt-1 w-full rounded-xl border border-dashed border-amber-300/80 bg-amber-50/30 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Vi registrerer kun om du skrev noe (ja/nei), ikke teksten.
                  </p>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#142e26]"
                >
                  <Send className="size-4" />
                  Send anonymt
                </button>
              </form>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-gradient-to-r from-[#1a3d32]/5 to-amber-50/80 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Innsendte meldinger (HR-oversikt)</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Ingen fritekst — kun kategori, tidspunkt, hastegrad og om merknad ble indikert.
              </p>
            </div>
            <div className="overflow-x-auto">
              {oh.anonymousAmlReports.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen meldinger ennå.</p>
              ) : (
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                      <th className="px-4 py-3">Tid</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3">Hastegrad</th>
                      <th className="px-4 py-3">Merknad indikert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oh.anonymousAmlReports.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`border-b border-neutral-100 ${
                          i % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'
                        }`}
                      >
                        <td className="px-4 py-2.5 text-neutral-700">{formatWhen(r.submittedAt)}</td>
                        <td className="px-4 py-2.5 font-medium text-[#1a3d32]">
                          {labelForAmlReportKind(r.kind)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.urgency === 'high'
                                ? 'bg-red-100 text-red-900'
                                : r.urgency === 'medium'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {r.urgency === 'high' ? 'Høy' : r.urgency === 'medium' ? 'Middels' : 'Lav'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-neutral-600">{r.detailsIndicated ? 'Ja' : 'Nei'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'metrics' && (
        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Registrer indikator</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!metricForm.periodStart || !metricForm.periodEnd) return
                const def = definitionForKey(metricForm.metricKey)
                oh.addLaborMetric({
                  metricKey: metricForm.metricKey,
                  periodStart: metricForm.periodStart,
                  periodEnd: metricForm.periodEnd,
                  value: metricForm.value ? Number(metricForm.value) : null,
                  textValue: metricForm.textValue || undefined,
                  unit: def?.unit ?? '',
                  notes: metricForm.notes,
                })
                setMetricForm((m) => ({ ...m, value: '', textValue: '', notes: '' }))
              }}
            >
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Indikator</label>
                <select
                  value={metricForm.metricKey}
                  onChange={(e) =>
                    setMetricForm((m) => ({ ...m, metricKey: e.target.value as LaborMetricKey }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  {oh.metricDefinitions.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500">Fra</label>
                <input
                  type="date"
                  value={metricForm.periodStart}
                  onChange={(e) => setMetricForm((m) => ({ ...m, periodStart: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Til</label>
                <input
                  type="date"
                  value={metricForm.periodEnd}
                  onChange={(e) => setMetricForm((m) => ({ ...m, periodEnd: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Tallverdi (valgfritt)</label>
                <input
                  type="number"
                  value={metricForm.value}
                  onChange={(e) => setMetricForm((m) => ({ ...m, value: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Tekst / status (valgfritt)</label>
                <input
                  value={metricForm.textValue}
                  onChange={(e) => setMetricForm((m) => ({ ...m, textValue: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Notater</label>
                <textarea
                  value={metricForm.notes}
                  onChange={(e) => setMetricForm((m) => ({ ...m, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2"
              >
                <Send className="size-4" />
                Lagre
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Definisjoner (AML-orientert)</h2>
            </div>
            <ul className="divide-y divide-neutral-100">
              {oh.metricDefinitions.map((d) => (
                <li key={d.key} className="px-4 py-4 text-sm">
                  <div className="font-medium text-neutral-900">{d.label}</div>
                  <p className="mt-1 text-neutral-600">{d.description}</p>
                  <p className="mt-1 text-xs text-[#1a3d32]/90">{d.lawRef}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Registrerte målinger</h2>
            </div>
            <ul className="divide-y divide-neutral-100">
              {oh.laborMetrics.map((m) => {
                const def = definitionForKey(m.metricKey)
                return (
                  <li key={m.id} className="px-4 py-3 text-sm">
                    <span className="font-medium text-neutral-900">{def?.label ?? m.metricKey}</span>
                    <span className="text-neutral-600">
                      {' '}
                      — {m.periodStart} til {m.periodEnd}:{' '}
                      {m.value != null ? `${m.value} ${m.unit}` : m.textValue ?? '—'}
                    </span>
                    {m.notes ? <p className="mt-1 text-xs text-neutral-500">{m.notes}</p> : null}
                    <div className="mt-2">
                      <AddTaskLink
                        title={`Tiltak: ${def?.label ?? m.metricKey}`}
                        module="org_health"
                        sourceType="labor_metric"
                        sourceId={m.id}
                        sourceLabel={def?.label}
                        ownerRole="HMS"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {oh.laborMetrics.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">Ingen målinger ennå.</p>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="mt-8">
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Revisjonslogg</h2>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tilbakestill demodata for organisasjonshelse?')) oh.resetDemo()
                }}
                className="text-xs text-neutral-500 hover:underline"
              >
                Tilbakestill demo
              </button>
            </div>
            <ul className="max-h-[560px] divide-y divide-neutral-100 overflow-y-auto text-sm">
              {sortedAudit.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="text-xs text-neutral-500">
                    {formatWhen(a.at)} · <span className="font-mono">{a.action}</span>
                  </div>
                  <p className="mt-1 text-neutral-800">{a.message}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function SurveyAdminCard({
  survey,
  aggregate,
  onOpen,
  onClose,
  onAddQuestion,
  onSetSchedule,
}: {
  survey: Survey
  aggregate?: {
    count: number
    likertMeans: Record<string, number>
    textSamples: Record<string, string[]>
    anonymousTextCount?: Record<string, number>
  }
  onOpen: () => void
  onClose: () => void
  onAddQuestion: (text: string, type: SurveyQuestion['type'], required: boolean) => void
  onSetSchedule: (s: SurveySchedule | undefined) => void
}) {
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState<SurveyQuestion['type']>('likert_5')
  const [showScheduleEditor, setShowScheduleEditor] = useState(false)

  const sched = survey.schedule
  const now = new Date()
  const nextRun = sched?.nextRunAt ? new Date(sched.nextRunAt) : null
  const daysUntilNext = nextRun ? Math.ceil((nextRun.getTime() - now.getTime()) / 86400000) : null
  const scheduleLabel = sched ? SCHEDULE_KIND_LABELS[sched.kind] : null
  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-neutral-900">{survey.title}</h3>
          <p className="text-sm text-neutral-600">{survey.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>{survey.anonymous ? 'Anonym' : 'Ikke anonym'}</span>
            <span>·</span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${survey.status === 'open' ? 'bg-emerald-100 text-emerald-800' : survey.status === 'closed' ? 'bg-neutral-200 text-neutral-600' : 'bg-amber-100 text-amber-800'}`}>
              {survey.status === 'open' ? 'Åpen' : survey.status === 'closed' ? 'Lukket' : 'Utkast'}
            </span>
            <span>· {survey.questions.length} spørsmål</span>
            {survey.targetGroupLabel && <span>· {survey.targetGroupLabel}</span>}
          </div>
          {/* Schedule badge */}
          {sched && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${sched.enabled ? 'bg-sky-100 text-sky-800' : 'bg-neutral-100 text-neutral-500'}`}>
                <CalendarClock className="size-3.5" />
                {scheduleLabel}
                {sched.enabled && daysUntilNext != null && (
                  <span className="ml-1 font-normal">
                    {daysUntilNext <= 0 ? '— kjøres nå' : `— om ${daysUntilNext}d`}
                  </span>
                )}
                {!sched.enabled && ' (deaktivert)'}
              </span>
              {sched.runCount > 0 && (
                <span className="text-xs text-neutral-400">Kjørt {sched.runCount} gang{sched.runCount !== 1 ? 'er' : ''}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowScheduleEditor((v) => !v)}
            title="Planlegg"
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${showScheduleEditor ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
          >
            <CalendarClock className="inline size-3.5 mr-1" />
            Plan
          </button>
          {survey.status === 'draft' ? (
            <button type="button" onClick={onOpen} disabled={survey.questions.length === 0}
              className="rounded-full bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
              Åpne nå
            </button>
          ) : null}
          {survey.status === 'open' ? (
            <button type="button" onClick={onClose}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium">
              Lukk
            </button>
          ) : null}
        </div>
      </div>

      {/* Inline schedule editor */}
      {showScheduleEditor && (
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <ScheduleEditor
            current={survey.schedule}
            onSave={(s) => { onSetSchedule(s); setShowScheduleEditor(false) }}
            onRemove={() => { onSetSchedule(undefined); setShowScheduleEditor(false) }}
          />
        </div>
      )}
      <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm">
        {survey.questions.map((q) => (
          <li key={q.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-[#faf8f4] px-3 py-2">
            <span>{q.text}</span>
            <span className="text-xs text-neutral-500">
              {q.type === 'likert_5' ? 'Likert 1–5' : 'Fritekst'}
              {aggregate?.likertMeans[q.id] != null ? (
                <span className="ml-2 font-medium text-[#1a3d32]">
                  snitt {aggregate.likertMeans[q.id]} (n={aggregate.count})
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {survey.status === 'draft' && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Nytt spørsmål"
            className="min-w-[200px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
          <select
            value={qType}
            onChange={(e) => setQType(e.target.value as SurveyQuestion['type'])}
            className="rounded-xl border border-neutral-200 px-2 py-2 text-sm"
          >
            <option value="likert_5">Likert 1–5</option>
            <option value="text">Fritekst</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (!qText.trim()) return
              onAddQuestion(qText, qType, true)
              setQText('')
            }}
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            Legg til
          </button>
        </div>
      )}
      {survey.status === 'closed' && aggregate && aggregate.count > 0 ? (
        <div className="mt-4">
          <AddTaskLink
            title={`Tiltak etter undersøkelse: ${survey.title.slice(0, 60)}`}
            module="org_health"
            sourceType="survey"
            sourceId={survey.id}
            sourceLabel={survey.title}
            ownerRole="HR / leder"
            requiresManagementSignOff
          />
        </div>
      ) : null}
      {aggregate && aggregate.count > 0 && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
          {survey.anonymous ? (
            <>
              <strong className="text-neutral-800">Fritekst (anonym modus):</strong>
              <p className="mt-1 text-neutral-600">
                Innhold lagres ikke — kun antall som har levert fritekst vises.
              </p>
              {survey.questions
                .filter((q) => q.type === 'text')
                .map((q) => (
                  <p key={q.id} className="mt-2">
                    {q.text.slice(0, 60)}… —{' '}
                    <strong>{aggregate.anonymousTextCount?.[q.id] ?? 0}</strong> svar med tekst (av n=
                    {aggregate.count})
                  </p>
                ))}
            </>
          ) : (
            <>
              <strong className="text-neutral-800">Fritekst (utdrag):</strong>
              {survey.questions
                .filter((q) => q.type === 'text')
                .map((q) => (
                  <div key={q.id} className="mt-2">
                    {aggregate.textSamples[q.id]?.slice(0, 5).map((t, i) => (
                      <p key={i} className="mt-1 border-l-2 border-[#c9a227] pl-2">
                        {t}
                      </p>
                    )) ?? <p className="text-neutral-400">Ingen tekst ennå.</p>}
                  </div>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResponseForm({
  survey,
  answers,
  setAnswers,
  onSubmit,
}: {
  survey: Survey
  answers: Record<string, number | string>
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, number | string>>>
  onSubmit: () => void
}) {
  return (
    <div className="mt-4 space-y-4 rounded-xl border border-neutral-200 p-4">
      {survey.questions.map((q) => (
        <div key={q.id}>
          <label className="text-sm font-medium text-neutral-900">
            {q.text}
            {q.required ? <span className="text-red-600"> *</span> : null}
          </label>
          {(q.type === 'likert_5') && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {q.anchors && <span className="text-xs text-neutral-400">{q.anchors.low}</span>}
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                  className={`size-10 rounded-full text-sm font-medium ${answers[q.id] === n ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>{n}</button>
              ))}
              {q.anchors && <span className="text-xs text-neutral-400">{q.anchors.high}</span>}
            </div>
          )}
          {(q.type === 'likert_7') && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {q.anchors && <span className="text-xs text-neutral-400">{q.anchors.low}</span>}
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                  className={`size-9 rounded-full text-xs font-medium ${answers[q.id] === n ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>{n}</button>
              ))}
              {q.anchors && <span className="text-xs text-neutral-400">{q.anchors.high}</span>}
            </div>
          )}
          {(q.type === 'scale_10') && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1">
                {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button key={n} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                    className={`flex-1 rounded py-2 text-xs font-semibold ${answers[q.id] === n ? (n >= 9 ? 'bg-emerald-600 text-white' : n >= 7 ? 'bg-amber-400 text-white' : 'bg-red-500 text-white') : 'bg-neutral-100 hover:bg-neutral-200'}`}>{n}</button>
                ))}
              </div>
              {q.anchors && <div className="flex justify-between text-xs text-neutral-400"><span>{q.anchors.low}</span><span>{q.anchors.high}</span></div>}
            </div>
          )}
          {(q.type === 'yes_no') && (
            <div className="mt-2 flex gap-3">
              {['Ja', 'Nei'].map((v) => (
                <button key={v} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  className={`rounded-full px-6 py-2 text-sm font-medium ${answers[q.id] === v ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>{v}</button>
              ))}
            </div>
          )}
          {(q.type === 'text') && (
            <textarea value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              rows={3} className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
      >
        Send svar
      </button>
    </div>
  )
}

// ─── SurveyCreator — template picker + group selector ─────────────────────────

function SurveyCreator({ oh }: { oh: ReturnType<typeof useOrgHealth> }) {
  const org = useOrganisation()

  const [mode, setMode] = useState<'template' | 'custom'>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(ALL_SURVEY_TEMPLATES[0].id)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [targetGroupId, setTargetGroupId] = useState(org.groups[0]?.id ?? '')

  const filteredTemplates = categoryFilter === 'all'
    ? ALL_SURVEY_TEMPLATES
    : ALL_SURVEY_TEMPLATES.filter((t) => t.category === categoryFilter)

  const selectedTemplate = ALL_SURVEY_TEMPLATES.find((t) => t.id === selectedTemplateId)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const displayTitle = title.trim() || (selectedTemplate?.name ?? 'Egendefinert undersøkelse')
    const group = org.groups.find((g) => g.id === targetGroupId)

    if (mode === 'template' && selectedTemplate) {
      oh.createSurveyFromTemplate(
        selectedTemplate.id,
        selectedTemplate.questions as SurveyQuestion[],
        displayTitle,
        description || selectedTemplate.description,
        anonymous,
        targetGroupId || undefined,
        group ? org.getGroupLabel(group) : undefined,
      )
    } else {
      oh.createSurvey(displayTitle, description, anonymous, false)
    }
    setTitle('')
    setDescription('')
  }

  return (
    <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Ny undersøkelse</h2>
        <div className="flex gap-1 rounded-full border border-neutral-200 p-1">
          <button type="button" onClick={() => setMode('template')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'template' ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>
            <BookMarked className="size-3.5" />
            Fra mal
          </button>
          <button type="button" onClick={() => setMode('custom')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'custom' ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>
            <Plus className="size-3.5" />
            Egendefinert
          </button>
        </div>
      </div>

      <form className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={handleCreate}>
        <div className="space-y-4">
          {mode === 'template' && (
            <>
              {/* Category filter */}
              <div>
                <label className="text-xs font-medium text-neutral-500">Kategori</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setCategoryFilter('all')}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${categoryFilter === 'all' ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
                    Alle
                  </button>
                  {TEMPLATE_CATEGORIES.filter((c) => c.id !== 'custom').map((cat) => (
                    <button key={cat.id} type="button" onClick={() => setCategoryFilter(cat.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${categoryFilter === cat.id ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => { setSelectedTemplateId(tpl.id); setAnonymous(tpl.recommendAnonymous) }}
                    className={`rounded-xl border p-4 text-left transition-all ${selectedTemplateId === tpl.id ? 'border-[#1a3d32] bg-[#1a3d32]/5 ring-1 ring-[#1a3d32]' : 'border-neutral-200 hover:border-neutral-300'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-neutral-900">{tpl.shortName}</span>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">~{tpl.estimatedMinutes} min</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600 line-clamp-2">{tpl.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{tpl.questions.length} spørsmål</span>
                      {tpl.recommendAnonymous && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">Anbefalt anonym</span>}
                    </div>
                    <p className="mt-1.5 text-[10px] text-neutral-400 italic">{tpl.source}</p>
                  </button>
                ))}
              </div>

              {/* Selected template scoring info */}
              {selectedTemplate && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  <strong>Scoringveiledning:</strong> {selectedTemplate.scoringNote}
                </div>
              )}
            </>
          )}

          {/* Common fields */}
          <div>
            <label className="text-xs font-medium text-neutral-500">
              Tittel {mode === 'template' ? '(valgfritt — standard: malens navn)' : '*'}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required={mode === 'custom'}
              placeholder={selectedTemplate?.name ?? 'Skriv tittel…'}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500">Introduksjon / instruksjon</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={selectedTemplate?.useCase}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Right column: settings */}
        <div className="space-y-4">
          {/* Target group */}
          <div className="rounded-xl border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#1a3d32]" />
              <span className="text-sm font-semibold text-neutral-800">Målgruppe</span>
            </div>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="">— Ingen (åpen for alle)</option>
              {org.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({org.getGroupLabel(g)})
                </option>
              ))}
            </select>
            <Link to="/organisation" className="block text-xs text-[#1a3d32] hover:underline">
              + Administrer enheter og grupper →
            </Link>
          </div>

          {/* Privacy */}
          <div className="rounded-xl border border-neutral-200 p-4 space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Personvern</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
              />
              Anonyme svar (ingen identitet lagret)
            </label>
            {selectedTemplate?.recommendAnonymous && !anonymous && (
              <p className="text-xs text-amber-700">⚠ Denne malen anbefaler anonyme svar for å sikre ærlige svar.</p>
            )}
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-3 text-sm font-medium text-white hover:bg-[#142e26]"
          >
            <Plus className="size-4" />
            {mode === 'template' ? `Opprett fra «${selectedTemplate?.shortName ?? 'mal'}»` : 'Opprett egendefinert'}
          </button>
        </div>
      </form>
    </section>
  )
}

// ─── Schedule constants + ScheduleEditor component ───────────────────────────

const SCHEDULE_KIND_LABELS: Record<SurveyScheduleKind, string> = {
  once:      'Én gang',
  weekly:    'Ukentlig',
  monthly:   'Månedlig',
  quarterly: 'Kvartalsvis',
  yearly:    'Årlig',
  custom:    'Egendefinert intervall',
}

function ScheduleEditor({
  current,
  onSave,
  onRemove,
}: {
  current?: SurveySchedule
  onSave: (s: SurveySchedule) => void
  onRemove: () => void
}) {
  const [kind, setKind] = useState<SurveyScheduleKind>(current?.kind ?? 'once')
  const [startsAt, setStartsAt] = useState(
    current?.startsAt
      ? current.startsAt.slice(0, 16)
      : // eslint-disable-next-line react-hooks/purity -- default start time for new schedule
        new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  )
  const [openForHours, setOpenForHours] = useState(current?.openForHours ?? 72)
  const [intervalN, setIntervalN] = useState(current?.intervalN ?? 1)
  const [endsAt, setEndsAt] = useState(current?.endsAt ? current.endsAt.slice(0, 10) : '')
  const [enabled, setEnabled] = useState(current?.enabled ?? true)

  const showInterval = kind === 'weekly' || kind === 'monthly' || kind === 'custom'
  const intervalLabel =
    kind === 'weekly' ? 'Hver N. uke' :
    kind === 'monthly' ? 'Hver N. måned' :
    'Intervall (dager)'

  function handleSave() {
    onSave({
      kind,
      startsAt: new Date(startsAt).toISOString(),
      openForHours,
      intervalN: showInterval ? intervalN : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      runCount: current?.runCount ?? 0,
      enabled,
      nextRunAt: current?.nextRunAt ?? new Date(startsAt).toISOString(),
      lastTriggeredAt: current?.lastTriggeredAt,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock className="size-4 text-sky-700" />
        <span className="text-sm font-semibold text-neutral-800">Planlegging</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Kind */}
        <div>
          <label className="text-xs font-medium text-neutral-500">Gjentakelse</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as SurveyScheduleKind)}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
            {(Object.keys(SCHEDULE_KIND_LABELS) as SurveyScheduleKind[]).map((k) => (
              <option key={k} value={k}>{SCHEDULE_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>

        {/* Interval N */}
        {showInterval && (
          <div>
            <label className="text-xs font-medium text-neutral-500">{intervalLabel}</label>
            <input type="number" min={1} max={365} value={intervalN}
              onChange={(e) => setIntervalN(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </div>
        )}

        {/* Starts at */}
        <div>
          <label className="text-xs font-medium text-neutral-500">
            {kind === 'once' ? 'Åpnes' : 'Første kjøring'}
          </label>
          <input type="datetime-local" value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
        </div>

        {/* Open for hours */}
        <div>
          <label className="text-xs font-medium text-neutral-500">
            Åpen i (timer) — 0 = manuell lukking
          </label>
          <input type="number" min={0} max={8760} value={openForHours}
            onChange={(e) => setOpenForHours(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
        </div>

        {/* Ends at — only for recurring */}
        {kind !== 'once' && (
          <div>
            <label className="text-xs font-medium text-neutral-500">Slutt dato (valgfritt)</label>
            <input type="date" value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </div>
        )}

        {/* Enabled */}
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
            Tidsplan aktiv
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800">
        {kind === 'once' && `Undersøkelsen åpnes automatisk ${new Date(startsAt).toLocaleString('no-NO')}${openForHours > 0 ? `, lukkes etter ${openForHours} timer` : ', lukkes manuelt'}.`}
        {kind === 'weekly' && `Kjøres hver ${intervalN}. uke fra ${new Date(startsAt).toLocaleDateString('no-NO')}${openForHours > 0 ? `, åpen i ${openForHours} timer` : ''}${endsAt ? ` til ${endsAt}` : ''}.`}
        {kind === 'monthly' && `Kjøres hver ${intervalN}. måned fra ${new Date(startsAt).toLocaleDateString('no-NO')}${endsAt ? ` til ${endsAt}` : ''}.`}
        {kind === 'quarterly' && `Kjøres hvert kvartal fra ${new Date(startsAt).toLocaleDateString('no-NO')}${endsAt ? ` til ${endsAt}` : ''}.`}
        {kind === 'yearly' && `Kjøres hvert år fra ${new Date(startsAt).toLocaleDateString('no-NO')}${endsAt ? ` til ${endsAt}` : ''}.`}
        {kind === 'custom' && `Kjøres hver ${intervalN}. dag fra ${new Date(startsAt).toLocaleDateString('no-NO')}${endsAt ? ` til ${endsAt}` : ''}.`}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={handleSave}
          className="flex items-center gap-1.5 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
          <CalendarClock className="size-4" />
          Lagre tidsplan
        </button>
        {current && (
          <button type="button" onClick={onRemove}
            className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            Fjern tidsplan
          </button>
        )}
      </div>
    </div>
  )
}
