import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Lock,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { LegalDisclaimer } from '../components/internalControl/LegalDisclaimer'
import { ROS_TEMPLATE_HELP, RISK_COLOUR_CLASSES, computeRiskScore, riskColour } from '../data/rosTemplate'
import { labelForAmlReportKind } from '../data/amlAnonymousReporting'
import { useInternalControl } from '../hooks/useInternalControl'
import { useOrgHealth } from '../hooks/useOrgHealth'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import type { RosCategory, WhistleCaseStatus } from '../types/internalControl'
import { useHrCompliance } from '../hooks/useHrCompliance'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { WizardButton } from '../components/wizard/WizardButton'
import { makeRosWizard } from '../components/wizard/wizards'

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: LayoutDashboard },
  { id: 'whistle' as const, label: 'Varslingssaker', icon: Scale },
  { id: 'ros' as const, label: 'ROS / risiko', icon: ClipboardList },
  { id: 'annual' as const, label: 'Årsgjennomgang', icon: Calendar },
  { id: 'audit' as const, label: 'Logg', icon: History },
]

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

const statusOrder: WhistleCaseStatus[] = [
  'received',
  'triage',
  'investigation',
  'internal_review',
  'closed',
]

export function InternalControlModule() {
  const ic = useInternalControl()
  const hr = useHrCompliance()
  const oh = useOrgHealth()
  const { supabaseConfigured } = useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()
  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')
  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'
  const setTab = (id: TabId) => setSearchParams({ tab: id }, { replace: true })

  const [newCaseTitle, setNewCaseTitle] = useState('')
  const [rosTitle, setRosTitle] = useState('')
  const [rosDept, setRosDept] = useState('')
  const [rosAssessor, setRosAssessor] = useState('')
  const [rosCategory, setRosCategory] = useState<RosCategory>('general')
  const [oRosAmuId, setORosAmuId] = useState('')
  const [oRosVoId, setORosVoId] = useState('')
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear())
  const [annualReviewer, setAnnualReviewer] = useState('')
  const [annualSummary, setAnnualSummary] = useState('')
  const [annualNext, setAnnualNext] = useState(
    `${new Date().getFullYear() + 1}-12-31`,
  )

  const sortedAudit = useMemo(
    () => [...ic.auditTrail].sort((a, b) => b.at.localeCompare(a.at)),
    [ic.auditTrail],
  )

  const caseIdsFromReports = useMemo(() => {
    const s = new Set<string>()
    for (const c of ic.whistleCases) {
      if (c.sourceAnonymousReportId) s.add(c.sourceAnonymousReportId)
    }
    return s
  }, [ic.whistleCases])

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Prosjekter
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Internkontroll</span>
      </nav>

      <LegalDisclaimer />

      {ic.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{ic.error}</p>
      )}
      {ic.loading && supabaseConfigured && (
        <p className="mt-4 text-sm text-neutral-500">Laster internkontrolldata…</p>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Internkontroll & varsling
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-600">
            Samlet spor for <strong>varslingssaker med status</strong>, <strong>ROS-maler</strong>,{' '}
            <strong>årsgjennomgang</strong> og kobling til anonyme meldinger fra organisasjonshelse. Bruk intern revisjon
            etter egen fullmakt — dette verktøyet er ikke en full internkontroll i forskriftens forstand alene.
          </p>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900">Status</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{ic.stats.whistleOpen}</div>
                <div className="text-sm text-neutral-600">Åpne varslingssaker</div>
              </div>
              <div className="rounded-xl bg-amber-50/90 p-4 ring-1 ring-amber-200/80">
                <div className="text-2xl font-semibold text-[#1a3d32]">{ic.stats.whistleInReview}</div>
                <div className="text-sm text-neutral-600">I intern revisjon</div>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{ic.stats.rosCount}</div>
                <div className="text-sm text-neutral-600">ROS-vurderinger</div>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{ic.stats.annualCount}</div>
                <div className="text-sm text-neutral-600">Årsgjennomganger</div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab('whistle')}
                className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
              >
                Varslingssaker
              </button>
              <button
                type="button"
                onClick={() => setTab('ros')}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
              >
                Ny ROS
              </button>
              <Link
                to="/org-health?tab=reporting"
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
              >
                Anonym rapportering
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Meldingsflyt (oversikt)</h2>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-neutral-700">
              <li>Mottatt → vurdering → undersøkelse</li>
              <li>
                <strong>Intern revisjon</strong> når saken etter rutine skal behandles av HR/ledelse/revisor
              </li>
              <li>Avsluttet når dokumentert oppfølging er gjort</li>
            </ol>
            <p className="mt-4 text-xs text-neutral-500">
              Kobling fra anonym AML-melding oppretter sak med referanse-ID — innholdet fra anonym innsending lagres ikke
              i org.health.
            </p>
          </div>
        </div>
      )}

      {tab === 'whistle' && (
        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Ny sak (manuell)</h2>
            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newCaseTitle.trim()) return
                ic.createWhistleCase({ title: newCaseTitle })
                setNewCaseTitle('')
              }}
            >
              <input
                value={newCaseTitle}
                onChange={(e) => setNewCaseTitle(e.target.value)}
                placeholder="Tittel på varslingssak"
                className="min-w-[220px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
              >
                Opprett
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-[#1a3d32]/15 bg-gradient-to-r from-[#1a3d32]/8 to-transparent px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Alle varslingssaker</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase text-neutral-600">
                    <th className="px-4 py-3">Sak</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ansvarlig</th>
                    <th className="px-4 py-3">Oppdatert</th>
                    <th className="px-4 py-3">Handlinger</th>
                  </tr>
                </thead>
                <tbody>
                  {ic.whistleCases.map((c, i) => (
                    <tr
                      key={c.id}
                      className={`border-b border-neutral-100 ${i % 2 === 0 ? 'bg-white' : 'bg-emerald-50/25'}`}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-neutral-900">{c.title}</div>
                        {c.sourceAnonymousReportId ? (
                          <div className="text-xs text-neutral-500">
                            Ref. anonym: {c.sourceAnonymousReportId.slice(0, 8)}…
                          </div>
                        ) : null}
                        <textarea
                          value={c.internalNotes}
                          onChange={(e) => ic.updateWhistleNotes(c.id, e.target.value)}
                          rows={2}
                          className="mt-2 w-full max-w-md rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                          placeholder="Interne notater…"
                        />
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {c.categoryKind ? labelForAmlReportKind(c.categoryKind) : '—'}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={c.status}
                          onChange={(e) =>
                            ic.updateWhistleStatus(c.id, e.target.value as WhistleCaseStatus)
                          }
                          className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs"
                        >
                          {statusOrder.map((s) => (
                            <option key={s} value={s}>
                              {ic.statusLabels[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{c.assignee}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500">{formatWhen(c.updatedAt)}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-2">
                          {c.status !== 'internal_review' && c.status !== 'closed' ? (
                            <button
                              type="button"
                              onClick={() => ic.sendToInternalReview(c.id)}
                              className="whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                            >
                              Send til intern revisjon
                            </button>
                          ) : null}
                          <AddTaskLink
                            title={`Oppfølging varslingssak: ${c.title.slice(0, 60)}`}
                            module="org_health"
                            sourceType="manual"
                            sourceId={c.id}
                            sourceLabel={c.title}
                            ownerRole="HR / revisjon"
                            requiresManagementSignOff
                            className="inline-flex w-fit items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs"
                          >
                            Oppgave
                          </AddTaskLink>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Anonyme meldinger uten sak</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Opprett varslingssak fra organisasjonshelse når meldingen skal følges opp strukturert.
            </p>
            <ul className="mt-4 space-y-2">
              {oh.anonymousAmlReports.filter((r) => !caseIdsFromReports.has(r.id)).length === 0 ? (
                <li className="text-sm text-neutral-500">Alle meldinger har sak, eller ingen meldinger.</li>
              ) : (
                oh.anonymousAmlReports
                  .filter((r) => !caseIdsFromReports.has(r.id))
                  .map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-[#faf8f4] px-3 py-2 text-sm"
                    >
                      <span>
                        {formatWhen(r.submittedAt)} · {labelForAmlReportKind(r.kind)} · {r.urgency}
                      </span>
                      <button
                        type="button"
                        onClick={() => ic.createCaseFromAnonymousReport(r)}
                        className="rounded-full bg-[#1a3d32] px-3 py-1 text-xs font-medium text-white"
                      >
                        Opprett sak
                      </button>
                    </li>
                  ))
              )}
            </ul>
          </section>
        </div>
      )}

      {tab === 'ros' && (
        <div className="mt-8 space-y-8">
          <LegalDisclaimer compact />

          {/* Help + legend */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <p className="font-medium text-[#1a3d32]">{ROS_TEMPLATE_HELP.title}</p>
            <p className="mt-2">{ROS_TEMPLATE_HELP.intro}</p>
            <ul className="mt-2 list-inside list-disc text-xs text-neutral-600">
              <li>{ROS_TEMPLATE_HELP.severityScale}</li>
              <li>{ROS_TEMPLATE_HELP.likelihoodScale}</li>
              <li>Risikoscore = alvor × sannsynlighet (brutto). Restrisiko = ny alvor × ny sannsynlighet etter tiltak.</li>
            </ul>
            {/* Colour legend */}
            <div className="mt-3 flex flex-wrap gap-3">
              {(['green', 'yellow', 'red'] as const).map((c) => {
                const cls = RISK_COLOUR_CLASSES[c]
                return (
                  <span key={c} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cls.bg} ${cls.text} ${cls.border}`}>
                    {cls.label} {c === 'green' ? '(1–6)' : c === 'yellow' ? '(8–12)' : '(15–25)'}
                  </span>
                )
              })}
            </div>
          </div>

          {/* New ROS form */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/90 bg-white px-5 pt-5 pb-1">
            <h2 className="text-base font-semibold text-neutral-900">Ny ROS-vurdering</h2>
            <WizardButton
              label="Veiviser"
              variant="solid"
              def={makeRosWizard((data) =>
                ic.createRosAssessment(String(data.title), String(data.department), String(data.assessor), {
                  category: 'general',
                }),
              )}
            />
          </div>
          <form
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              if (!rosTitle.trim()) return
              const isO = rosCategory === 'organizational_change'
              const r = ic.createRosAssessment(rosTitle, rosDept, rosAssessor, {
                category: rosCategory,
                seedORosRows: isO,
              })
              if (isO && r && supabaseConfigured && oRosAmuId && oRosVoId) {
                void hr.upsertRosSignoff(r.id, oRosAmuId, oRosVoId)
              }
              setRosTitle('')
              setRosDept('')
              setRosAssessor('')
              setRosCategory('general')
              setORosAmuId('')
              setORosVoId('')
            }}
          >
            <div>
              <label className="text-xs text-neutral-500">Tittel</label>
              <input value={rosTitle} onChange={(e) => setRosTitle(e.target.value)} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" placeholder="f.eks. ROS — Lager 2026" required />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Kategori</label>
              <select
                value={rosCategory}
                onChange={(e) => setRosCategory(e.target.value as RosCategory)}
                className="mt-1 block rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              >
                <option value="general">Generell ROS</option>
                <option value="organizational_change">Organisatorisk endring (O-ROS)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Avdeling</label>
              <input value={rosDept} onChange={(e) => setRosDept(e.target.value)} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Vurdert av</label>
              <input value={rosAssessor} onChange={(e) => setRosAssessor(e.target.value)} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
            </div>
            {rosCategory === 'organizational_change' && hr.orgUsers.length > 0 && (
              <>
                <div>
                  <label className="text-xs text-neutral-500">AMU-representant (signatur)</label>
                  <select
                    value={oRosAmuId}
                    onChange={(e) => setORosAmuId(e.target.value)}
                    className="mt-1 block max-w-[220px] rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {hr.orgUsers.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Verneombud (signatur)</label>
                  <select
                    value={oRosVoId}
                    onChange={(e) => setORosVoId(e.target.value)}
                    className="mt-1 block max-w-[220px] rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {hr.orgUsers.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <button type="submit" className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]">Ny ROS</button>
          </form>
          {rosCategory === 'organizational_change' && (
            <p className="mt-2 text-xs text-amber-800">
              O-ROS: forhåndsutfylte farer (kompetansetap, rolleuklarhet, psykososial belastning). Velg AMU og verneombud —
              ROS kan ikke låses før begge har signert i HR-modulen.
            </p>
          )}

          {/* ROS assessments */}
          {ic.rosAssessments.map((ros) => (
            <RosAssessmentCard key={ros.id} ros={ros} ic={ic} hr={hr} />
          ))}
        </div>
      )}

      {tab === 'annual' && (
        <div className="mt-8 space-y-6">
          <LegalDisclaimer compact />
          <form
            className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              ic.addAnnualReview({
                year: annualYear,
                reviewedAt: new Date().toISOString().slice(0, 10),
                reviewer: annualReviewer.trim() || 'Ukjent',
                summary: annualSummary.trim(),
                nextReviewDue: annualNext,
              })
              setAnnualSummary('')
            }}
          >
            <h2 className="text-lg font-semibold text-neutral-900">Registrer årsgjennomgang</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Dokumenter at internkontrollen er gjennomgått (jf. internkontrollforskriften § 5) —{' '}
              <strong>illustrativt skjema</strong>.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-neutral-500">År</label>
                <input
                  type="number"
                  value={annualYear}
                  onChange={(e) => setAnnualYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Gjennomført av</label>
                <input
                  value={annualReviewer}
                  onChange={(e) => setAnnualReviewer(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                  placeholder="Navn / rolle"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Oppsummering</label>
                <textarea
                  value={annualSummary}
                  onChange={(e) => setAnnualSummary(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                  required
                  placeholder="Hva ble vurdert, hovedfunn, vedtatte tiltak …"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Neste planlagte gjennomgang (dato)</label>
                <input
                  type="date"
                  value={annualNext}
                  onChange={(e) => setAnnualNext(e.target.value)}
                  className="mt-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
            >
              <FileText className="size-4" />
              Lagre årsgjennomgang
            </button>
          </form>

          <ul className="space-y-3">
            {ic.annualReviews.map((a) => (
              <li key={a.id} className="rounded-xl border border-neutral-200 bg-[#faf8f4] p-4 text-sm">
                <div className="font-semibold text-[#1a3d32]">
                  År {a.year} — {a.reviewer}
                </div>
                <div className="text-xs text-neutral-500">
                  Registrert {a.reviewedAt} · Neste: {a.nextReviewDue}
                </div>
                <p className="mt-2 text-neutral-800">{a.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'audit' && (
        <div className="mt-8">
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Hendelseslogg (internkontroll)</h2>
            </div>
            <ul className="max-h-[560px] divide-y divide-neutral-100 overflow-y-auto text-sm">
              {sortedAudit.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="text-xs text-neutral-500">{formatWhen(a.at)} · {a.action}</div>
                  <p className="mt-1 text-neutral-800">{a.message}</p>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm('Tilbakestill internkontroll-demo?')) ic.resetDemo()
            }}
            className="mt-4 text-sm text-neutral-500 underline hover:text-neutral-800"
          >
            Tilbakestill demo
          </button>
        </div>
      )}
    </div>
  )
}

// ─── RosAssessmentCard ────────────────────────────────────────────────────────

function RosAssessmentCard({
  ros,
  ic,
  hr,
}: {
  ros: import('../types/internalControl').RosAssessment
  ic: ReturnType<typeof useInternalControl>
  hr: ReturnType<typeof useHrCompliance>
}) {
  const [leaderName, setLeaderName] = useState('')
  const [verneombudName, setVerneombudName] = useState('')

  const leaderSig = ros.signatures.find((s) => s.role === 'leader')
  const verneombudSig = ros.signatures.find((s) => s.role === 'verneombud')
  const bothSigned = !!leaderSig && !!verneombudSig
  const oRosBlock = hr.rosSignoffs.find((s) => s.ros_assessment_id === ros.id)
  const oRosBlocked = ros.rosCategory === 'organizational_change' && oRosBlock?.blocked === true
  const isLocked = ros.locked

  function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'short' }) } catch { return iso }
  }

  // 5×5 risk matrix — plot rows by gross score position
  const matrix = Array.from({ length: 5 }, (_, si) =>
    Array.from({ length: 5 }, (_, li) => {
      const s = 5 - si   // severity top=5, bottom=1
      const l = li + 1   // likelihood left=1, right=5
      const score = s * l
      const colour = riskColour(score)
      const rowsHere = ros.rows.filter((r) => r.severity === s && r.likelihood === l)
      const residualHere = ros.rows.filter((r) =>
        r.residualSeverity === s && r.residualLikelihood === l,
      )
      return { s, l, score, colour, rows: rowsHere, residual: residualHere }
    }),
  )

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isLocked ? 'border-emerald-200' : 'border-neutral-200/90'}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-neutral-900">{ros.title}</h3>
            {ros.rosCategory === 'organizational_change' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                O-ROS
              </span>
            )}
            {isLocked && <Lock className="size-4 text-emerald-600" aria-label="Låst — begge signaturer innhentet" />}
          </div>
          {oRosBlocked && (
            <p className="mt-1 text-xs font-medium text-amber-800">
              Sperret til AMU og verneombud har signert under HR → O-ROS.
            </p>
          )}
          <p className="text-xs text-neutral-500">{ros.department} · {ros.assessor} · {ros.assessedAt}</p>
        </div>
        {!isLocked && (
          <button type="button" onClick={() => ic.addRosRow(ros.id)}
            className="text-sm font-medium text-[#1a3d32] hover:underline">
            + Rad
          </button>
        )}
      </div>

      {/* 5×5 visual risk matrix */}
      <div className="border-b border-neutral-100 p-4">
        <p className="mb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Risikomatrise (5×5)</p>
        <div className="flex gap-2">
          {/* Y-axis label */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] text-neutral-400 rotate-[-90deg] whitespace-nowrap mt-8">Alvorlighetsgrad →</span>
          </div>
          <div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5,2.25rem)', gridTemplateRows: 'repeat(5,2.25rem)', gap: '2px' }}>
              {matrix.map((row, ri) =>
                row.map((cell, ci) => {
                  const cls = RISK_COLOUR_CLASSES[cell.colour]
                  return (
                    <div key={`${ri}-${ci}`}
                      className={`relative flex items-center justify-center rounded text-xs font-bold ${cls.bg} ${cls.text}`}
                      title={`Alvor ${cell.s} × Sanns. ${cell.l} = ${cell.score}`}>
                      <span>{cell.score}</span>
                      {/* Gross risk dots */}
                      {cell.rows.map((r) => (
                        <span key={r.id} className="absolute top-0.5 right-0.5 size-2 rounded-full bg-neutral-800 ring-1 ring-white" title={r.hazard} />
                      ))}
                      {/* Residual risk dots (lighter) */}
                      {cell.residual.map((r) => (
                        <span key={`res-${r.id}`} className="absolute bottom-0.5 left-0.5 size-1.5 rounded-full bg-white ring-1 ring-neutral-400" title={`Restrisiko: ${r.hazard}`} />
                      ))}
                    </div>
                  )
                }),
              )}
            </div>
            {/* X-axis */}
            <div className="mt-1 grid text-center" style={{ gridTemplateColumns: 'repeat(5,2.25rem)', gap: '2px' }}>
              {[1,2,3,4,5].map((n) => <div key={n} className="text-[10px] text-neutral-400">{n}</div>)}
            </div>
            <p className="mt-0.5 text-center text-[10px] text-neutral-400">Sannsynlighet →</p>
          </div>
          <div className="ml-3 flex flex-col gap-1 justify-center text-[10px] text-neutral-500">
            <span>● Brutto (før tiltak)</span>
            <span>○ Restrisiko (etter)</span>
          </div>
        </div>
      </div>

      {/* Rows table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-amber-50/80 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-2 py-2">Aktivitet</th>
              <th className="px-2 py-2">Fare</th>
              <th className="px-2 py-2">Eks. tiltak</th>
              <th className="px-2 py-2 text-center">Alv.</th>
              <th className="px-2 py-2 text-center">San.</th>
              <th className="px-2 py-2 text-center">Score</th>
              <th className="px-2 py-2">Foreslått tiltak</th>
              <th className="px-2 py-2 text-center bg-sky-50">Rest-alv.</th>
              <th className="px-2 py-2 text-center bg-sky-50">Rest-san.</th>
              <th className="px-2 py-2 text-center bg-sky-50">Restrisiko</th>
              <th className="px-2 py-2">Ansvarlig</th>
              <th className="px-2 py-2">Frist</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {ros.rows.map((row, idx) => {
              const grossColour = riskColour(row.riskScore)
              const grossCls = RISK_COLOUR_CLASSES[grossColour]
              const residual = row.residualScore != null ? row.residualScore : null
              const residualColour = residual != null ? riskColour(residual) : null
              const residualCls = residualColour ? RISK_COLOUR_CLASSES[residualColour] : null
              const rowClosed = row.status === 'closed'
              return (
                <tr key={row.id} className={`border-b border-neutral-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'} ${rowClosed ? 'opacity-60' : ''}`}>
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.activity} onChange={(e) => ic.updateRosRow(ros.id, row.id, { activity: e.target.value })} className="w-full min-w-[90px] rounded border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.hazard} onChange={(e) => ic.updateRosRow(ros.id, row.id, { hazard: e.target.value })} className="w-full min-w-[90px] rounded border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.existingControls} onChange={(e) => ic.updateRosRow(ros.id, row.id, { existingControls: e.target.value })} className="w-full min-w-[90px] rounded border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Gross severity */}
                  <td className="px-1 py-1.5 text-center">
                    <input disabled={isLocked} type="number" min={1} max={5} value={row.severity} onChange={(e) => ic.updateRosRow(ros.id, row.id, { severity: Number(e.target.value) || 1 })} className="w-10 rounded border border-neutral-200 px-1 text-center disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Gross likelihood */}
                  <td className="px-1 py-1.5 text-center">
                    <input disabled={isLocked} type="number" min={1} max={5} value={row.likelihood} onChange={(e) => ic.updateRosRow(ros.id, row.id, { likelihood: Number(e.target.value) || 1 })} className="w-10 rounded border border-neutral-200 px-1 text-center disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Gross score — colour-coded */}
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-flex h-7 w-9 items-center justify-center rounded-full text-xs font-bold ${grossCls.bg} ${grossCls.text}`}>
                      {row.riskScore}
                    </span>
                  </td>
                  {/* Proposed measures */}
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.proposedMeasures} onChange={(e) => ic.updateRosRow(ros.id, row.id, { proposedMeasures: e.target.value })} className="w-full min-w-[110px] rounded border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Residual severity */}
                  <td className="bg-sky-50/50 px-1 py-1.5 text-center">
                    <input disabled={isLocked} type="number" min={1} max={5} value={row.residualSeverity ?? ''} placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : undefined
                        const rs = v ?? row.severity
                        const rl = row.residualLikelihood ?? row.likelihood
                        ic.updateRosRow(ros.id, row.id, { residualSeverity: v, residualScore: v != null ? computeRiskScore(rs, rl) : undefined })
                      }}
                      className="w-10 rounded border border-sky-200 bg-sky-50 px-1 text-center placeholder:text-neutral-300 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Residual likelihood */}
                  <td className="bg-sky-50/50 px-1 py-1.5 text-center">
                    <input disabled={isLocked} type="number" min={1} max={5} value={row.residualLikelihood ?? ''} placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : undefined
                        const rs = row.residualSeverity ?? row.severity
                        const rl = v ?? row.likelihood
                        ic.updateRosRow(ros.id, row.id, { residualLikelihood: v, residualScore: v != null ? computeRiskScore(rs, rl) : undefined })
                      }}
                      className="w-10 rounded border border-sky-200 bg-sky-50 px-1 text-center placeholder:text-neutral-300 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Residual score — colour-coded */}
                  <td className="bg-sky-50/50 px-2 py-1.5 text-center">
                    {residual != null && residualCls ? (
                      <span className={`inline-flex h-7 w-9 items-center justify-center rounded-full text-xs font-bold ${residualCls.bg} ${residualCls.text}`}>
                        {residual}
                      </span>
                    ) : <span className="text-neutral-300">—</span>}
                  </td>
                  {/* Responsible */}
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.responsible} onChange={(e) => ic.updateRosRow(ros.id, row.id, { responsible: e.target.value })} className="w-full min-w-[70px] rounded border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Due date */}
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} type="date" value={row.dueDate} onChange={(e) => ic.updateRosRow(ros.id, row.id, { dueDate: e.target.value })} className="rounded border border-neutral-200 px-1 py-0.5 text-xs disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Status — replaces OK checkbox */}
                  <td className="px-1 py-1.5">
                    <select disabled={isLocked} value={row.status} onChange={(e) => ic.updateRosRow(ros.id, row.id, { status: e.target.value as import('../types/internalControl').RosRowStatus })}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium disabled:cursor-default ${
                        row.status === 'closed' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' :
                        row.status === 'in_progress' ? 'border-sky-300 bg-sky-100 text-sky-800' :
                        'border-neutral-300 bg-neutral-100 text-neutral-700'
                      }`}>
                      <option value="open">Åpen</option>
                      <option value="in_progress">Pågår</option>
                      <option value="closed">Lukket</option>
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Dual electronic signature section (AML §3-1 medvirkning) */}
      <div className="border-t border-neutral-100 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-[#1a3d32]" />
          <h4 className="text-sm font-semibold text-neutral-800">Behandlet og godkjent av</h4>
          <span className="text-xs text-neutral-400">(AML §3-1 — medvirkning fra arbeidstakere)</span>
        </div>

        {isLocked ? (
          <div className="flex flex-wrap gap-4">
            {ros.signatures.map((sig) => (
              <div key={sig.role} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {sig.role === 'leader' ? 'Leder' : 'Verneombud'}: {sig.signerName}
                  </p>
                  <p className="text-xs text-emerald-700">{fmtDate(sig.signedAt)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3">
              <Lock className="size-4 text-emerald-700" />
              <span className="text-sm font-medium text-emerald-900">Dokumentet er låst og read-only</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Leader sign */}
            <div className={`rounded-xl border p-4 ${leaderSig ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
              <p className="text-xs font-semibold text-neutral-700 mb-2">Leder</p>
              {leaderSig ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-sm text-emerald-800">{leaderSig.signerName} — {fmtDate(leaderSig.signedAt)}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} placeholder="Leders fulle navn" className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
                  <button type="button" disabled={!leaderName.trim() || oRosBlocked} onClick={() => { void ic.signRos(ros.id, 'leader', leaderName); setLeaderName('') }} className="rounded-full bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-[#142e26]">
                    Signer
                  </button>
                </div>
              )}
            </div>
            {/* Verneombud sign */}
            <div className={`rounded-xl border p-4 ${verneombudSig ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
              <p className="text-xs font-semibold text-neutral-700 mb-2">Verneombud</p>
              {verneombudSig ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-sm text-emerald-800">{verneombudSig.signerName} — {fmtDate(verneombudSig.signedAt)}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={verneombudName} onChange={(e) => setVerneombudName(e.target.value)} placeholder="Verneombudets fulle navn" className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
                  <button type="button" disabled={!verneombudName.trim() || oRosBlocked} onClick={() => { void ic.signRos(ros.id, 'verneombud', verneombudName); setVerneombudName('') }} className="rounded-full bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-[#142e26]">
                    Signer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!isLocked && !bothSigned && (
          <p className="mt-3 text-xs text-neutral-400">
            Dokumentet låses automatisk når begge parter har signert.
          </p>
        )}
      </div>
    </div>
  )
}
