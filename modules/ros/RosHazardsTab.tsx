import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { RiskMatrix, riskScoreFromProbCons } from '../../src/components/hse/RiskMatrix'
import { RosRiskScatter } from './RosRiskScatter'
import type { RosAnalysisRow, RosHazardRow, RosMeasureRow, RosLawDomain } from './types'
import { LAW_DOMAIN_BG, ALL_LAW_DOMAINS, LAW_DOMAIN_CHIP_ACTIVE, riskScore, riskBand, RISK_BAND_LABEL } from './types'
import type { RosState } from './useRos'
import { Button } from '../../src/components/ui/Button'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { Badge } from '../../src/components/ui/Badge'
import type { BadgeVariant } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'

function riskBandBadgeVariant(band: ReturnType<typeof riskBand>): BadgeVariant {
  switch (band) {
    case 'low':
      return 'success'
    case 'medium':
      return 'medium'
    case 'high':
      return 'high'
    case 'critical':
      return 'critical'
    default:
      return 'neutral'
  }
}

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
  return {
    description: '',
    category: '',
    law_domain: 'AML',
    existing_controls: '',
    initial_probability: null,
    initial_consequence: null,
    residual_probability: null,
    residual_consequence: null,
  }
}

export function RosHazardsTab({
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
  const [selectedId, setSelectedId] = useState<string | null>(hazards[0]?.id ?? null)
  const [lawFilter, setLawFilter] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<HazardFormState>(emptyHazard)
  const [saving, setSaving] = useState(false)

  const probLabels = useMemo(() => {
    const m: Record<number, string> = {}
    for (const p of ros.probabilityScale) m[p.level] = p.label
    return m
  }, [ros.probabilityScale])

  const consLabels = useMemo(() => {
    const m: Record<number, string> = {}
    for (const c of ros.consequenceCategories) m[c.matrix_column] = c.label
    return m
  }, [ros.consequenceCategories])

  const hazardCategoryOptions: SelectOption[] = useMemo(() => {
    const rows = ros.hazardCategories.map((c) => ({ value: c.code, label: c.label }))
    return [{ value: '', label: '(ingen kategori)' }, ...rows]
  }, [ros.hazardCategories])

  const lawDomainOptions: SelectOption[] = useMemo(
    () => ALL_LAW_DOMAINS.map((d) => ({ value: d, label: d })),
    [],
  )

  const selectedHazard = hazards.find((h) => h.id === selectedId) ?? null
  const measuresForSelected = (measures ?? []).filter((m) => m.hazard_id === selectedId)

  const filtered = lawFilter ? hazards.filter((h) => h.law_domain === lawFilter) : hazards

  const criticalHazards = hazards.filter((h) => {
    const s = riskScore(h.residual_probability, h.residual_consequence)
    return s != null && s >= 15
  })

  function startEdit(h: RosHazardRow) {
    setEditingId(h.id)
    setSelectedId(h.id)
    setForm({
      description: h.description,
      category: h.category ?? '',
      law_domain: h.law_domain,
      existing_controls: h.existing_controls ?? '',
      initial_probability: h.initial_probability,
      initial_consequence: h.initial_consequence,
      residual_probability: h.residual_probability,
      residual_consequence: h.residual_consequence,
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

  const hazardKpiItems = useMemo(
    () => [
      { big: String(hazards.length), title: 'Totalt farekilder', sub: 'Registrert' },
      { big: String(filtered.length), title: 'Synlige i filter', sub: lawFilter ? `Domene: ${lawFilter}` : 'Alle domener' },
      { big: String(criticalHazards.length), title: 'Kritiske (≥15)', sub: 'Residual risiko' },
    ],
    [hazards.length, filtered.length, criticalHazards.length, lawFilter],
  )

  return (
    <div className="space-y-6">
      <LayoutScoreStatRow items={hazardKpiItems} />

      {criticalHazards.length > 0 && (
        <WarningBox>
          <p className="font-semibold">
            {criticalHazards.length} farekilder med kritisk residual risiko (≥ 15) — tiltak er lovpålagt
          </p>
          <p className="mt-1 text-sm">
            IK-forskriften § 5 nr. 6: Risikoer med score ≥ 15 krever skriftlig tiltaksplan. Disse kan kobles til tiltaksplan
            i internkontrollen.
          </p>
        </WarningBox>
      )}

      <div className="flex min-h-[600px] flex-col gap-6 md:flex-row">
        <div className="w-full min-w-0 md:w-[55%]">
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <div className="border-b border-neutral-100 bg-neutral-50/60 px-5 py-4">
              <RosRiskScatter
                hazards={hazards}
                selectedId={selectedId}
                onSelect={setSelectedId}
                probabilityLabels={probLabels}
                consequenceLabels={consLabels}
              />
            </div>

            <div className="flex flex-col gap-4 border-b border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Registrerte farekilder</h3>
                <p className="mt-1 text-sm text-neutral-500">Oversikt over alle farekilder som er kartlagt i analysen.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!readOnly && (
                  <Button
                    type="button"
                    variant="primary"
                    icon={<Plus className="h-4 w-4" />}
                    disabled={editingId === '__new__'}
                    onClick={startNew}
                  >
                    Legg til farekilde
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4 p-5 md:p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Filter på lovdomene</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={!lawFilter ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setLawFilter(null)}
                  >
                    Alle
                  </Button>
                  {analysis.law_domains.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={lawFilter === d ? 'primary' : 'secondary'}
                      onClick={() => setLawFilter(lawFilter === d ? null : d)}
                      className={lawFilter === d ? `${LAW_DOMAIN_CHIP_ACTIVE[d]} border-transparent` : ''}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-100">
                {filtered.map((h) => {
              const initScore = riskScore(h.initial_probability, h.initial_consequence)
              const resScore = riskScore(h.residual_probability, h.residual_consequence)
              const band = riskBand(resScore ?? initScore)
              const mCount = (measures ?? []).filter((m) => m.hazard_id === h.id).length
              const border = {
                low: 'border-l-blue-300',
                medium: 'border-l-yellow-400',
                high: 'border-l-orange-400 bg-orange-50/20',
                critical: 'border-l-red-500 bg-red-50/30',
              }[band]
              return (
                <div
                  key={h.id}
                  className={`cursor-pointer border-l-4 px-5 py-3 transition-colors ${border} ${
                    selectedId === h.id ? 'ring-1 ring-neutral-300' : 'hover:bg-neutral-50'
                  }`}
                  onClick={() => {
                    setSelectedId(h.id)
                    setEditingId(null)
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-neutral-900">{h.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${LAW_DOMAIN_BG[h.law_domain]}`}>
                          {h.law_domain}
                        </span>
                        {initScore != null && <span className="text-[10px] text-neutral-400">Initial: {initScore}</span>}
                        {resScore != null && (
                          <Badge variant={riskBandBadgeVariant(band)}>
                            Residual: {resScore} — {RISK_BAND_LABEL[band]}
                          </Badge>
                        )}
                        {mCount > 0 && <span className="text-[10px] text-neutral-500">{mCount} tiltak</span>}
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(h)} aria-label="Rediger">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm('Slette denne farekilden?')) void ros.deleteHazard(analysis.id, h.id)
                          }}
                          aria-label="Slett"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
                })}
                {filtered.length === 0 && (
                  <p className="py-10 text-center text-sm text-neutral-400">Ingen farekilder ennå.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`min-w-0 flex-1 overflow-hidden ${WORKPLACE_MODULE_CARD}`} style={WORKPLACE_MODULE_CARD_SHADOW}>
          <div className="max-h-[min(80vh,900px)] overflow-y-auto p-5 md:p-6">
          {editingId ? (
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                {editingId === '__new__' ? 'Ny farekilde' : 'Rediger farekilde'}
              </p>

              <div className={WPSTD_FORM_ROW_GRID}>
                <label className="md:col-span-2">
                  <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse *</span>
                  <StandardTextarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Hva er faren? Vær spesifikk…"
                  />
                </label>
                <label>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Lovdomene</span>
                  <SearchableSelect
                    value={form.law_domain}
                    options={lawDomainOptions}
                    disabled={readOnly}
                    onChange={(v) => setForm((p) => ({ ...p, law_domain: v as RosLawDomain }))}
                  />
                </label>
                <label>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Farekategori</span>
                  <SearchableSelect
                    value={form.category}
                    options={hazardCategoryOptions}
                    placeholder="Velg kategori…"
                    disabled={readOnly}
                    onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className={WPSTD_FORM_FIELD_LABEL}>Eksisterende barrierer</span>
                  <StandardTextarea
                    rows={2}
                    value={form.existing_controls}
                    onChange={(e) => setForm((p) => ({ ...p, existing_controls: e.target.value }))}
                    placeholder="Hva er allerede på plass?"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className={`${WPSTD_FORM_FIELD_LABEL} mb-2`}>Initial risiko (uten tiltak)</p>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <RiskMatrix
                      probability={form.initial_probability}
                      consequence={form.initial_consequence}
                      onChange={(p, c) => setForm((prev) => ({ ...prev, initial_probability: p, initial_consequence: c }))}
                      size="sm"
                      readOnly={readOnly}
                      probabilityLabels={probLabels}
                      consequenceLabels={consLabels}
                    />
                  </div>
                </div>
                <div>
                  <p className={`${WPSTD_FORM_FIELD_LABEL} mb-2`}>Residual risiko (med tiltak)</p>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <RiskMatrix
                      probability={form.residual_probability}
                      consequence={form.residual_consequence}
                      onChange={(p, c) =>
                        setForm((prev) => ({ ...prev, residual_probability: p, residual_consequence: c }))
                      }
                      size="sm"
                      readOnly={readOnly}
                      probabilityLabels={probLabels}
                      consequenceLabels={consLabels}
                    />
                  </div>
                  {(() => {
                    const s = riskScoreFromProbCons(form.residual_probability, form.residual_consequence)
                    return s != null && s >= 15 ? (
                      <p className="mt-2 text-xs font-semibold text-red-600">
                        Residual risiko {s} ≥ 15 — kritisk nivå (tiltaksplan kan kobles automatisk)
                      </p>
                    ) : null
                  })()}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleSave()}
                  disabled={saving || !form.description.trim() || readOnly}
                >
                  {saving ? 'Lagrer…' : 'Lagre farekilde'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                  Avbryt
                </Button>
              </div>
            </div>
          ) : selectedHazard ? (
            <div className="space-y-4">
              <div>
                <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Valgt farekilde</p>
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
                <Button type="button" variant="secondary" onClick={() => startEdit(selectedHazard)}>
                  Rediger farekilde
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Velg en farekilde til venstre for å se detaljer.</p>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
