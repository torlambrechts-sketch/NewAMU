import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { RosAnalysisRow, RosHazardRow, RosMeasureRow, RosControlType } from './types'
import { CONTROL_TYPE_LABEL, CONTROL_TYPE_COLOR, CONTROL_TYPE_RANK } from './types'
import type { RosState } from './useRos'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { Badge } from '../../src/components/ui/Badge'
import type { BadgeVariant } from '../../src/components/ui/Badge'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'

const ALL_CONTROL_TYPES: RosControlType[] = ['eliminate', 'substitute', 'engineering', 'administrative', 'ppe']

const MEASURE_STATUS_OPTIONS: SelectOption[] = [
  { value: 'open', label: 'Åpen' },
  { value: 'in_progress', label: 'Pågår' },
  { value: 'completed', label: 'Fullført' },
  { value: 'cancelled', label: 'Avlyst' },
]

const TH =
  'border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500'

const TR_BODY = 'border-b border-neutral-100 last:border-b-0 transition-colors hover:bg-neutral-50'

function measureStatusBadge(status: RosMeasureRow['status']): BadgeVariant {
  switch (status) {
    case 'open':
      return 'warning'
    case 'in_progress':
      return 'info'
    case 'completed':
      return 'success'
    case 'cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function measureStatusLabel(status: RosMeasureRow['status']): string {
  return MEASURE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

export function RosMeasuresTab({
  analysis,
  hazards,
  measures,
  ros,
}: {
  analysis: RosAnalysisRow
  hazards: RosHazardRow[]
  measures: RosMeasureRow[]
  ros: RosState
}) {
  const readOnly = analysis.status === 'approved' || analysis.status === 'archived'
  const [addingForHazard, setAddingForHazard] = useState<string | null>(null)
  const [form, setForm] = useState({
    description: '',
    control_type: 'administrative' as RosControlType,
    assigned_to_name: '',
    due_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [hazardPickForAdd, setHazardPickForAdd] = useState('')

  const hazardById = useMemo(() => {
    const m: Record<string, RosHazardRow> = {}
    for (const h of hazards) m[h.id] = h
    return m
  }, [hazards])

  const hazardOptionsForAdd: SelectOption[] = useMemo(
    () => hazards.map((h) => ({ value: h.id, label: h.description })),
    [hazards],
  )

  const controlTypeOptions: SelectOption[] = useMemo(
    () => ALL_CONTROL_TYPES.map((ct) => ({ value: ct, label: CONTROL_TYPE_LABEL[ct] })),
    [],
  )

  const measureRows = useMemo(() => {
    const rows: { hazard: RosHazardRow; measure: RosMeasureRow }[] = []
    for (const h of hazards) {
      const list = measures
        .filter((m) => m.hazard_id === h.id)
        .sort((a, b) => CONTROL_TYPE_RANK[a.control_type] - CONTROL_TYPE_RANK[b.control_type])
      for (const m of list) rows.push({ hazard: h, measure: m })
    }
    return rows
  }, [hazards, measures])

  const open = measures.filter((m) => m.status === 'open').length
  const overdue = measures.filter((m) => m.status !== 'completed' && m.due_date && new Date(m.due_date) < new Date()).length
  const completed = measures.filter((m) => m.status === 'completed').length

  const kpiItems = useMemo(
    () => [
      { big: String(measures.length), title: 'Totalt tiltak', sub: 'Registrert' },
      { big: String(open), title: 'Åpne', sub: 'Status åpen' },
      { big: String(overdue), title: 'Forfalt', sub: 'Ikke fullført, frist passert' },
      { big: String(completed), title: 'Fullført', sub: 'Avsluttede tiltak' },
    ],
    [measures.length, open, overdue, completed],
  )

  async function handleAddMeasure(hazardId: string) {
    if (!form.description.trim()) return
    setSaving(true)
    await ros.upsertMeasure(analysis.id, hazardId, {
      description: form.description,
      control_type: form.control_type,
      assigned_to_name: form.assigned_to_name || null,
      due_date: form.due_date || null,
    })
    setSaving(false)
    setAddingForHazard(null)
    setForm({ description: '', control_type: 'administrative', assigned_to_name: '', due_date: '' })
  }

  const targetHazardIdForAdd = useMemo(() => {
    if (hazards.length === 0) return ''
    if (hazards.length === 1) return hazards[0]!.id
    if (hazardPickForAdd && hazards.some((h) => h.id === hazardPickForAdd)) return hazardPickForAdd
    return ''
  }, [hazards, hazardPickForAdd])

  const headerActions = (
    <>
      {!readOnly && hazards.length > 1 && (
        <div className="min-w-[12rem] max-w-[280px]">
          <SearchableSelect
            value={hazardPickForAdd}
            options={hazardOptionsForAdd}
            placeholder="Velg farekilde…"
            onChange={(v) => setHazardPickForAdd(v)}
          />
        </div>
      )}
      {!readOnly && (
        <Button
          type="button"
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          disabled={hazards.length === 0 || !targetHazardIdForAdd}
          onClick={() => {
            if (targetHazardIdForAdd) setAddingForHazard(targetHazardIdForAdd)
          }}
        >
          Legg til tiltak
        </Button>
      )}
    </>
  )

  const toolbar = (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
        Hierarki av barrierer (mest effektivt → minst effektivt)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {ALL_CONTROL_TYPES.map((ct, i) => (
          <span key={ct} className="flex items-center gap-1.5">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${CONTROL_TYPE_COLOR[ct]}`}>
              {i + 1}. {CONTROL_TYPE_LABEL[ct]}
            </span>
            {i < 4 && <span className="text-neutral-300">›</span>}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <LayoutScoreStatRow items={kpiItems} />

      <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title="Registrerte tiltak"
          description="Oversikt over alle barrierer og tiltak knyttet til farekildene."
          headerActions={headerActions}
          toolbar={toolbar}
        >
          <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className={TH}>Tittel</th>
                <th className={TH}>Type / kategori</th>
                <th className={TH}>Status</th>
                <th className={TH}>Ansvarlig</th>
                <th className={`${TH} text-right`}>Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {measureRows.map(({ hazard: h, measure: m }) => {
                const isOverdue = m.status !== 'completed' && m.due_date && new Date(m.due_date) < new Date()
                return (
                  <tr key={m.id} className={TR_BODY}>
                    <td className="max-w-[min(28rem,40vw)] px-5 py-4 align-middle">
                      <p className="whitespace-normal font-medium text-neutral-900">{m.description}</p>
                      <p className="mt-0.5 whitespace-normal text-xs text-neutral-500">{h.description}</p>
                      {m.due_date && (
                        <p className={`mt-0.5 text-xs ${isOverdue ? 'font-semibold text-red-600' : 'text-neutral-500'}`}>
                          Frist: {new Date(m.due_date).toLocaleDateString('nb-NO')}
                          {isOverdue ? ' · FORFALT' : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CONTROL_TYPE_COLOR[m.control_type]}`}>
                        {CONTROL_TYPE_LABEL[m.control_type]}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {!readOnly ? (
                        <div className="w-44">
                          <SearchableSelect
                            value={m.status}
                            options={MEASURE_STATUS_OPTIONS}
                            onChange={(v) =>
                              void ros.upsertMeasure(analysis.id, h.id, {
                                id: m.id,
                                description: m.description,
                                status: v as RosMeasureRow['status'],
                              })
                            }
                          />
                        </div>
                      ) : (
                        <Badge variant={measureStatusBadge(m.status)}>{measureStatusLabel(m.status)}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle text-neutral-700">
                      <span className="whitespace-normal">{m.assigned_to_name?.trim() || '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Slett tiltak"
                          onClick={() => {
                            if (window.confirm('Slette dette tiltaket?')) void ros.deleteMeasure(analysis.id, m.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {hazards.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm whitespace-normal text-neutral-400">
                    Legg til farekilder i fanen Farekilder før du registrerer tiltak.
                  </td>
                </tr>
              )}
              {hazards.length > 0 && measureRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm whitespace-normal text-neutral-400">
                    Ingen tiltak registrert ennå.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {addingForHazard && !readOnly && (
            <div className="border-t border-neutral-100 bg-neutral-50/80 px-5 py-4 md:px-6">
              <p className="mb-3 text-xs font-medium text-neutral-700">
                Nytt tiltak · {hazardById[addingForHazard]?.description ?? 'Farekilde'}
              </p>
              <div className="space-y-3">
                <label>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse av tiltak *</span>
                  <StandardInput
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Hva skal gjøres?"
                  />
                </label>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <label>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Barrieretype</span>
                    <SearchableSelect
                      value={form.control_type}
                      options={controlTypeOptions}
                      onChange={(v) => setForm((p) => ({ ...p, control_type: v as RosControlType }))}
                    />
                  </label>
                  <label>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</span>
                    <StandardInput
                      value={form.assigned_to_name}
                      onChange={(e) => setForm((p) => ({ ...p, assigned_to_name: e.target.value }))}
                      placeholder="Navn…"
                    />
                  </label>
                  <label>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Frist</span>
                    <StandardInput type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => void handleAddMeasure(addingForHazard)}
                    disabled={saving || !form.description.trim()}
                  >
                    {saving ? 'Lagrer…' : 'Lagre tiltak'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setAddingForHazard(null)}>
                    Avbryt
                  </Button>
                </div>
              </div>
            </div>
          )}
        </LayoutTable1PostingsShell>
      </div>
    </div>
  )
}
