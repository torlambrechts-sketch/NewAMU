import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { X } from 'lucide-react'
import { supabase } from '../../src/lib/supabaseClient'
import {
  WPSTD_FORM_CONTROL_PAIR_GRID,
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_INPUT,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { RecurrencePicker } from '../../src/components/hse/RecurrencePicker'
import {
  buildRecurrenceCron,
  parseRecurrenceCron,
  RECURRENCE_FREQ_LABELS,
  type RecurrenceFreq,
} from '../../src/components/hse/recurrenceCron'
import { fetchAssignableUsers, type AssignableUser } from '../../src/hooks/useAssignableUsers'
import type { InspectionLocationRow, InspectionRoundRow } from './types'

type InspectionRoundPanelProps = {
  inspectionId: string
  onClose: () => void
}

function getErrorMessage(err: PostgrestError | Error | null): string {
  if (!err) return 'Ukjent feil'
  if ('message' in err && typeof err.message === 'string') return err.message
  return 'Ukjent feil'
}

function InspectionRoundPanelFormBody({
  round,
  locations,
  assignableUsers,
  scheduledLocal,
  onUpdate,
}: {
  round: InspectionRoundRow
  locations: InspectionLocationRow[]
  assignableUsers: AssignableUser[]
  scheduledLocal: string
  onUpdate: (patch: Partial<InspectionRoundRow>) => void | Promise<void>
}) {
  const cronStr = round.cron_expression ?? ''
  const recurrenceState = useMemo(() => parseRecurrenceCron(cronStr), [cronStr])
  const freqSelectValue: Exclude<RecurrenceFreq, 'none'> = useMemo(() => {
    const f = recurrenceState.freq
    return f === 'none' ? 'weekly' : f
  }, [recurrenceState.freq])

  const handleFreqSelectChange = (freq: Exclude<RecurrenceFreq, 'none'>) => {
    const prev = cronStr.trim()
      ? parseRecurrenceCron(cronStr)
      : { freq: 'weekly' as const, weekday: 0, hour: 7, minute: 0 }
    void onUpdate({ cron_expression: buildRecurrenceCron({ ...prev, freq }) })
  }

  return (
    <div className="border-y border-neutral-200 bg-white">
      <div className="grid grid-cols-1 gap-y-8">
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Oppdater runden direkte i databasen. Endringer lagres ved hver endring.</p>
          <div className={WPSTD_FORM_CONTROL_PAIR_GRID}>
            <div className="flex flex-col">
              <label htmlFor="panel-round-title" className={WPSTD_FORM_FIELD_LABEL}>
                Tittel
              </label>
            </div>
            <div className="flex flex-col">
              <input
                id="panel-round-title"
                type="text"
                value={round.title}
                onChange={(e) => void onUpdate({ title: e.target.value })}
                className={WPSTD_FORM_INPUT}
                placeholder="F.eks. Månedlig vernerunde"
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Status for inspeksjonsrunden.</p>
          <div className={WPSTD_FORM_CONTROL_PAIR_GRID}>
            <div className="flex flex-col">
              <label htmlFor="panel-round-status" className={WPSTD_FORM_FIELD_LABEL}>
                Status
              </label>
            </div>
            <div className="flex flex-col">
              <select
                id="panel-round-status"
                value={round.status}
                onChange={(e) => void onUpdate({ status: e.target.value as InspectionRoundRow['status'] })}
                className={WPSTD_FORM_INPUT}
              >
                <option value="draft">Kladd</option>
                <option value="active">Aktiv</option>
                <option value="signed">Signert</option>
              </select>
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvor gjennomføres runden?</p>
          <div className={WPSTD_FORM_CONTROL_PAIR_GRID}>
            <div className="flex flex-col">
              <label htmlFor="panel-round-location" className={WPSTD_FORM_FIELD_LABEL}>
                Lokasjon
              </label>
            </div>
            <div className="flex flex-col">
              <select
                id="panel-round-location"
                value={round.location_id ?? ''}
                onChange={(e) =>
                  void onUpdate({ location_id: e.target.value ? e.target.value : null })
                }
                className={WPSTD_FORM_INPUT}
              >
                <option value="">(Ingen)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvem er ansvarlig for gjennomføringen?</p>
          <div className={WPSTD_FORM_CONTROL_PAIR_GRID}>
            <div className="flex flex-col">
              <label htmlFor="panel-round-assigned" className={WPSTD_FORM_FIELD_LABEL}>
                Ansvarlig
              </label>
            </div>
            <div className="flex flex-col">
              <select
                id="panel-round-assigned"
                value={round.assigned_to ?? ''}
                onChange={(e) =>
                  void onUpdate({ assigned_to: e.target.value ? e.target.value : null })
                }
                className={WPSTD_FORM_INPUT}
              >
                <option value="">(Ingen)</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Planlagt dato og tid for gjennomføringen.</p>
          <div className={WPSTD_FORM_CONTROL_PAIR_GRID}>
            <div className="flex flex-col">
              <label htmlFor="panel-round-scheduled" className={WPSTD_FORM_FIELD_LABEL}>
                Planlagt tidspunkt
              </label>
            </div>
            <div className="flex flex-col">
              <input
                id="panel-round-scheduled"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => {
                  const v = e.target.value
                  void onUpdate({
                    scheduled_for: v ? new Date(v).toISOString() : null,
                  })
                }}
                className={WPSTD_FORM_INPUT}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvor ofte skal inspeksjonsrunden gjentas? (valgfritt)</p>
          <div className={WPSTD_FORM_CONTROL_PAIR_GRID}>
            <div className="flex flex-col">
              <label htmlFor="panel-round-freq" className={WPSTD_FORM_FIELD_LABEL}>
                Frekvens
              </label>
            </div>
            <div className="flex flex-col">
              <select
                id="panel-round-freq"
                value={cronStr.trim() ? freqSelectValue : ''}
                onChange={(e) => {
                  const v = e.target.value
                  if (!v) {
                    void onUpdate({ cron_expression: null })
                    return
                  }
                  handleFreqSelectChange(v as Exclude<RecurrenceFreq, 'none'>)
                }}
                className={WPSTD_FORM_INPUT}
              >
                <option value="">(Ingen)</option>
                {(['weekly', 'biweekly', 'monthly', 'quarterly'] as const).map((f) => (
                  <option key={f} value={f}>
                    {RECURRENCE_FREQ_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {cronStr.trim() !== '' && (
          <div className={WPSTD_FORM_ROW_GRID}>
            <p className={WPSTD_FORM_LEAD}>
              Velg ukedag (ved ukentlig mønster) og klokkeslett for planlagt gjentakelse.
            </p>
            <div className="flex flex-col">
              <RecurrencePicker
                value={cronStr}
                onChange={(cron) => void onUpdate({ cron_expression: cron || null })}
                hideFrequencySelect
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function InspectionRoundPanel({ inspectionId, onClose }: InspectionRoundPanelProps) {
  const [loading, setLoading] = useState(true)
  const [round, setRound] = useState<InspectionRoundRow | null>(null)
  const [locations, setLocations] = useState<InspectionLocationRow[]>([])
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !inspectionId) {
      setLoading(false)
      setError('Supabase er ikke konfigurert.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: row, error: roundErr } = await supabase
        .from('inspection_rounds')
        .select('*')
        .eq('id', inspectionId)
        .single()
      if (roundErr) throw roundErr
      if (!row) {
        setError('Inspeksjonsrunden ble ikke funnet.')
        setRound(null)
        return
      }
      setRound(row as InspectionRoundRow)

      const orgId = (row as { organization_id?: string }).organization_id
      if (orgId) {
        const [{ data: locRows, error: locErr }, users] = await Promise.all([
          supabase.from('locations').select('*').eq('organization_id', orgId).order('name', { ascending: true }),
          fetchAssignableUsers(supabase),
        ])
        if (locErr) throw locErr
        setLocations((locRows ?? []) as InspectionLocationRow[])
        setAssignableUsers(users)
      } else {
        setLocations([])
        setAssignableUsers(await fetchAssignableUsers(supabase))
      }
    } catch (e) {
      setError(getErrorMessage(e instanceof Error ? e : (e as PostgrestError)))
      setRound(null)
    } finally {
      setLoading(false)
    }
  }, [inspectionId])

  useEffect(() => {
    void load()
  }, [load])

  const handleUpdate = useCallback(
    async (patch: Partial<InspectionRoundRow>) => {
      if (!supabase || !inspectionId || !round) return
      setError(null)
      const { data, error: upErr } = await supabase
        .from('inspection_rounds')
        .update(patch)
        .eq('id', inspectionId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      if (data) setRound(data as InspectionRoundRow)
    },
    [inspectionId, round],
  )

  const scheduledLocal = useMemo(() => {
    if (!round?.scheduled_for) return ''
    const d = new Date(round.scheduled_for)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [round?.scheduled_for])

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-neutral-200 bg-[#f7f6f2] shadow-2xl">
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-neutral-600">Laster paneldata…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-neutral-200 bg-[#f7f6f2] shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-[#f7f6f2] px-6 py-4">
        <h2 className="text-lg font-semibold text-neutral-900">Rediger inspeksjon</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-200/60 hover:text-neutral-800"
          aria-label="Lukk"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-0 py-0">
        {!round ? (
          <p className="px-6 py-6 text-sm text-neutral-600">Ingen data.</p>
        ) : (
          <InspectionRoundPanelFormBody
            round={round}
            locations={locations}
            assignableUsers={assignableUsers}
            scheduledLocal={scheduledLocal}
            onUpdate={handleUpdate}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-200 bg-white p-6">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#14312a] focus:outline-none focus:ring-2 focus:ring-[#1a3d32] focus:ring-offset-2"
        >
          Lukk panel
        </button>
      </div>
    </div>
  )
}

export default InspectionRoundPanel
