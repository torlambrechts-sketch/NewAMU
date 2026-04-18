import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { RiskMatrix, riskScoreFromProbCons } from '../../src/components/hse/RiskMatrix'
import { RosRiskScatter } from './RosRiskScatter'
import type { RosAnalysisRow, RosHazardRow, RosMeasureRow, RosLawDomain } from './types'
import {
  LAW_DOMAIN_COLOR, ALL_LAW_DOMAINS, riskScore, riskBand,
  RISK_BAND_COLOR, RISK_BAND_LABEL,
} from './types'
import type { RosState } from './useRos'

const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'
const INPUT = 'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]/30'
const BTN_PRIMARY = 'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14312a] transition-colors disabled:opacity-40'
const BTN_SECONDARY = 'rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50'

type HazardFormState = {
  description: string
  category: string
  law_domain: RosLawDomain
  existing_controls: string
  initial_probability: number | null
  initial_consequence: number | null
  residual_probability: number | null
  residual_consequence: number | null
}

function emptyHazard(): HazardFormState {
  return { description: '', category: '', law_domain: 'AML',
    existing_controls: '', initial_probability: null,
    initial_consequence: null, residual_probability: null,
    residual_consequence: null }
}

export function RosHazardsTab({
  analysis, hazards, measures, ros,
}: {
  analysis: RosAnalysisRow
  hazards: RosHazardRow[]
  measures: RosMeasureRow[]
  ros: RosState
}) {
  const readOnly = analysis.status === 'approved' || analysis.status === 'archived'
  const [selectedId, setSelectedId] = useState<string | null>(hazards[0]?.id ?? null)
  const [lawFilter, setLawFilter] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<HazardFormState>(emptyHazard)
  const [saving, setSaving] = useState(false)

  const selectedHazard = hazards.find((h) => h.id === selectedId) ?? null
  const measuresForSelected = (measures ?? []).filter((m) => m.hazard_id === selectedId)

  const filtered = lawFilter ? hazards.filter((h) => h.law_domain === lawFilter) : hazards

  // STOPP check
  const criticalHazards = hazards.filter((h) => {
    const s = riskScore(h.residual_probability, h.residual_consequence)
    return s != null && s >= 15
  })

  function startEdit(h: RosHazardRow) {
    setEditingId(h.id); setSelectedId(h.id)
    setForm({
      description: h.description, category: h.category ?? '',
      law_domain: h.law_domain, existing_controls: h.existing_controls ?? '',
      initial_probability: h.initial_probability, initial_consequence: h.initial_consequence,
      residual_probability: h.residual_probability, residual_consequence: h.residual_consequence,
    })
  }

  function startNew() {
    setEditingId('__new__')
    setForm(emptyHazard())
  }

  async function handleSave() {
    if (!form.description.trim()) return
    setSaving(true)
    const result = await ros.upsertHazard(analysis.id, {
      ...(editingId !== '__new__' ? { id: editingId! } : {}),
      ...form,
    })
    setSaving(false)
    setEditingId(null)
    if (result?.id) setSelectedId(result.id)
  }

  return (
    <div>
      {/* STOPP banner */}
      {criticalHazards.length > 0 && (
        <div className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-3">
          <span className="text-lg leading-none">⛔</span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {criticalHazards.length} farekilder med kritisk residual risiko (≥ 15) — tiltak er lovpålagt
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              IK-forskriften § 5 nr. 6: Risikoer med score ≥ 15 krever skriftlig tiltaksplan.
              Disse er automatisk lagt til tiltaksplanen.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-0 md:flex-row md:min-h-[600px]">
        {/* ── LEFT: hazard list + scatter ── */}
        <div className="w-full border-b border-neutral-200 md:w-[55%] md:border-b-0 md:border-r">
          {/* Scatter plot */}
          <div className="border-b border-neutral-100 bg-neutral-50/60 px-5 py-4">
            <RosRiskScatter hazards={hazards} selectedId={selectedId} onSelect={setSelectedId} />
          </div>

          {/* Law filter */}
          <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
            <button type="button" onClick={() => setLawFilter(null)}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors ${
                !lawFilter ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-600'
              }`}>
              Alle
            </button>
            {analysis.law_domains.map((d) => (
              <button key={d} type="button" onClick={() => setLawFilter(lawFilter === d ? null : d)}
                className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors"
                style={lawFilter === d
                  ? { backgroundColor: LAW_DOMAIN_COLOR[d], color: '#fff', borderColor: LAW_DOMAIN_COLOR[d] }
                  : { borderColor: '#d4d4d4', color: '#737373' }
                }>
                {d}
              </button>
            ))}
            <span className="ml-auto text-xs text-neutral-400">{filtered.length} farekilder</span>
          </div>

          {/* Hazard rows */}
          <div className="divide-y divide-neutral-100">
            {filtered.map((h) => {
              const initScore = riskScore(h.initial_probability, h.initial_consequence)
              const resScore  = riskScore(h.residual_probability, h.residual_consequence)
              const band      = riskBand(resScore ?? initScore)
              const mCount    = (measures ?? []).filter((m) => m.hazard_id === h.id).length
              const BORDER = { low: 'border-l-green-400', medium: 'border-l-yellow-400', high: 'border-l-orange-400', critical: 'border-l-red-500' }
              return (
                <div key={h.id}
                  className={`cursor-pointer border-l-4 px-5 py-3 transition-colors ${BORDER[band]} ${
                    selectedId === h.id ? 'bg-[#f4f1ea]' : 'hover:bg-neutral-50'
                  }`}
                  onClick={() => { setSelectedId(h.id); setEditingId(null) }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 line-clamp-2">{h.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                          style={{ backgroundColor: LAW_DOMAIN_COLOR[h.law_domain] }}>
                          {h.law_domain}
                        </span>
                        {initScore != null && (
                          <span className="text-[10px] text-neutral-400">Initial: {initScore}</span>
                        )}
                        {resScore != null && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${RISK_BAND_COLOR[band]}`}>
                            Residual: {resScore} — {RISK_BAND_LABEL[band]}
                          </span>
                        )}
                        {mCount > 0 && (
                          <span className="text-[10px] text-neutral-500">{mCount} tiltak</span>
                        )}
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => startEdit(h)}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-[#1a3d32]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button"
                          onClick={() => { if (window.confirm('Slette?')) void ros.deleteHazard(analysis.id, h.id) }}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-neutral-400">Ingen farekilder ennå.</p>
            )}
          </div>

          {/* Add button */}
          {!readOnly && editingId !== '__new__' && (
            <div className="border-t border-neutral-100 px-5 py-3">
              <button type="button" onClick={startNew} className="text-sm font-medium text-[#1a3d32] hover:underline">
                + Legg til farekilde
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: hazard detail / edit form ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {editingId ? (
            <div className="space-y-4">
              <p className={FIELD_LABEL}>{editingId === '__new__' ? 'Ny farekilde' : 'Rediger farekilde'}</p>

              <div>
                <label className={FIELD_LABEL}>Beskrivelse *</label>
                <textarea rows={2} value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Hva er faren? Vær spesifikk…"
                  className={`${INPUT} resize-none`} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={FIELD_LABEL}>Lovdomene</label>
                  <select value={form.law_domain}
                    onChange={(e) => setForm((p) => ({ ...p, law_domain: e.target.value as RosLawDomain }))}
                    className={INPUT}>
                    {ALL_LAW_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={FIELD_LABEL}>Kategori</label>
                  <input value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    placeholder="fysisk, kjemisk, ergonomisk…"
                    className={INPUT} />
                </div>
              </div>

              <div>
                <label className={FIELD_LABEL}>Eksisterende barrierer</label>
                <textarea rows={2} value={form.existing_controls}
                  onChange={(e) => setForm((p) => ({ ...p, existing_controls: e.target.value }))}
                  placeholder="Hva er allerede på plass?"
                  className={`${INPUT} resize-none`} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className={FIELD_LABEL + ' mb-2'}>Initial risiko (uten tiltak)</p>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <RiskMatrix
                      probability={form.initial_probability}
                      consequence={form.initial_consequence}
                      onChange={(p, c) => setForm((prev) => ({ ...prev, initial_probability: p, initial_consequence: c }))}
                      size="sm"
                      readOnly={readOnly}
                    />
                  </div>
                </div>
                <div>
                  <p className={FIELD_LABEL + ' mb-2'}>Residual risiko (med tiltak)</p>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <RiskMatrix
                      probability={form.residual_probability}
                      consequence={form.residual_consequence}
                      onChange={(p, c) => setForm((prev) => ({ ...prev, residual_probability: p, residual_consequence: c }))}
                      size="sm"
                      readOnly={readOnly}
                    />
                  </div>
                  {(() => {
                    const s = riskScoreFromProbCons(form.residual_probability, form.residual_consequence)
                    return s != null && s >= 15 ? (
                      <p className="mt-2 text-xs font-semibold text-red-600">
                        ⛔ Residual risiko {s} ≥ 15 — tiltaksplan opprettes automatisk
                      </p>
                    ) : null
                  })()}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => void handleSave()} disabled={saving || !form.description.trim() || readOnly} className={BTN_PRIMARY}>
                  {saving ? 'Lagrer…' : 'Lagre farekilde'}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className={BTN_SECONDARY}>Avbryt</button>
              </div>
            </div>
          ) : selectedHazard ? (
            <div className="space-y-4">
              <div>
                <p className={FIELD_LABEL + ' mb-1'}>Valgt farekilde</p>
                <p className="text-base font-semibold text-neutral-900">{selectedHazard.description}</p>
                {selectedHazard.existing_controls && (
                  <p className="mt-1 text-xs text-neutral-500">
                    <strong>Eksisterende barrierer:</strong> {selectedHazard.existing_controls}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-xs text-neutral-600">
                <p>Tiltak for denne farekilden administreres i fanen <strong>Tiltak</strong>.</p>
                <p className="mt-1">Antall tiltak: {measuresForSelected.length}</p>
              </div>
              {!readOnly && (
                <button type="button" onClick={() => startEdit(selectedHazard)} className={BTN_SECONDARY}>
                  Rediger farekilde
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Velg en farekilde til venstre for å se detaljer.</p>
          )}
        </div>
      </div>
    </div>
  )
}
