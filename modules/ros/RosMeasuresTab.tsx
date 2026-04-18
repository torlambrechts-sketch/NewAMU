import { useState } from 'react'
import type { RosAnalysisRow, RosHazardRow, RosMeasureRow, RosControlType } from './types'
import {
  CONTROL_TYPE_LABEL, CONTROL_TYPE_COLOR, CONTROL_TYPE_RANK,
  LAW_DOMAIN_COLOR, riskScore, RISK_BAND_COLOR, RISK_BAND_LABEL, riskBand,
} from './types'
import type { RosState } from './useRos'

const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'
const INPUT = 'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]/30'
const BTN_PRIMARY = 'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14312a] transition-colors disabled:opacity-40'
const BTN_SECONDARY = 'rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50'
const ALL_CONTROL_TYPES: RosControlType[] = ['eliminate','substitute','engineering','administrative','ppe']

export function RosMeasuresTab({
  analysis, hazards, measures, ros,
}: {
  analysis: RosAnalysisRow
  hazards: RosHazardRow[]
  measures: RosMeasureRow[]
  ros: RosState
}) {
  const readOnly = analysis.status === 'approved' || analysis.status === 'archived'
  const [addingForHazard, setAddingForHazard] = useState<string | null>(null)
  const [form, setForm] = useState({ description: '', control_type: 'administrative' as RosControlType, assigned_to_name: '', due_date: '' })
  const [saving, setSaving] = useState(false)

  const measuresByHazard = hazards.reduce<Record<string, RosMeasureRow[]>>((acc, h) => {
    acc[h.id] = measures.filter((m) => m.hazard_id === h.id).sort((a, b) => CONTROL_TYPE_RANK[a.control_type] - CONTROL_TYPE_RANK[b.control_type])
    return acc
  }, {})

  const open     = measures.filter((m) => m.status === 'open').length
  const overdue  = measures.filter((m) => m.status !== 'completed' && m.due_date && new Date(m.due_date) < new Date()).length
  const completed = measures.filter((m) => m.status === 'completed').length

  async function handleAddMeasure(hazardId: string) {
    if (!form.description.trim()) return
    setSaving(true)
    await ros.upsertMeasure(analysis.id, hazardId, {
      description: form.description,
      control_type: form.control_type,
      assigned_to_name: form.assigned_to_name || null,
      due_date: form.due_date || null,
    })
    setSaving(false); setAddingForHazard(null)
    setForm({ description: '', control_type: 'administrative', assigned_to_name: '', due_date: '' })
  }

  return (
    <div className="px-5 py-5 space-y-6 md:px-8">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-3">
        <div className="text-center"><p className="text-lg font-bold text-neutral-900">{measures.length}</p><p className="text-xs text-neutral-500">Totalt tiltak</p></div>
        <div className="text-center"><p className="text-lg font-bold text-amber-700">{open}</p><p className="text-xs text-neutral-500">Åpne</p></div>
        {overdue > 0 && <div className="text-center"><p className="text-lg font-bold text-red-600">{overdue}</p><p className="text-xs text-neutral-500">Forfalt</p></div>}
        <div className="text-center"><p className="text-lg font-bold text-green-700">{completed}</p><p className="text-xs text-neutral-500">Fullført</p></div>
      </div>

      {/* Control hierarchy legend */}
      <div>
        <p className={FIELD_LABEL + ' mb-2'}>Hierarki av barrierer (mest effektivt → minst effektivt)</p>
        <div className="flex flex-wrap gap-2">
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

      {/* Hazard → measures groups */}
      <div className="space-y-4">
        {hazards.map((h) => {
          const hMeasures = measuresByHazard[h.id] ?? []
          const resScore = riskScore(h.residual_probability, h.residual_consequence)
          const band = riskBand(resScore)
          return (
            <div key={h.id} className="rounded-xl border border-neutral-200 overflow-hidden">
              {/* Hazard header */}
              <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                    style={{ backgroundColor: LAW_DOMAIN_COLOR[h.law_domain] }}>{h.law_domain}</span>
                  <p className="text-sm font-semibold text-neutral-900 truncate">{h.description}</p>
                  {resScore != null && (
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${RISK_BAND_COLOR[band]}`}>
                      {resScore} — {RISK_BAND_LABEL[band]}
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <button type="button" onClick={() => setAddingForHazard(h.id)}
                    className="shrink-0 text-xs text-[#1a3d32] hover:underline">
                    + Tiltak
                  </button>
                )}
              </div>

              {/* Measure rows */}
              {hMeasures.length === 0 && addingForHazard !== h.id && (
                <p className="px-4 py-3 text-xs text-neutral-400 italic">Ingen tiltak registrert.</p>
              )}
              {hMeasures.map((m) => {
                const isOverdue = m.status !== 'completed' && m.due_date && new Date(m.due_date) < new Date()
                return (
                  <div key={m.id} className="flex items-center gap-3 border-b border-neutral-50 px-4 py-2.5 last:border-b-0">
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
                      <select value={m.status}
                        onChange={(e) => void ros.upsertMeasure(analysis.id, h.id, { id: m.id, description: m.description, status: e.target.value as RosMeasureRow['status'] })}
                        className="shrink-0 rounded border border-neutral-200 bg-white px-2 py-1 text-xs">
                        <option value="open">Åpen</option>
                        <option value="in_progress">Pågår</option>
                        <option value="completed">Fullført</option>
                        <option value="cancelled">Avlyst</option>
                      </select>
                    )}
                  </div>
                )
              })}

              {/* Inline add form */}
              {addingForHazard === h.id && (
                <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-4 space-y-3">
                  <div>
                    <label className={FIELD_LABEL}>Beskrivelse av tiltak *</label>
                    <input value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Hva skal gjøres?"
                      className={INPUT} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className={FIELD_LABEL}>Barrieretype</label>
                      <select value={form.control_type}
                        onChange={(e) => setForm((p) => ({ ...p, control_type: e.target.value as RosControlType }))}
                        className={INPUT}>
                        {ALL_CONTROL_TYPES.map((ct) => <option key={ct} value={ct}>{CONTROL_TYPE_LABEL[ct]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>Ansvarlig</label>
                      <input value={form.assigned_to_name}
                        onChange={(e) => setForm((p) => ({ ...p, assigned_to_name: e.target.value }))}
                        placeholder="Navn…" className={INPUT} />
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>Frist</label>
                      <input type="date" value={form.due_date}
                        onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                        className={INPUT} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleAddMeasure(h.id)}
                      disabled={saving || !form.description.trim() || readOnly} className={BTN_PRIMARY}>
                      {saving ? 'Lagrer…' : 'Legg til tiltak'}
                    </button>
                    <button type="button" onClick={() => setAddingForHazard(null)} className={BTN_SECONDARY}>Avbryt</button>
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
  )
}
