import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Calendar,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Scale,
} from 'lucide-react'
import { LegalDisclaimer } from '../components/internalControl/LegalDisclaimer'
import { ROS_TEMPLATE_HELP, computeRiskScore } from '../data/rosTemplate'
import { labelForAmlReportKind } from '../data/amlAnonymousReporting'
import { useInternalControl } from '../hooks/useInternalControl'
import { useOrgHealth } from '../hooks/useOrgHealth'
import type { WhistleCaseStatus } from '../types/internalControl'
import { AddTaskLink } from '../components/tasks/AddTaskLink'

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
  const oh = useOrgHealth()
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
              <Link
                to="/workflows"
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
              >
                Prosessbygger
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
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <p className="font-medium text-[#1a3d32]">{ROS_TEMPLATE_HELP.title}</p>
            <p className="mt-2">{ROS_TEMPLATE_HELP.intro}</p>
            <ul className="mt-2 list-inside list-disc text-xs text-neutral-600">
              <li>{ROS_TEMPLATE_HELP.severityScale}</li>
              <li>{ROS_TEMPLATE_HELP.likelihoodScale}</li>
              <li>Risikoscore = alvor × sannsynlighet (illustrativ).</li>
            </ul>
          </div>

          <form
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              if (!rosTitle.trim()) return
              ic.createRosAssessment(rosTitle, rosDept, rosAssessor)
              setRosTitle('')
              setRosDept('')
              setRosAssessor('')
            }}
          >
            <div>
              <label className="text-xs text-neutral-500">Tittel</label>
              <input
                value={rosTitle}
                onChange={(e) => setRosTitle(e.target.value)}
                className="mt-1 block rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                placeholder="f.eks. ROS — Lager 2026"
                required
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Avdeling</label>
              <input
                value={rosDept}
                onChange={(e) => setRosDept(e.target.value)}
                className="mt-1 block rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Vurdert av</label>
              <input
                value={rosAssessor}
                onChange={(e) => setRosAssessor(e.target.value)}
                className="mt-1 block rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
            >
              Ny ROS
            </button>
          </form>

          {ic.rosAssessments.map((ros) => (
            <div key={ros.id} className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <div>
                  <h3 className="font-semibold text-neutral-900">{ros.title}</h3>
                  <p className="text-xs text-neutral-500">
                    {ros.department} · {ros.assessor} · {ros.assessedAt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => ic.addRosRow(ros.id)}
                  className="text-sm font-medium text-[#1a3d32] hover:underline"
                >
                  + Rad
                </button>
              </div>
              <div className="overflow-x-auto p-2">
                <table className="w-full min-w-[960px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-amber-50/80 text-[10px] font-semibold uppercase text-neutral-600 sm:text-xs">
                      <th className="px-2 py-2">Aktivitet</th>
                      <th className="px-2 py-2">Fare</th>
                      <th className="px-2 py-2">Eksisterende</th>
                      <th className="px-2 py-2">Alv.</th>
                      <th className="px-2 py-2">Sanns.</th>
                      <th className="px-2 py-2">Score</th>
                      <th className="px-2 py-2">Tiltak</th>
                      <th className="px-2 py-2">Ansv.</th>
                      <th className="px-2 py-2">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ros.rows.map((row, idx) => (
                      <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/20'}>
                        <td className="border-b border-neutral-100 px-1 py-1">
                          <input
                            value={row.activity}
                            onChange={(e) => ic.updateRosRow(ros.id, row.id, { activity: e.target.value })}
                            className="w-full min-w-[100px] rounded border border-neutral-200 px-1 py-0.5"
                          />
                        </td>
                        <td className="border-b border-neutral-100 px-1 py-1">
                          <input
                            value={row.hazard}
                            onChange={(e) => ic.updateRosRow(ros.id, row.id, { hazard: e.target.value })}
                            className="w-full min-w-[100px] rounded border border-neutral-200 px-1 py-0.5"
                          />
                        </td>
                        <td className="border-b border-neutral-100 px-1 py-1">
                          <input
                            value={row.existingControls}
                            onChange={(e) =>
                              ic.updateRosRow(ros.id, row.id, { existingControls: e.target.value })
                            }
                            className="w-full min-w-[100px] rounded border border-neutral-200 px-1 py-0.5"
                          />
                        </td>
                        <td className="border-b border-neutral-100 px-1 py-1">
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={row.severity}
                            onChange={(e) =>
                              ic.updateRosRow(ros.id, row.id, {
                                severity: Number(e.target.value) || 1,
                              })
                            }
                            className="w-12 rounded border border-neutral-200 px-1"
                          />
                        </td>
                        <td className="border-b border-neutral-100 px-1 py-1">
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={row.likelihood}
                            onChange={(e) =>
                              ic.updateRosRow(ros.id, row.id, {
                                likelihood: Number(e.target.value) || 1,
                              })
                            }
                            className="w-12 rounded border border-neutral-200 px-1"
                          />
                        </td>
                        <td className="border-b border-neutral-100 px-2 py-1 font-medium text-[#1a3d32]">
                          {computeRiskScore(row.severity, row.likelihood)}
                        </td>
                        <td className="border-b border-neutral-100 px-1 py-1">
                          <input
                            value={row.proposedMeasures}
                            onChange={(e) =>
                              ic.updateRosRow(ros.id, row.id, { proposedMeasures: e.target.value })
                            }
                            className="w-full min-w-[120px] rounded border border-neutral-200 px-1 py-0.5"
                          />
                        </td>
                        <td className="border-b border-neutral-100 px-1 py-1">
                          <input
                            value={row.responsible}
                            onChange={(e) =>
                              ic.updateRosRow(ros.id, row.id, { responsible: e.target.value })
                            }
                            className="w-full min-w-[80px] rounded border border-neutral-200 px-1 py-0.5"
                          />
                        </td>
                        <td className="border-b border-neutral-100 px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={row.done}
                            onChange={(e) =>
                              ic.updateRosRow(ros.id, row.id, { done: e.target.checked })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
