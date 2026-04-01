import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  FileWarning,
  HardHat,
  History,
  ListChecks,
  Search,
} from 'lucide-react'
import { useHse } from '../hooks/useHse'
import type {
  ChecklistItemStatus,
  HseProtocolSignature,
  Incident,
  Inspection,
  SafetyRound,
} from '../types/hse'

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: HardHat },
  { id: 'rounds' as const, label: 'Vernerunder', icon: ListChecks },
  { id: 'inspections' as const, label: 'Inspeksjoner', icon: Search },
  { id: 'incidents' as const, label: 'Hendelser', icon: AlertTriangle },
  { id: 'aml' as const, label: 'AML & verneombud', icon: BookOpen },
  { id: 'audit' as const, label: 'Revisjonslogg', icon: History },
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

function statusLabel(s: ChecklistItemStatus) {
  if (s === 'ok') return 'OK'
  if (s === 'issue') return 'Avvik'
  return 'N/A'
}

export function HseModule() {
  const hse = useHse()
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('overview')
  const [roundForm, setRoundForm] = useState({
    title: '',
    conductedAt: '',
    location: '',
    conductedBy: '',
    notes: '',
  })
  const [insForm, setInsForm] = useState({
    kind: 'internal' as Inspection['kind'],
    title: '',
    conductedAt: '',
    scope: '',
    findings: '',
    followUp: '',
    responsible: '',
    status: 'open' as Inspection['status'],
  })
  const [incForm, setIncForm] = useState({
    kind: 'near_miss' as Incident['kind'],
    severity: 'medium' as Incident['severity'],
    occurredAt: '',
    location: '',
    description: '',
    immediateActions: '',
    reportedBy: '',
    status: 'reported' as Incident['status'],
  })

  const sortedAudit = useMemo(
    () => [...hse.auditTrail].sort((a, b) => a.at.localeCompare(b.at)),
    [hse.auditTrail],
  )

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Prosjekter
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">HMS / verneombud</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            HMS & verneombud
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Vernerunder med sjekkliste, inspeksjoner, hendelser og nestenulykker, og sporbar revisjonslogg.
            Innholdet er et <strong>støtteverktøy</strong> — tilpass til risiko og avtaler; verifiser mot{' '}
            <a href="https://lovdata.no" className="text-[#1a3d32] underline" target="_blank" rel="noreferrer">
              lovdata.no
            </a>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium md:px-4 ${
                  active
                    ? 'bg-[#1a3d32] text-white shadow-sm'
                    : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900">Hurtigstatus</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Vernerunder" value={hse.stats.rounds} />
              <StatCard label="Inspeksjoner" value={hse.stats.inspections} />
              <StatCard label="Hendelser" value={hse.stats.incidents} />
              <StatCard label="Nestenulykker" value={hse.stats.nearMiss} />
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              Åpne inspeksjoner med oppfølging: <strong>{hse.stats.openInspections}</strong> · Revisjonshendelser:{' '}
              <strong>{hse.stats.auditEntries}</strong>
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-5 text-sm text-amber-950">
            <strong>Revisjonslogg:</strong> Alle opprettelser og endringer logges med tidspunkt. Eksisterende
            loggposter slettes ikke ved nye hendelser (append-only).
          </div>
        </div>
      )}

      {tab === 'rounds' && (
        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Ny vernerunde</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!roundForm.title.trim() || !roundForm.conductedAt) return
                hse.createSafetyRound({
                  title: roundForm.title.trim(),
                  conductedAt: new Date(roundForm.conductedAt).toISOString(),
                  location: roundForm.location.trim() || '—',
                  conductedBy: roundForm.conductedBy.trim() || '—',
                  notes: roundForm.notes,
                })
                setRoundForm((r) => ({ ...r, title: '', notes: '' }))
              }}
            >
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Tittel</label>
                <input
                  value={roundForm.title}
                  onChange={(e) => setRoundForm((r) => ({ ...r, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Gjennomført</label>
                <input
                  type="datetime-local"
                  value={roundForm.conductedAt}
                  onChange={(e) => setRoundForm((r) => ({ ...r, conductedAt: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Område</label>
                <input
                  value={roundForm.location}
                  onChange={(e) => setRoundForm((r) => ({ ...r, location: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Gjennomført av (f.eks. verneombud)</label>
                <input
                  value={roundForm.conductedBy}
                  onChange={(e) => setRoundForm((r) => ({ ...r, conductedBy: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Notater</label>
                <textarea
                  value={roundForm.notes}
                  onChange={(e) => setRoundForm((r) => ({ ...r, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2"
              >
                <ClipboardCheck className="size-4" />
                Opprett runde
              </button>
            </form>
          </section>

          <div className="space-y-6">
            {hse.safetyRounds.map((sr) => (
              <SafetyRoundCard key={sr.id} round={sr} checklist={hse.checklistTemplate} hse={hse} />
            ))}
          </div>
        </div>
      )}

      {tab === 'inspections' && (
        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Registrer inspeksjon</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!insForm.title.trim()) return
                hse.createInspection({
                  kind: insForm.kind,
                  title: insForm.title.trim(),
                  conductedAt: insForm.conductedAt
                    ? new Date(insForm.conductedAt).toISOString()
                    : new Date().toISOString(),
                  scope: insForm.scope,
                  findings: insForm.findings,
                  followUp: insForm.followUp,
                  status: insForm.status,
                  responsible: insForm.responsible,
                })
                setInsForm((i) => ({
                  ...i,
                  title: '',
                  scope: '',
                  findings: '',
                  followUp: '',
                }))
              }}
            >
              <div>
                <label className="text-xs text-neutral-500">Type</label>
                <select
                  value={insForm.kind}
                  onChange={(e) =>
                    setInsForm((i) => ({ ...i, kind: e.target.value as Inspection['kind'] }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="internal">Intern</option>
                  <option value="external">Ekstern</option>
                  <option value="audit">Revisjon</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500">Dato/tid</label>
                <input
                  type="datetime-local"
                  value={insForm.conductedAt}
                  onChange={(e) => setInsForm((i) => ({ ...i, conductedAt: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Tittel</label>
                <input
                  value={insForm.title}
                  onChange={(e) => setInsForm((i) => ({ ...i, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Omfang</label>
                <textarea
                  value={insForm.scope}
                  onChange={(e) => setInsForm((i) => ({ ...i, scope: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Funn</label>
                <textarea
                  value={insForm.findings}
                  onChange={(e) => setInsForm((i) => ({ ...i, findings: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Oppfølging</label>
                <textarea
                  value={insForm.followUp}
                  onChange={(e) => setInsForm((i) => ({ ...i, followUp: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Ansvarlig</label>
                <input
                  value={insForm.responsible}
                  onChange={(e) => setInsForm((i) => ({ ...i, responsible: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Status</label>
                <select
                  value={insForm.status}
                  onChange={(e) =>
                    setInsForm((i) => ({ ...i, status: e.target.value as Inspection['status'] }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="open">Åpen</option>
                  <option value="closed">Lukket</option>
                </select>
              </div>
              <button
                type="submit"
                className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2"
              >
                Lagre inspeksjon
              </button>
            </form>
          </section>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Logg — inspeksjoner</h2>
            </div>
            <ul className="divide-y divide-neutral-100">
              {hse.inspections.map((ins) => (
                <InspectionRow key={ins.id} ins={ins} hse={hse} />
              ))}
            </ul>
            {hse.inspections.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen inspeksjoner ennå.</p>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'incidents' && (
        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Registrer hendelse eller nestenulykke</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!incForm.description.trim()) return
                hse.createIncident({
                  kind: incForm.kind,
                  severity: incForm.severity,
                  occurredAt: incForm.occurredAt
                    ? new Date(incForm.occurredAt).toISOString()
                    : new Date().toISOString(),
                  location: incForm.location || '—',
                  description: incForm.description,
                  immediateActions: incForm.immediateActions,
                  reportedBy: incForm.reportedBy || '—',
                  status: incForm.status,
                })
                setIncForm((i) => ({
                  ...i,
                  description: '',
                  immediateActions: '',
                }))
              }}
            >
              <div>
                <label className="text-xs text-neutral-500">Type</label>
                <select
                  value={incForm.kind}
                  onChange={(e) =>
                    setIncForm((i) => ({ ...i, kind: e.target.value as Incident['kind'] }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="incident">Hendelse / ulykke</option>
                  <option value="near_miss">Nestenulykke</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500">Alvorlighetsgrad</label>
                <select
                  value={incForm.severity}
                  onChange={(e) =>
                    setIncForm((i) => ({ ...i, severity: e.target.value as Incident['severity'] }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="low">Lav</option>
                  <option value="medium">Middels</option>
                  <option value="high">Høy</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500">Tidspunkt</label>
                <input
                  type="datetime-local"
                  value={incForm.occurredAt}
                  onChange={(e) => setIncForm((i) => ({ ...i, occurredAt: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Sted</label>
                <input
                  value={incForm.location}
                  onChange={(e) => setIncForm((i) => ({ ...i, location: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Beskrivelse</label>
                <textarea
                  value={incForm.description}
                  onChange={(e) => setIncForm((i) => ({ ...i, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Umiddelbare tiltak</label>
                <textarea
                  value={incForm.immediateActions}
                  onChange={(e) => setIncForm((i) => ({ ...i, immediateActions: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Meldt av</label>
                <input
                  value={incForm.reportedBy}
                  onChange={(e) => setIncForm((i) => ({ ...i, reportedBy: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Status</label>
                <select
                  value={incForm.status}
                  onChange={(e) =>
                    setIncForm((i) => ({ ...i, status: e.target.value as Incident['status'] }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="reported">Meldt</option>
                  <option value="investigating">Under utredning</option>
                  <option value="closed">Lukket</option>
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2"
              >
                <FileWarning className="size-4" />
                Registrer
              </button>
            </form>
          </section>

          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Logg — hendelser</h2>
            </div>
            <ul className="divide-y divide-neutral-100">
              {hse.incidents.map((inc) => (
                <li key={inc.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">
                      {inc.kind === 'near_miss' ? 'Nestenulykke' : 'Hendelse'}
                    </span>
                    <select
                      value={inc.status}
                      onChange={(e) =>
                        hse.updateIncident(inc.id, {
                          status: e.target.value as Incident['status'],
                        })
                      }
                      className="rounded-full border border-neutral-200 px-2 py-1 text-xs"
                    >
                      <option value="reported">Meldt</option>
                      <option value="investigating">Utredning</option>
                      <option value="closed">Lukket</option>
                    </select>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {formatWhen(inc.occurredAt)} · {inc.severity} · {inc.location}
                  </p>
                  <p className="mt-2 text-sm text-neutral-800">{inc.description}</p>
                  <div className="mt-2">
                    <AddTaskLink
                      title={`Oppfølging: ${inc.kind === 'near_miss' ? 'Nestenulykke' : 'Hendelse'}`}
                      description={inc.description.slice(0, 200)}
                      module="hse"
                      sourceType="hse_incident"
                      sourceId={inc.id}
                      sourceLabel={`${inc.location} · ${inc.severity}`}
                      ownerRole="HMS / verneombud"
                      requiresManagementSignOff={inc.severity === 'high'}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {hse.incidents.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen registreringer.</p>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'aml' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Struktur etter arbeidsmiljøloven (oversikt)</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Dette er en forenklet struktur for dokumentasjon og verneroller — tilpass til virksomhetens
              risikovurdering og bransje.
            </p>
            <ul className="mt-4 space-y-4">
              {hse.amlStructure.map((block) => (
                <li key={block.title} className="rounded-xl border border-neutral-100 bg-[#faf8f4] p-4">
                  <div className="font-medium text-neutral-900">{block.title}</div>
                  <div className="text-xs text-[#1a3d32]/90">{block.lawRef}</div>
                  <ul className="mt-2 list-inside list-disc text-sm text-neutral-700">
                    {block.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="mt-8">
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Streng revisjonslogg (append-only)</h2>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tilbakestill HSE-demodata? Revisjonslogg regenereres.')) hse.resetDemo()
                }}
                className="text-xs text-neutral-500 hover:underline"
              >
                Tilbakestill demo
              </button>
            </div>
            <ul className="max-h-[640px] divide-y divide-neutral-100 overflow-y-auto text-sm">
              {sortedAudit.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                    <span>{formatWhen(a.at)}</span>
                    <span className="font-mono text-neutral-600">{a.action}</span>
                    <span>{a.entityType}</span>
                    <span className="truncate font-mono text-neutral-400">{a.entityId}</span>
                  </div>
                  <p className="mt-1 font-medium text-neutral-900">{a.summary}</p>
                  {a.detail && Object.keys(a.detail).length > 0 ? (
                    <pre className="mt-2 max-h-24 overflow-auto rounded bg-neutral-50 p-2 text-xs text-neutral-600">
                      {JSON.stringify(a.detail, null, 0)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
      <div className="text-2xl font-semibold text-[#1a3d32]">{value}</div>
      <div className="text-sm text-neutral-600">{label}</div>
    </div>
  )
}

function InspectionRow({
  ins,
  hse,
}: {
  ins: Inspection
  hse: ReturnType<typeof useHse>
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<HseProtocolSignature['role']>('inspector')
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="font-medium text-neutral-900">{ins.title}</span>
          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{ins.kind}</span>
        </div>
        <select
          value={ins.status}
          onChange={(e) =>
            hse.updateInspection(ins.id, {
              status: e.target.value as Inspection['status'],
            })
          }
          className="rounded-full border border-neutral-200 px-2 py-1 text-xs"
        >
          <option value="open">Åpen</option>
          <option value="closed">Lukket</option>
        </select>
      </div>
      <p className="mt-1 text-xs text-neutral-500">{formatWhen(ins.conductedAt)}</p>
      <p className="mt-2 text-sm text-neutral-700">{ins.findings || '—'}</p>
      <div className="mt-3 rounded-lg bg-[#faf8f4] p-3 text-xs">
        <span className="font-medium text-neutral-800">Signaturer:</span>
        <ul className="mt-1 space-y-0.5 text-neutral-700">
          {(ins.protocolSignatures ?? []).map((s, i) => (
            <li key={`${s.signedAt}-${i}`}>
              {s.role === 'inspector'
                ? 'Inspektør'
                : s.role === 'verneombud'
                  ? 'Verneombud'
                  : 'Ledelse'}
              : {s.signerName} — {formatWhen(s.signedAt)}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as HseProtocolSignature['role'])}
            className="rounded border border-neutral-200 px-2 py-1"
          >
            <option value="inspector">Inspektør</option>
            <option value="verneombud">Verneombud</option>
            <option value="management">Ledelse</option>
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fullt navn"
            className="min-w-[140px] flex-1 rounded border border-neutral-200 px-2 py-1"
          />
          <button
            type="button"
            onClick={() => {
              if (hse.signInspectionProtocol(ins.id, name, role)) setName('')
            }}
            className="rounded bg-[#1a3d32] px-2 py-1 text-white"
          >
            Signer
          </button>
        </div>
      </div>
      <div className="mt-2">
        <AddTaskLink
          title={`Oppfølging inspeksjon: ${ins.title.slice(0, 60)}`}
          description={ins.followUp || ins.findings?.slice(0, 200)}
          module="hse"
          sourceType="hse_inspection"
          sourceId={ins.id}
          sourceLabel={ins.title}
          ownerRole={ins.responsible || 'Ansvarlig'}
        />
      </div>
    </li>
  )
}

function SafetyRoundCard({
  round,
  checklist,
  hse,
}: {
  round: SafetyRound
  checklist: { id: string; label: string; lawRef: string }[]
  hse: ReturnType<typeof useHse>
}) {
  const hasIssue = Object.values(round.items).some((v) => v === 'issue')
  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-neutral-900">{round.title}</h3>
          <p className="text-sm text-neutral-600">
            {round.location} · {round.conductedBy}
          </p>
          <p className="text-xs text-neutral-500">{formatWhen(round.conductedAt)}</p>
        </div>
      </div>
      <div className="mt-4 border-t border-neutral-100 pt-4">
        <h4 className="text-sm font-semibold text-neutral-900">Sjekkliste (vernerunde)</h4>
        <ul className="mt-2 space-y-2">
          {checklist.map((item) => {
            const st = round.items[item.id] ?? 'na'
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg bg-[#faf8f4] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="text-sm text-neutral-900">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{item.lawRef}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  {(['ok', 'issue', 'na'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => hse.setChecklistStatus(round.id, item.id, v)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        st === v
                          ? v === 'issue'
                            ? 'bg-amber-200 text-amber-950'
                            : v === 'ok'
                              ? 'bg-emerald-200 text-emerald-950'
                              : 'bg-neutral-200 text-neutral-800'
                          : 'bg-white ring-1 ring-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      {statusLabel(v)}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <label className="mt-4 block text-xs font-medium text-neutral-500">Notater fra runden</label>
      <textarea
        value={round.notes}
        onChange={(e) => hse.updateSafetyRound(round.id, { notes: e.target.value })}
        rows={3}
        className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      {hasIssue ? (
        <div className="mt-3">
          <AddTaskLink
            title={`Avvik fra vernerunde: ${round.title.slice(0, 50)}`}
            description={round.notes.slice(0, 300)}
            module="hse"
            sourceType="hse_safety_round"
            sourceId={round.id}
            sourceLabel={round.title}
            ownerRole="Verneombud"
          />
        </div>
      ) : null}
    </div>
  )
}
