import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { RosAnalysisRow, RosHazardRow, RosMeasureRow, RosControlType } from './types'
import {
  CONTROL_TYPE_LABEL,
  CONTROL_TYPE_COLOR,
  CONTROL_TYPE_RANK,
  LAW_DOMAIN_BG,
  riskScore,
  RISK_BAND_LABEL,
  riskBand,
} from './types'
import type { RosState } from './useRos'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { Badge } from '../../src/components/ui/Badge'
import type { BadgeVariant } from '../../src/components/ui/Badge'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'

const ALL_CONTROL_TYPES: RosControlType[] = ['eliminate', 'substitute', 'engineering', 'administrative', 'ppe']

const MEASURE_STATUS_OPTIONS: SelectOption[] = [
  { value: 'open', label: 'Åpen' },
  { value: 'in_progress', label: 'Pågår' },
  { value: 'completed', label: 'Fullført' },
  { value: 'cancelled', label: 'Avlyst' },
]

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

function hazardRiskBorderClass(h: RosHazardRow): string {
  const resScore = riskScore(h.residual_probability, h.residual_consequence)
  const band = riskBand(resScore)
  switch (band) {
    case 'low':
      return 'border-l-4 border-l-blue-300'
    case 'medium':
      return 'border-l-4 border-l-yellow-400'
    case 'high':
      return 'border-l-4 border-l-orange-400 bg-orange-50/20'
    case 'critical':
      return 'border-l-4 border-l-red-500 bg-red-50/30'
    default:
      return 'border-l-4 border-l-neutral-200'
  }
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

  const hazardOptionsForAdd: SelectOption[] = useMemo(
    () => hazards.map((h) => ({ value: h.id, label: h.description })),
    [hazards],
  )

  const controlTypeOptions: SelectOption[] = useMemo(
    () => ALL_CONTROL_TYPES.map((ct) => ({ value: ct, label: CONTROL_TYPE_LABEL[ct] })),
    [],
  )

  const measuresByHazard = hazards.reduce<Record<string, RosMeasureRow[]>>((acc, h) => {
    acc[h.id] = measures
      .filter((m) => m.hazard_id === h.id)
      .sort((a, b) => CONTROL_TYPE_RANK[a.control_type] - CONTROL_TYPE_RANK[b.control_type])
    return acc
  }, {})

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

  return (
    <div className="space-y-6">
      <LayoutScoreStatRow items={kpiItems} />

      <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <div className="flex flex-col gap-4 border-b border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Registrerte tiltak</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Oversikt over alle barrierer og tiltak knyttet til farekildene.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!readOnly && hazards.length > 1 && (
              <div className="min-w-[12rem] max-w-xs flex-1 sm:max-w-[280px] sm:flex-initial">
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
          </div>
        </div>

        <div className="space-y-4 p-5 md:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              Hierarki av barrierer (mest effektivt → minst effektivt)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_CONTROL_TYPES.map((ct, i) => (
                <div key={ct} className="flex items-center gap-1.5">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${CONTROL_TYPE_COLOR[ct]}`}>
                    {i + 1}. {CONTROL_TYPE_LABEL[ct]}
                  </span>
                  {i < 4 && <span className="text-neutral-300">›</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {hazards.map((h) => {
              const hMeasures = measuresByHazard[h.id] ?? []
              const resScore = riskScore(h.residual_probability, h.residual_consequence)
              const band = riskBand(resScore)
              return (
                <div key={h.id} className={`overflow-hidden rounded-xl border border-neutral-200 ${hazardRiskBorderClass(h)}`}>
                  <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-white/80 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${LAW_DOMAIN_BG[h.law_domain]}`}>
                        {h.law_domain}
                      </span>
                      <p className="truncate text-sm font-semibold text-neutral-900">{h.description}</p>
                      {resScore != null && (
                        <Badge variant={band === 'critical' ? 'critical' : band === 'high' ? 'high' : band === 'medium' ? 'medium' : 'success'}>
                          {resScore} — {RISK_BAND_LABEL[band]}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {hMeasures.length === 0 && addingForHazard !== h.id && (
                    <p className="px-4 py-3 text-xs italic text-neutral-400">Ingen tiltak registrert.</p>
                  )}
                  {hMeasures.map((m) => {
                    const isOverdue = m.status !== 'completed' && m.due_date && new Date(m.due_date) < new Date()
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 border-b border-neutral-50 bg-white/60 px-4 py-2.5 last:border-b-0"
                      >
                        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${CONTROL_TYPE_COLOR[m.control_type]}`}>
                          {CONTROL_TYPE_LABEL[m.control_type]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-neutral-900">{m.description}</p>
                          <p className="text-xs text-neutral-500">
                            {m.assigned_to_name ? `Ansvarlig: ${m.assigned_to_name}` : 'Ingen ansvarlig'}
                            {m.due_date && ` · Frist: ${new Date(m.due_date).toLocaleDateString('nb-NO')}`}
                            {isOverdue && <span className="ml-1 font-semibold text-red-600">FORFALT</span>}
                          </p>
                        </div>
                        {!readOnly && (
                          <div className="w-44 shrink-0">
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
                        )}
                        {readOnly && (
                          <Badge variant={measureStatusBadge(m.status)}>
                            {MEASURE_STATUS_OPTIONS.find((o) => o.value === m.status)?.label}
                          </Badge>
                        )}
                      </div>
                    )
                  })}

                  {addingForHazard === h.id && (
                    <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/60 px-4 py-4">
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
                          <StandardInput
                            type="date"
                            value={form.due_date}
                            onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                          />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => void handleAddMeasure(h.id)}
                          disabled={saving || !form.description.trim() || readOnly}
                        >
                          {saving ? 'Lagrer…' : 'Legg til tiltak'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setAddingForHazard(null)}>
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {hazards.length === 0 && (
              <p className="py-8 text-center text-sm text-neutral-400">
                Legg til farekilder i fanen Farekilder før du registrerer tiltak.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
