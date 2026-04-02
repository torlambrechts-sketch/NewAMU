import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  HeartPulse,
  History,
  Plus,
  Send,
  ShieldAlert,
} from 'lucide-react'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { AML_REPORT_KINDS, labelForAmlReportKind } from '../data/amlAnonymousReporting'
import { definitionForKey } from '../data/orgHealthMetrics'
import {
  LIKERT_SCALE_ANCHORS_NB,
  MIN_RESPONSES_FOR_CONFIDENT_DETAIL,
  PSYKOSOCIAL_DIMENSION_LABELS,
  PSYKOSOCIAL_DIMENSION_ORDER,
  PSYKOSOCIAL_PRIVACY_NOTICE,
} from '../data/psykosocialSurveyTemplate'
import { useOrgHealth } from '../hooks/useOrgHealth'
import type { AmlReportKind, LaborMetricKey, PsykosocialDimension, Survey, SurveyQuestion } from '../types/orgHealth'

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
  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')
  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'
  const setTab = (id: TabId) => setSearchParams({ tab: id }, { replace: true })
  const [surveyForm, setSurveyForm] = useState({
    title: '',
    description: '',
    anonymous: true,
    template: 'psykosocial_aml' as 'empty' | 'general_short' | 'psykosocial_aml',
  })
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
            Medarbeiderundersøkelser med mal for <strong>psykososialt arbeidsmiljø</strong> (dimensjoner som krav,
            kontroll, støtte — jfr. systematisk kartlegging i HMS), aggregerte resultater, sykefravær fra NAV-rapportering
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
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Ny undersøkelse</h2>
            <form
              className="mt-4 grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!surveyForm.title.trim()) return
                oh.createSurvey(surveyForm.title, surveyForm.description, surveyForm.anonymous, surveyForm.template)
                setSurveyForm((x) => ({ ...x, title: '', description: '' }))
              }}
            >
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Tittel</label>
                <input
                  value={surveyForm.title}
                  onChange={(e) => setSurveyForm((s) => ({ ...s, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Introduksjon</label>
                <textarea
                  value={surveyForm.description}
                  onChange={(e) => setSurveyForm((s) => ({ ...s, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={surveyForm.anonymous}
                  onChange={(e) => setSurveyForm((s) => ({ ...s, anonymous: e.target.checked }))}
                  className="rounded border-neutral-300 text-[#1a3d32]"
                />
                <span className="text-sm">Anonyme svar (ingen identitet lagret)</span>
              </label>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Mal</label>
                <select
                  value={surveyForm.template}
                  onChange={(e) =>
                    setSurveyForm((s) => ({
                      ...s,
                      template: e.target.value as 'empty' | 'general_short' | 'psykosocial_aml',
                    }))
                  }
                  className="mt-1 w-full max-w-lg rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="psykosocial_aml">
                    Psykososial kartlegging (AML) — krav, kontroll, støtte, rolle, endring m.m.
                  </option>
                  <option value="general_short">Kort pulse (3 spørsmål)</option>
                  <option value="empty">Tom — legg til egne spørsmål</option>
                </select>
                <p className="mt-2 text-xs text-neutral-500">
                  Psykososial-mal følger vanlig praksis for systematisk kartlegging; resultater vises per dimensjon og
                  samlet indeks (normalisert skala der høyere er bedre).
                </p>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] md:col-span-2"
              >
                <Plus className="size-4" />
                Opprett
              </button>
            </form>
          </section>

          <div className="space-y-6">
            {oh.surveys.map((s) => (
              <SurveyAdminCard
                key={s.id}
                survey={s}
                aggregate={oh.aggregates[s.id]}
                onOpen={() => oh.openSurvey(s.id)}
                onClose={() => oh.closeSurvey(s.id)}
                onAddQuestion={(text, type, req) => oh.addQuestion(s.id, text, type, req)}
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
}: {
  survey: Survey
  aggregate?: {
    count: number
    likertMeans: Record<string, number>
    likertMeansNormalized?: Record<string, number>
    textSamples: Record<string, string[]>
    anonymousTextCount?: Record<string, number>
    dimensionMeans?: Partial<Record<PsykosocialDimension, number>>
    psykosocialIndex?: number | null
  }
  onOpen: () => void
  onClose: () => void
  onAddQuestion: (text: string, type: SurveyQuestion['type'], required: boolean) => void
}) {
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState<SurveyQuestion['type']>('likert_5')
  const isPsy = survey.purpose === 'psykosocial_aml'
  const lowN = (aggregate?.count ?? 0) > 0 && (aggregate?.count ?? 0) < MIN_RESPONSES_FOR_CONFIDENT_DETAIL
  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-neutral-900">{survey.title}</h3>
          <p className="text-sm text-neutral-600">{survey.description}</p>
          <p className="mt-2 text-xs text-neutral-500">
            {survey.anonymous ? 'Anonym' : 'Ikke anonym'} · {survey.status} · {survey.questions.length}{' '}
            spørsmål
            {isPsy ? (
              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-900">
                Psykososial (AML-mal)
              </span>
            ) : null}
          </p>
          {survey.anonymous ? (
            <p className="mt-2 rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-600">
              {isPsy ? PSYKOSOCIAL_PRIVACY_NOTICE : 'Anonym modus: fritekst lagres ikke ved anonyme undersøkelser.'}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {survey.status === 'draft' ? (
            <button
              type="button"
              onClick={onOpen}
              disabled={survey.questions.length === 0}
              className="rounded-full bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Åpne
            </button>
          ) : null}
          {survey.status === 'open' ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium"
            >
              Lukk
            </button>
          ) : null}
        </div>
      </div>
      {isPsy && aggregate && aggregate.count > 0 && aggregate.psykosocialIndex != null ? (
        <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-[#1a3d32]">Samlet psykososial indeks (normalisert)</span>
            <span className="text-2xl font-bold text-[#1a3d32]">{aggregate.psykosocialIndex}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Skala 1–5 der <strong>høyere er bedre</strong> (belastningsspørsmål er snudd). Brukes som oversikt — vurder
            alltid sammen med kvalitative kilder og ROS.
          </p>
          {lowN ? (
            <p className="mt-2 text-xs font-medium text-amber-900">
              Under {MIN_RESPONSES_FOR_CONFIDENT_DETAIL} svar: tolkes forsiktig — risiko for identifisering av enkelt
              svar eller små grupper.
            </p>
          ) : null}
        </div>
      ) : null}
      {isPsy && aggregate?.dimensionMeans && Object.keys(aggregate.dimensionMeans).length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {PSYKOSOCIAL_DIMENSION_ORDER.filter((d) => aggregate.dimensionMeans?.[d] != null).map((d) => {
            const meta = PSYKOSOCIAL_DIMENSION_LABELS[d]
            const v = aggregate.dimensionMeans![d]!
            return (
              <div key={d} className="rounded-lg border border-neutral-100 bg-[#faf8f4] px-3 py-2 text-sm">
                <div className="font-medium text-neutral-900">{meta.title}</div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-neutral-600">{meta.hint}</span>
                  <span className="shrink-0 text-lg font-semibold text-[#1a3d32]">{v}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
      <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm">
        {survey.questions.map((q) => (
          <li key={q.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-[#faf8f4] px-3 py-2">
            <span>
              {q.text}
              {q.dimension ? (
                <span className="ml-2 text-xs text-neutral-400">
                  ({PSYKOSOCIAL_DIMENSION_LABELS[q.dimension]?.title ?? q.dimension})
                </span>
              ) : null}
            </span>
            <span className="text-xs text-neutral-500">
              {q.type === 'likert_5' ? 'Likert 1–5' : 'Fritekst'}
              {q.reverseScored ? <span className="ml-1 text-amber-800">(belastning, snudd i analyse)</span> : null}
              {aggregate?.likertMeansNormalized?.[q.id] != null ? (
                <span className="ml-2 font-medium text-[#1a3d32]">
                  snitt {aggregate.likertMeansNormalized[q.id]} (n={aggregate.count})
                </span>
              ) : aggregate?.likertMeans[q.id] != null ? (
                <span className="ml-2 font-medium text-[#1a3d32]">
                  råsnitt {aggregate.likertMeans[q.id]} (n={aggregate.count})
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
  const isPsy = survey.purpose === 'psykosocial_aml'
  const byDim: Partial<Record<PsykosocialDimension, SurveyQuestion[]>> = {}
  if (isPsy) {
    for (const q of survey.questions) {
      if (q.type === 'likert_5' && q.dimension) {
        if (!byDim[q.dimension]) byDim[q.dimension] = []
        byDim[q.dimension]!.push(q)
      }
    }
  }
  const dimOrder = PSYKOSOCIAL_DIMENSION_ORDER.filter((d) => byDim[d]?.length)
  const renderLikert = (q: SurveyQuestion) => (
    <div key={q.id}>
      <label className="text-sm font-medium text-neutral-900">
        {q.text}
        {q.required ? <span className="text-red-600"> *</span> : null}
      </label>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>{LIKERT_SCALE_ANCHORS_NB.low}</span>
        <span className="text-neutral-300">|</span>
        <span>{LIKERT_SCALE_ANCHORS_NB.high}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
            className={`size-10 rounded-full text-sm font-medium ${
              answers[q.id] === n
                ? 'bg-[#1a3d32] text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="mt-4 space-y-6 rounded-xl border border-neutral-200 p-4">
      {isPsy && dimOrder.length > 0 ? (
        <>
          {dimOrder.map((d) => (
            <div key={d} className="space-y-3 rounded-lg border border-neutral-100 bg-white p-3">
              <h3 className="text-sm font-semibold text-[#1a3d32]">
                {PSYKOSOCIAL_DIMENSION_LABELS[d].title}
              </h3>
              <p className="text-xs text-neutral-600">{PSYKOSOCIAL_DIMENSION_LABELS[d].hint}</p>
              {(byDim[d] ?? []).map((q) => renderLikert(q))}
            </div>
          ))}
          {survey.questions
            .filter((q) => q.type === 'text')
            .map((q) => (
              <div key={q.id}>
                <label className="text-sm font-medium text-neutral-900">
                  {q.text}
                  {q.required ? <span className="text-red-600"> *</span> : null}
                </label>
                <textarea
                  value={typeof answers[q.id] === 'string' ? answers[q.id] : ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
                {survey.anonymous ? (
                  <p className="mt-1 text-xs text-amber-900">
                    Anonym modus: fritekst lagres ikke — bruk feltet om du vil gi et signal til HR om at du har mer å si
                    (innhold slettes ved innsending).
                  </p>
                ) : null}
              </div>
            ))}
        </>
      ) : (
        survey.questions.map((q) =>
          q.type === 'likert_5' ? (
            renderLikert(q)
          ) : (
            <div key={q.id}>
              <label className="text-sm font-medium text-neutral-900">
                {q.text}
                {q.required ? <span className="text-red-600"> *</span> : null}
              </label>
              <textarea
                value={typeof answers[q.id] === 'string' ? answers[q.id] : ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={3}
                className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
          ),
        )
      )}
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
