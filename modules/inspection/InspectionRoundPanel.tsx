import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { X } from 'lucide-react'
import { supabase } from '../../src/lib/supabaseClient'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { fetchAssignableUsers, type AssignableUser } from '../../src/hooks/useAssignableUsers'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import type { InspectionLocationRow, InspectionRoundRow, InspectionRoundStatus } from './types'

const FIELD_INPUT =
  'w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25'

type InspectionRoundPanelProps = {
  inspectionId: string
  onClose: () => void
}

function getErrorMessage(err: PostgrestError | Error | null): string {
  if (!err) return 'Ukjent feil'
  if ('message' in err && typeof err.message === 'string') return err.message
  return 'Ukjent feil'
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
          className="p-1 text-neutral-500 transition-colors hover:bg-neutral-200/60 hover:text-neutral-800"
          aria-label="Lukk"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <div className="mx-6 mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-0 py-4">
        {!round ? (
          <p className="px-6 text-sm text-neutral-600">Ingen data.</p>
        ) : (
          <>
            <p className={`${WPSTD_FORM_LEAD} px-6 pb-4`}>
              Oppdater runden direkte i databasen. Endringer lagres ved hver endring.
            </p>

            <div className="border-y border-neutral-200 bg-white">
              <div className={WPSTD_FORM_ROW_GRID}>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="panel-round-title">
                  Tittel
                </label>
                <input
                  id="panel-round-title"
                  type="text"
                  value={round.title}
                  onChange={(e) => void handleUpdate({ title: e.target.value })}
                  className={FIELD_INPUT}
                  placeholder="F.eks. Månedlig vernerunde"
                />
              </div>

              <div className={WPSTD_FORM_ROW_GRID}>
                <span className={WPSTD_FORM_FIELD_LABEL}>Status</span>
                <SearchableSelect
                  value={round.status}
                  options={[
                    { value: 'draft', label: 'Kladd' },
                    { value: 'active', label: 'Aktiv' },
                    { value: 'signed', label: 'Signert' },
                  ]}
                  onChange={(v) => void handleUpdate({ status: v as InspectionRoundStatus })}
                />
              </div>

              <div className={WPSTD_FORM_ROW_GRID}>
                <span className={WPSTD_FORM_FIELD_LABEL}>Lokasjon</span>
                <SearchableSelect
                  value={round.location_id ?? ''}
                  options={[
                    { value: '', label: '(Ingen)' },
                    ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
                  ]}
                  onChange={(v) => void handleUpdate({ location_id: v || null })}
                />
              </div>

              <div className={WPSTD_FORM_ROW_GRID}>
                <span className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</span>
                <SearchableSelect
                  value={round.assigned_to ?? ''}
                  options={[
                    { value: '', label: '(Ingen)' },
                    ...assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
                  ]}
                  onChange={(v) => void handleUpdate({ assigned_to: v || null })}
                />
              </div>

              <div className={WPSTD_FORM_ROW_GRID}>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="panel-round-scheduled">
                  Planlagt tidspunkt
                </label>
                <input
                  id="panel-round-scheduled"
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => {
                    const v = e.target.value
                    void handleUpdate({
                      scheduled_for: v ? new Date(v).toISOString() : null,
                    })
                  }}
                  className={FIELD_INPUT}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-200 bg-white p-6">
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#14312a] focus:outline-none focus:ring-2 focus:ring-[#1a3d32] focus:ring-offset-2"
        >
          Lukk panel
        </button>
      </div>
    </div>
  )
}

export default InspectionRoundPanel
