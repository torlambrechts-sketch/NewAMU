import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CheckCircle2, Circle, Search, Settings } from 'lucide-react'
import { FormModal } from '../../src/template'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import type { InspectionRoundRow } from './types'
import { useInspectionModule } from './useInspectionModule'

type Props = { supabase: SupabaseClient | null }

// ── Recurrence picker ────────────────────────────────────────────────────────

type RecurrenceFreq = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

const FREQ_LABELS: Record<RecurrenceFreq, string> = {
  none: 'Ingen repetisjon',
  weekly: 'Ukentlig',
  biweekly: 'Annenhver uke',
  monthly: 'Månedlig (1. hver måned)',
  quarterly: 'Kvartalsvis (hvert kvartal)',
}

const WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

type RecurrenceState = { freq: RecurrenceFreq; weekday: number; hour: number; minute: number }

function toCron(r: RecurrenceState): string {
  const mm = String(r.minute).padStart(2, '0')
  const hh = String(r.hour).padStart(2, '0')
  // cron weekday: 1=Mon … 7=Sun
  const wd = r.weekday + 1
  if (r.freq === 'weekly') return `${mm} ${hh} * * ${wd}`
  if (r.freq === 'biweekly') return `${mm} ${hh} 1,15 * ${wd}`
  if (r.freq === 'monthly') return `${mm} ${hh} 1 * *`
  if (r.freq === 'quarterly') return `${mm} ${hh} 1 */3 *`
  return ''
}

function parseCron(cron: string): RecurrenceState {
  const defaultState: RecurrenceState = { freq: 'none', weekday: 0, hour: 7, minute: 0 }
  if (!cron || !cron.trim()) return defaultState
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return { ...defaultState, freq: 'none' }
  const [mm, hh, dom, mon, wd] = parts
  const hour = parseInt(hh, 10)
  const minute = parseInt(mm, 10)
  const weekday = Math.max(0, (parseInt(wd, 10) || 1) - 1)
  if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
    if (dom === '1' && mon === '*/3') return { freq: 'quarterly', weekday, hour, minute }
    if (dom === '1' && mon === '*') return { freq: 'monthly', weekday, hour, minute }
    if (dom === '1,15') return { freq: 'biweekly', weekday, hour, minute }
    if (dom === '*') return { freq: 'weekly', weekday, hour, minute }
  }
  return defaultState
}

function recurrenceLabel(cron: string): string {
  const r = parseCron(cron)
  if (r.freq === 'none') return 'Ingen repetisjon'
  const time = `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`
  const day = WEEKDAYS[r.weekday] ?? ''
  if (r.freq === 'weekly') return `Ukentlig — ${day} kl. ${time}`
  if (r.freq === 'biweekly') return `Annenhver uke — ${day} kl. ${time}`
  if (r.freq === 'monthly') return `Månedlig — 1. i måneden kl. ${time}`
  if (r.freq === 'quarterly') return `Kvartalsvis — 1. i kvartalet kl. ${time}`
  return cron
}

function RecurrencePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (cron: string) => void
}) {
  const [state, setState] = useState<RecurrenceState>(() => parseCron(value))

  function update(next: RecurrenceState) {
    setState(next)
    onChange(next.freq === 'none' ? '' : toCron(next))
  }

  const needsDay = state.freq === 'weekly' || state.freq === 'biweekly'
  const preview = state.freq === 'none' ? '' : recurrenceLabel(toCron(state))

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-neutral-500">Frekvens</span>
          <select
            value={state.freq}
            onChange={(e) => update({ ...state, freq: e.target.value as RecurrenceFreq })}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {(Object.keys(FREQ_LABELS) as RecurrenceFreq[]).map((f) => (
              <option key={f} value={f}>{FREQ_LABELS[f]}</option>
            ))}
          </select>
        </label>

        {needsDay && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Ukedag</span>
            <select
              value={state.weekday}
              onChange={(e) => update({ ...state, weekday: Number(e.target.value) })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </label>
        )}

        {state.freq !== 'none' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Klokkeslett</span>
            <input
              type="time"
              value={`${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                update({ ...state, hour: h ?? 7, minute: m ?? 0 })
              }}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        )}
      </div>
      {preview && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          {preview}
        </p>
      )}
    </div>
  )
}

const STATUS_LABEL: Record<InspectionRoundRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}

function formatDate(input: string | null) {
  if (!input) return '—'
  try {
    return new Date(input).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return input
  }
}

function toDateTimeLocalValue(input: string | null): string {
  if (!input) return ''
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function InspectionModuleView({ supabase }: Props) {
  const inspection = useInspectionModule({ supabase })
  const { load } = inspection
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [newRoundForm, setNewRoundForm] = useState({
    title: '',
    templateId: '',
    locationId: '',
    cronExpression: '',
    scheduledFor: '',
    assignedTo: '',
  })
  const [scheduleDraft, setScheduleDraft] = useState<
    Record<string, { scheduledFor: string; cronExpression: string; assignedTo: string }>
  >({})

  useEffect(() => { void load() }, [load])

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let active = 0, signed = 0, criticalFindings = 0
    for (const round of inspection.rounds) {
      if (round.status === 'active') active++
      if (round.status === 'signed') signed++
      const findings = inspection.findingsByRoundId[round.id] ?? []
      criticalFindings += findings.filter((f) => f.severity === 'critical').length
    }
    return { active, signed, criticalFindings }
  }, [inspection.rounds, inspection.findingsByRoundId])

  // ── Derived data ──────────────────────────────────────────────────────────────
  const locationNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of inspection.locations) map.set(loc.id, loc.name)
    return map
  }, [inspection.locations])

  const templateById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of inspection.templates) map.set(t.id, t.name)
    return map
  }, [inspection.templates])

  const userNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of inspection.assignableUsers) map.set(u.id, u.displayName)
    return map
  }, [inspection.assignableUsers])

  const roundsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return inspection.rounds
    return inspection.rounds.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.location_id && locationNameById.get(r.location_id)?.toLowerCase().includes(q)) ||
        (r.assigned_to && userNameById.get(r.assigned_to)?.toLowerCase().includes(q)),
    )
  }, [inspection.rounds, search, locationNameById, userNameById])

  const roundsForSchedule = useMemo(
    () =>
      inspection.rounds
        .slice()
        .sort((a, b) => {
          if (a.scheduled_for && b.scheduled_for) return a.scheduled_for.localeCompare(b.scheduled_for)
          if (a.scheduled_for) return -1
          if (b.scheduled_for) return 1
          return a.created_at.localeCompare(b.created_at)
        })
        .slice(0, 12),
    [inspection.rounds],
  )

  return (
    <div className="space-y-6">
      {/* ── Head ─────────────────────────────────────────────────────────────── */}
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder' }]}
        title="Inspeksjonsrunder"
        description="Planlegg, gjennomfør og signer vernerunder i henhold til Internkontrollforskriften § 5."
        headerActions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Planlegging
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: '#2D403A' }}
            >
              Ny runde
            </button>
            <Link
              to="/inspection-module/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      {/* ── Box 3 (KPI) ──────────────────────────────────────────────────────── */}
      <LayoutScoreStatRow
        items={[
          {
            big: String(stats.active),
            title: 'Aktive runder',
            sub: 'Under gjennomføring',
          },
          {
            big: String(stats.criticalFindings),
            title: 'Kritiske funn',
            sub: 'Krever oppfølging',
          },
          {
            big: String(stats.signed),
            title: 'Signert',
            sub: 'Dobbelt-signert og arkivert',
          },
        ]}
      />

      {/* ── Table 1 ──────────────────────────────────────────────────────────── */}
      <LayoutTable1PostingsShell
        wrap
        title="Runder"
        description="Alle inspeksjonsrunder — sortert etter siste aktivitet."
        headerActions={
          inspection.error ? (
            <span className="text-xs text-red-600">{inspection.error}</span>
          ) : undefined
        }
        toolbar={
          <div className="relative min-w-[200px] flex-1">
            <label className="sr-only" htmlFor="inspection-search">Søk</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="inspection-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i tittel, lokasjon, ansvarlig …"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
        }
        footer={
          <span className="text-neutral-500">
            {search.trim() ? `${roundsFiltered.length} treff` : `Viser ${roundsFiltered.length} runder`}
          </span>
        }
      >
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Mal</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Lokasjon</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Signaturer</th>
              <th className={`w-24 ${LAYOUT_TABLE1_POSTINGS_TH}`}>Handling</th>
            </tr>
          </thead>
          <tbody>
            {roundsFiltered.map((round) => {
              const findings = inspection.findingsByRoundId[round.id] ?? []
              const critCount = findings.filter((f) => f.severity === 'critical').length
              return (
                <tr key={round.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                  <td className="px-5 py-3 font-medium text-neutral-900">
                    {round.title}
                    {critCount > 0 && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        {critCount} kritisk
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {templateById.get(round.template_id) ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {round.location_id ? locationNameById.get(round.location_id) ?? '—' : '—'}
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {round.assigned_to ? userNameById.get(round.assigned_to) ?? '—' : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        round.status === 'signed'
                          ? 'bg-green-100 text-green-800'
                          : round.status === 'active'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {STATUS_LABEL[round.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-600">{formatDate(round.scheduled_for)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span title="Leder">
                        {round.manager_signed_at ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-neutral-300" />
                        )}
                      </span>
                      <span title="Verneombud">
                        {round.deputy_signed_at ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-neutral-300" />
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {round.status !== 'signed' && (
                      <Link
                        to="/inspection-module/admin"
                        className="text-xs font-medium text-[#1a3d32] hover:underline"
                      >
                        Signer
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
            {roundsFiltered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-neutral-500">
                  {inspection.loading ? 'Laster runder…' : 'Ingen runder matcher søket.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </LayoutTable1PostingsShell>

      {/* ── Create round modal ──────────────────────────────────────────────── */}
      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleId="form-create-round"
        title="Ny inspeksjonsrunde"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
              onClick={() => setCreateOpen(false)}
            >
              Avbryt
            </button>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: '#1a3d32' }}
              onClick={async () => {
                const templateId = newRoundForm.templateId || inspection.templates[0]?.id || ''
                if (!templateId || !newRoundForm.title.trim()) return
                await inspection.createRound({
                  templateId,
                  locationId: newRoundForm.locationId || undefined,
                  title: newRoundForm.title,
                  cronExpression: newRoundForm.cronExpression || undefined,
                  scheduledFor: newRoundForm.scheduledFor || undefined,
                  assignedTo: newRoundForm.assignedTo || undefined,
                })
                setCreateOpen(false)
                setNewRoundForm({ title: '', templateId: '', locationId: '', cronExpression: '', scheduledFor: '', assignedTo: '' })
              }}
            >
              Opprett
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Tittel</span>
            <input
              value={newRoundForm.title}
              onChange={(e) => setNewRoundForm((p) => ({ ...p, title: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Mal</span>
            <select
              value={newRoundForm.templateId || inspection.templates[0]?.id || ''}
              onChange={(e) => setNewRoundForm((p) => ({ ...p, templateId: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2"
            >
              {inspection.templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Lokasjon</span>
            <select
              value={newRoundForm.locationId}
              onChange={(e) => setNewRoundForm((p) => ({ ...p, locationId: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2"
            >
              <option value="">(Valgfri)</option>
              {inspection.locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Planlagt dato</span>
            <input
              type="datetime-local"
              value={newRoundForm.scheduledFor}
              onChange={(e) => setNewRoundForm((p) => ({ ...p, scheduledFor: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs text-neutral-500">Ansvarlig</span>
            <select
              value={newRoundForm.assignedTo}
              onChange={(e) => setNewRoundForm((p) => ({ ...p, assignedTo: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2"
            >
              <option value="">(Valgfri)</option>
              {inspection.assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-neutral-500">Gjentakelse (valgfri)</span>
            <RecurrencePicker
              value={newRoundForm.cronExpression}
              onChange={(cron) => setNewRoundForm((p) => ({ ...p, cronExpression: cron }))}
            />
          </div>
        </div>
      </FormModal>

      {/* ── Scheduling modal ─────────────────────────────────────────────────── */}
      <FormModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        titleId="form-scheduling"
        title="Planlegging av runder"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
              onClick={() => setScheduleOpen(false)}
            >
              Lukk
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {roundsForSchedule.map((round) => {
            const draft = scheduleDraft[round.id] ?? {
              scheduledFor: round.scheduled_for ?? '',
              cronExpression: round.cron_expression ?? '',
              assignedTo: round.assigned_to ?? '',
            }
            return (
              <div key={round.id} className="rounded-lg border border-neutral-200 p-3">
                <p className="text-sm font-medium text-neutral-900">{round.title}</p>
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-neutral-500">Planlagt dato</span>
                      <input
                        type="datetime-local"
                        value={toDateTimeLocalValue(draft.scheduledFor || null)}
                        onChange={(e) =>
                          setScheduleDraft((p) => ({ ...p, [round.id]: { ...draft, scheduledFor: e.target.value } }))
                        }
                        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-neutral-500">Ansvarlig</span>
                      <select
                        value={draft.assignedTo}
                        onChange={(e) =>
                          setScheduleDraft((p) => ({ ...p, [round.id]: { ...draft, assignedTo: e.target.value } }))
                        }
                        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
                      >
                        <option value="">(Ingen)</option>
                        {inspection.assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.displayName}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-500">Gjentakelse</span>
                    <RecurrencePicker
                      value={draft.cronExpression}
                      onChange={(cron) =>
                        setScheduleDraft((p) => ({ ...p, [round.id]: { ...draft, cronExpression: cron } }))
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-2 rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium"
                  onClick={() =>
                    void inspection.updateRoundSchedule({
                      roundId: round.id,
                      scheduledFor: draft.scheduledFor || undefined,
                      cronExpression: draft.cronExpression || undefined,
                      assignedTo: draft.assignedTo || undefined,
                      status: round.status === 'draft' ? 'active' : undefined,
                    })
                  }
                >
                  Lagre
                </button>
              </div>
            )
          })}
          {roundsForSchedule.length === 0 && (
            <p className="text-sm text-neutral-500">Ingen runder. Opprett en runde først.</p>
          )}
        </div>
      </FormModal>
    </div>
  )
}
