import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  History,
  Loader2,
  Pencil,
  PenLine,
  Settings,
  Trash2,
} from 'lucide-react'
import { HubMenu1Bar, type HubMenu1Item } from '../../src/components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import {
  WORKPLACE_MODULE_CANVAS_BG,
  WORKPLACE_MODULE_CARD,
  WORKPLACE_MODULE_CARD_SHADOW,
} from '../../src/components/layout/workplaceModuleSurface'
import type { HmsCategory, InspectionChecklistItem, InspectionRoundRow } from './types'
import { parseChecklistItems } from './schema'
import { useInspectionModule, type InspectionModuleState } from './useInspectionModule'
import { ChecklistExecutionTab } from '../../src/components/checklist/ChecklistExecutionTab'
import type { ChecklistItem, ChecklistResponse } from '../../src/components/checklist/types'
import { DeviationPanel } from '../../src/components/hse/DeviationPanel'
import { HseAuditLogViewer } from '../../src/components/hse/HseAuditLogViewer'
import { RiskMatrix, riskColorClass, riskLabel, riskScoreFromProbCons } from '../../src/components/hse/RiskMatrix'

type PanelTab = 'checklist' | 'findings' | 'summary' | 'signatures' | 'history'

const TAB_LABELS: Record<PanelTab, string> = {
  checklist: 'Sjekkliste',
  findings: 'Avvik',
  summary: 'Sammendrag',
  signatures: 'Signaturer',
  history: 'Historikk',
}

const STATUS_LABEL: Record<InspectionRoundRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}

const HMS_LABELS: Record<HmsCategory, string> = {
  fysisk: 'Fysisk arbeidsmiljø',
  ergonomi: 'Ergonomi og tilrettelegging',
  kjemikalier: 'Kjemikalier og farlige stoffer',
  psykososialt: 'Psykososialt arbeidsmiljø',
  brann: 'Brann og rømning',
  maskiner: 'Maskiner og teknisk utstyr',
  annet: 'Annet',
}
const HMS_LAW: Partial<Record<HmsCategory, string>> = {
  fysisk: 'AML § 4-4',
  ergonomi: 'AML § 4-4',
  kjemikalier: 'Stoffkartotekforskriften',
  psykososialt: 'AML § 4-3',
  brann: 'IK-forskriften',
  maskiner: 'Arbeidsutstyrsforskriften',
}
const SEVERITY_LABELS = { low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk' }
const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-700',
}

const PANEL_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const PANEL_INPUT =
  'mt-1.5 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25'

// ── Checklist tab ─────────────────────────────────────────────────────────────

function ChecklistTab({
  round,
  checklistItems,
  inspection,
  onSwitchToFindings,
}: {
  round: InspectionRoundRow
  checklistItems: InspectionChecklistItem[]
  inspection: InspectionModuleState
  onSwitchToFindings: (itemKey: string) => void
}) {
  const roundItems = inspection.itemsByRoundId[round.id]
  const isRoundDetailLoading = roundItems === undefined

  const readOnly = round.status === 'signed'
  const isDraft = round.status === 'draft'
  const checklistTabItems = useMemo<ChecklistItem[]>(
    () =>
      checklistItems.map((item) => ({
        key: item.key,
        label: item.label,
        required: item.required,
        fieldType: (item.fieldType === 'photo_required' ? 'photo' : item.fieldType) as
          | ChecklistItem['fieldType']
          | undefined,
        category: item.hmsCategory ?? '__none__',
        categoryLabel: item.hmsCategory ? HMS_LABELS[item.hmsCategory] : 'Generelt',
        categoryLawRef: item.hmsCategory ? HMS_LAW[item.hmsCategory] : undefined,
        helpText: item.helpText,
        lawRef: item.lawRef,
      })),
    [checklistItems],
  )
  const checklistTabResponses = useMemo<ChecklistResponse[]>(
    () => (roundItems ?? []).map((item) => ({
      key: item.checklist_item_key,
      value: typeof item.response?.value === 'string' ? item.response.value : '',
      notes: item.notes,
      status:
        item.status === 'completed' || (typeof item.response?.value === 'string' && item.response.value !== '')
          ? 'completed'
          : 'pending',
    })),
    [roundItems],
  )

  const positionByKey = useMemo(() => {
    return checklistItems.reduce<Record<string, number>>((acc, item, index) => {
      acc[item.key] = index
      return acc
    }, {})
  }, [checklistItems])

  const handleSaveResponse = useCallback(
    async (key: string, value: string, notes: string | null) => {
      const checklistItem = checklistItems.find((item) => item.key === key)
      if (!checklistItem) return
      await inspection.upsertItemResponse({
        roundId: round.id,
        checklistItemKey: checklistItem.key,
        checklistItemLabel: checklistItem.label,
        position: positionByKey[checklistItem.key] ?? 0,
        response: { value },
        status: value ? 'completed' : 'pending',
        notes: notes ?? undefined,
      })
    },
    [checklistItems, inspection, positionByKey, round.id],
  )

  return (
    <div>
      {isRoundDetailLoading && (
        <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-neutral-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
          Laster sjekkliste…
        </div>
      )}

      {!isRoundDetailLoading && round.status === 'active' && (
        <div className="border-b border-neutral-200 bg-neutral-50/80 px-5 py-3">
          {round.gps_stamped_at == null ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-600">
                Registrer posisjon for vernerunden (valgfritt, krever nettlesertilgang til posisjon).
              </p>
              <button
                type="button"
                onClick={() => void inspection.stampRoundGps(round.id)}
                className="shrink-0 border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
              >
                📍 Stempel GPS-posisjon
              </button>
            </div>
          ) : (
            <p className="text-xs text-neutral-700">
              GPS:{' '}
              {round.gps_lat != null && round.gps_lon != null
                ? `${round.gps_lat.toFixed(4)}, ${round.gps_lon.toFixed(4)}`
                : '—'}
              {round.gps_accuracy_m != null && (
                <> — nøyaktighet {Math.round(round.gps_accuracy_m)}m</>
              )}
              {round.gps_stamped_at && (
                <>
                  {' '}
                  <span className="text-neutral-500">
                    ({new Date(round.gps_stamped_at).toLocaleString('nb-NO')})
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {!isRoundDetailLoading && checklistItems.length > 0 && (
        <ChecklistExecutionTab
          items={checklistTabItems}
          responses={checklistTabResponses}
          readOnly={readOnly}
          onSaveResponse={handleSaveResponse}
          activationBanner={
            isDraft ? (
              <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-4 border border-amber-200 bg-amber-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">Runden er i kladd-modus</p>
                  <p className="mt-0.5 text-xs text-amber-700">Aktiver runden for å begynne gjennomføringen.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void inspection.updateRoundSchedule({ roundId: round.id, status: 'active' })
                  }
                  className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                  style={{ backgroundColor: '#1a3d32' }}
                >
                  Aktiver runden
                </button>
              </div>
            ) : null
          }
          onReportIssue={
            readOnly
              ? undefined
              : (key) => {
                  onSwitchToFindings(key)
                }
          }
        />
      )}

      {checklistItems.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-neutral-400">
          Ingen sjekklistepunkter i malen.
        </p>
      )}
    </div>
  )
}

// ── Avvik (inspection findings) tab ───────────────────────────────────────────

function FindingsTab({
  round,
  inspection,
  prefillItemKey,
  checklistItems,
  onOpenDeviation,
}: {
  round: InspectionRoundRow
  inspection: InspectionModuleState
  prefillItemKey: string | null
  checklistItems: InspectionChecklistItem[]
  onOpenDeviation: (deviationId: string) => void
}) {
  const findings = inspection.findingsByRoundId[round.id] ?? []
  const items = useMemo(() => inspection.itemsByRoundId[round.id] ?? [], [inspection.itemsByRoundId, round.id])
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high')
  const [findingProb, setFindingProb] = useState<number | null>(null)
  const [findingCons, setFindingCons] = useState<number | null>(null)
  const [linkedItemKey, setLinkedItemKey] = useState(prefillItemKey ?? '')
  const [saving, setSaving] = useState(false)
  const [linkingDeviationId, setLinkingDeviationId] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      if (prefillItemKey) setLinkedItemKey(prefillItemKey)
    })
  }, [prefillItemKey])

  const linkedItemId = useMemo(() => {
    if (!linkedItemKey) return undefined
    return items.find((i) => i.checklist_item_key === linkedItemKey)?.id
  }, [linkedItemKey, items])

  function resetForm() {
    setEditingFindingId(null)
    setDescription('')
    setSeverity('high')
    setFindingProb(null)
    setFindingCons(null)
    setLinkedItemKey('')
  }

  function startEdit(f: (typeof findings)[0]) {
    setEditingFindingId(f.id)
    setDescription(f.description)
    setSeverity(f.severity)
    setFindingProb(f.risk_probability)
    setFindingCons(f.risk_consequence)
    const key = f.item_id ? items.find((i) => i.id === f.item_id)?.checklist_item_key ?? '' : ''
    setLinkedItemKey(key)
  }

  async function handleSave() {
    if (!description.trim()) return
    setSaving(true)
    if (editingFindingId) {
      await inspection.updateFinding({
        findingId: editingFindingId,
        description,
        severity,
        itemId: linkedItemId ?? null,
        riskProbability: findingProb,
        riskConsequence: findingCons,
      })
    } else {
      await inspection.addFinding({
        roundId: round.id,
        description,
        severity,
        itemId: linkedItemId,
        riskProbability: findingProb ?? undefined,
        riskConsequence: findingCons ?? undefined,
      })
    }
    resetForm()
    setSaving(false)
  }

  const readOnly = round.status === 'signed'

  return (
    <div className="divide-y divide-neutral-100">
      {!readOnly && (
        <div className="space-y-3 px-5 py-5">
          <p className={PANEL_FIELD_LABEL}>
            {editingFindingId ? 'Rediger avvik' : 'Registrer nytt avvik'}
          </p>
          <p className="text-xs text-neutral-500">
            Hvert avvik lagres i avviksmodulen og kan åpnes for full behandling, handlingsplan og historikk.
          </p>
          <div>
            <label className={PANEL_FIELD_LABEL} htmlFor="finding-desc">
              Beskrivelse
            </label>
            <textarea
              id="finding-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beskriv avviket…"
              className={`${PANEL_INPUT} resize-none`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={PANEL_FIELD_LABEL} htmlFor="finding-severity">
                Alvorlighetsgrad
              </label>
              <select
                id="finding-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as typeof severity)}
                className={PANEL_INPUT}
              >
                {(Object.keys(SEVERITY_LABELS) as (keyof typeof SEVERITY_LABELS)[]).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={PANEL_FIELD_LABEL} htmlFor="finding-item">
                Tilknyttet sjekklistepunkt (valgfri)
              </label>
              <select
                id="finding-item"
                value={linkedItemKey}
                onChange={(e) => setLinkedItemKey(e.target.value)}
                className={PANEL_INPUT}
              >
                <option value="">(Ingen)</option>
                {checklistItems.map((ci) => (
                  <option key={ci.key} value={ci.key}>
                    {ci.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className={PANEL_FIELD_LABEL}>Risiko (sannsynlighet × konsekvens)</p>
            <div className="mt-2 border border-neutral-200 bg-white p-3">
              <RiskMatrix
                probability={findingProb}
                consequence={findingCons}
                onChange={(p, c) => {
                  setFindingProb(p)
                  setFindingCons(c)
                }}
                size="sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!description.trim() || saving}
              onClick={() => void handleSave()}
              className="px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#1a3d32' }}
            >
              {saving ? 'Lagrer…' : editingFindingId ? 'Lagre endringer' : 'Registrer avvik'}
            </button>
            {(editingFindingId || description.trim()) && (
              <button
                type="button"
                disabled={saving}
                onClick={() => resetForm()}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Avbryt
              </button>
            )}
          </div>
        </div>
      )}

      {findings.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-400">Ingen avvik registrert ennå.</p>
      ) : (
        <div>
          {findings.map((f) => {
            const linkedLabel = f.item_id
              ? items.find((i) => i.id === f.item_id)?.checklist_item_label ?? null
              : null
            const riskScore = f.risk_score ?? riskScoreFromProbCons(f.risk_probability, f.risk_consequence)
            const showLegacyLinkBanner = !f.deviation_id && riskScore != null && riskScore >= 10

            return (
              <div key={f.id} className={`border-b border-neutral-100 border-l-4 px-5 py-4 last:border-b-0 ${
                f.severity === 'critical' ? 'border-l-red-500 bg-red-50/30' :
                f.severity === 'high' ? 'border-l-orange-400 bg-orange-50/20' :
                f.severity === 'medium' ? 'border-l-yellow-400' :
                'border-l-blue-300'
              }`}>
                {showLegacyLinkBanner && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <span>Risikoskår {riskScore} — koble til avvik i systemet</span>
                    <button
                      type="button"
                      disabled={linkingDeviationId === f.id}
                      className="shrink-0 bg-[#1a3d32] px-3 py-1 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                      onClick={async () => {
                        setLinkingDeviationId(f.id)
                        const id = await inspection.createDeviationFromFinding(f.id)
                        setLinkingDeviationId(null)
                        if (id) onOpenDeviation(id)
                      }}
                    >
                      {linkingDeviationId === f.id ? 'Oppretter…' : 'Opprett avvik'}
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm text-neutral-900">{f.description}</p>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_COLORS[f.severity]}`}
                    >
                      {SEVERITY_LABELS[f.severity]}
                    </span>
                    {riskScore != null && (
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${riskColorClass(riskScore)}`}
                      >
                        Risiko {riskScore} — {riskLabel(riskScore)}
                      </span>
                    )}
                    {!readOnly && (
                      <>
                        {f.deviation_id && (
                          <button
                            type="button"
                            onClick={() => onOpenDeviation(f.deviation_id!)}
                            className="border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-[#1a3d32] transition-colors hover:bg-neutral-50"
                          >
                            Åpne avvik
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(f)}
                          className="p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                          aria-label="Rediger avvik"
                          title="Rediger"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm('Slette dette avviket?')) return
                            void inspection.deleteFinding(f.id)
                            if (editingFindingId === f.id) resetForm()
                          }}
                          className="p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-600"
                          aria-label="Slett avvik"
                          title="Slett"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {linkedLabel && <p className="mt-1 text-xs text-neutral-500">Punkt: {linkedLabel}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Summary tab ───────────────────────────────────────────────────────────────

function SummaryTab({
  round,
  inspection,
}: {
  round: InspectionRoundRow
  inspection: InspectionModuleState
}) {
  const [summary, setSummary] = useState(round.summary ?? '')
  const [conductedBy, setConductedBy] = useState(round.conducted_by ?? '')
  const [conductedAt, setConductedAt] = useState(
    round.conducted_at ? new Date(round.conducted_at).toISOString().slice(0, 16) : '',
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const readOnly = round.status === 'signed'

  async function handleSave() {
    setSaving(true)
    await inspection.saveRoundSummary({
      roundId: round.id,
      summary,
      conductedBy: conductedBy || null,
      conductedAt: conductedAt || null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5 px-5 py-5">
      <div className="border border-[#1a3d32]/20 bg-[#f4f1ea] p-4">
        <p className="text-xs font-semibold text-[#1a3d32]">IK-forskriften § 5 — skriftlig protokoll</p>
        <p className="mt-1 text-xs text-neutral-500">
          Vernerunden skal dokumenteres skriftlig. Sammendraget arkiveres som del av HMS-protokollen.
        </p>
      </div>

      <div>
        <label className={PANEL_FIELD_LABEL} htmlFor="round-summary">
          Sammendrag <span className="text-red-500">*</span>
        </label>
        <textarea
          id="round-summary"
          rows={6}
          value={summary}
          readOnly={readOnly}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Beskriv gjennomføringen, observasjoner og tiltak…"
          className={`${PANEL_INPUT} resize-none`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={PANEL_FIELD_LABEL} htmlFor="conducted-by">Gjennomført av</label>
          <select
            id="conducted-by"
            value={conductedBy}
            disabled={readOnly}
            onChange={(e) => setConductedBy(e.target.value)}
            className={PANEL_INPUT}
          >
            <option value="">(Valgfri)</option>
            {inspection.assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={PANEL_FIELD_LABEL} htmlFor="conducted-at">Dato gjennomført</label>
          <input
            id="conducted-at"
            type="datetime-local"
            value={conductedAt}
            readOnly={readOnly}
            onChange={(e) => setConductedAt(e.target.value)}
            className={PANEL_INPUT}
          />
        </div>
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1a3d32' }}
        >
          {saving ? 'Lagrer…' : saved ? 'Lagret ✓' : 'Lagre sammendrag'}
        </button>
      )}
    </div>
  )
}

// ── Signatures tab ────────────────────────────────────────────────────────────

function SignaturesTab({
  round,
  inspection,
  checklistItems,
}: {
  round: InspectionRoundRow
  inspection: InspectionModuleState
  checklistItems: InspectionChecklistItem[]
}) {
  const [signing, setSigning] = useState<'manager' | 'deputy' | null>(null)

  const items = inspection.itemsByRoundId[round.id] ?? []
  const location = round.location_id
    ? inspection.locations.find((l) => l.id === round.location_id)
    : undefined
  const currentUserId = inspection.currentUserId
  const isManager = !!currentUserId && currentUserId === location?.manager_id
  const isDeputy = !!currentUserId && currentUserId === location?.safety_deputy_id
  const hasRoleRestriction = Boolean(location)
  const isAuthorizedSigner = isManager || isDeputy
  const unauthorizedTooltip = hasRoleRestriction && !isAuthorizedSigner ? 'Ikke autorisert' : undefined

  const requiredItems = checklistItems.filter((i) => i.required)
  const answeredRequiredCount = requiredItems.filter((i) => {
    const row = items.find((r) => r.checklist_item_key === i.key)
    return row?.status === 'completed' || (typeof row?.response?.value === 'string' && row.response.value !== '')
  }).length
  const allRequiredAnswered = answeredRequiredCount === requiredItems.length
  const hasSummary = (round.summary ?? '').trim().length > 0
  const isActive = round.status === 'active'
  const isSigned = round.status === 'signed'

  const userNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of inspection.assignableUsers) map.set(u.id, u.displayName)
    return map
  }, [inspection.assignableUsers])

  async function handleSign(role: 'manager' | 'deputy') {
    setSigning(role)
    await inspection.signRoundWithRole(round.id, role)
    setSigning(null)
  }

  const canSign = isActive && allRequiredAnswered && hasSummary
  const managerButtonDisabled = !canSign || signing !== null || (hasRoleRestriction && !isManager)
  const deputyButtonDisabled = !canSign || signing !== null || (hasRoleRestriction && !isDeputy)
  const managerButtonSolid = !hasRoleRestriction || isManager
  const deputyButtonSolid = !hasRoleRestriction || isDeputy

  return (
    <div className="space-y-5 px-5 py-5">
      {location && (
        <div
          className={`border px-4 py-3 text-xs font-medium ${
            isManager
              ? 'border-green-200 bg-green-50 text-green-800'
              : isDeputy
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {isManager
            ? 'Du er registrert som leder for denne lokasjonen'
            : isDeputy
              ? 'Du er registrert som verneombud for denne lokasjonen'
              : 'Du er ikke tilordnet en signaturrolle for denne lokasjonen. Kontakt administrator.'}
        </div>
      )}

      <div className="border border-[#1a3d32]/20 bg-[#f4f1ea] p-4">
        <p className="text-xs font-semibold text-[#1a3d32]">IK-forskriften § 5 — dobbel signering</p>
        <p className="mt-1 text-xs text-neutral-500">
          Vernerunden krever signatur fra både leder (AML § 2-1) og verneombud (AML § 6-2) for å være gyldig
          dokumentert i henhold til Internkontrollforskriften.
        </p>
      </div>

      {/* Pre-flight checks */}
      {!isSigned && (
        <div className="space-y-1.5">
          <p className={PANEL_FIELD_LABEL}>Sjekkliste før signering</p>
          {[
            { ok: isActive, label: 'Runden er aktiv (ikke kladd)' },
            {
              ok: allRequiredAnswered,
              label: `Alle påkrevde punkter besvart (${answeredRequiredCount}/${requiredItems.length})`,
            },
            { ok: hasSummary, label: 'Sammendrag er fylt ut' },
          ].map(({ ok, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              {ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 text-neutral-300" />
              )}
              <span className={ok ? 'text-neutral-700' : 'text-neutral-400'}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Manager */}
      <div className={`border-2 p-5 transition-all ${
        round.manager_signed_at
          ? 'border-green-300 bg-green-50'
          : canSign && (!hasRoleRestriction || isManager)
            ? 'border-[#1a3d32]/40 bg-white shadow-sm'
            : 'border-neutral-200 bg-white'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {round.manager_signed_at
              ? <CheckCircle2 className="h-7 w-7 shrink-0 text-green-500" />
              : <Circle className="h-7 w-7 shrink-0 text-neutral-300" />
            }
            <div>
              <p className="text-base font-semibold text-neutral-900">Leder</p>
              <p className="text-xs text-neutral-500">AML § 2-1 — arbeidsgiveransvar</p>
              {round.manager_signed_at ? (
                <p className="mt-0.5 text-xs font-medium text-green-700">
                  ✓ Signert {new Date(round.manager_signed_at).toLocaleDateString('nb-NO', { dateStyle: 'medium' })}
                  {round.manager_signed_by && userNameById.has(round.manager_signed_by)
                    ? ` av ${userNameById.get(round.manager_signed_by)}`
                    : ''}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-neutral-400">Venter på signatur</p>
              )}
            </div>
          </div>
          {!round.manager_signed_at && !isSigned && (
            <button
              type="button"
              disabled={managerButtonDisabled}
              title={unauthorizedTooltip}
              onClick={() => void handleSign('manager')}
              className={`shrink-0 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                managerButtonSolid
                  ? 'bg-[#1a3d32] text-white hover:bg-[#14312a]'
                  : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {signing === 'manager' ? 'Signerer…' : 'Signer som leder'}
            </button>
          )}
        </div>
      </div>

      {/* Deputy */}
      <div className={`border-2 p-5 transition-all ${
        round.deputy_signed_at
          ? 'border-green-300 bg-green-50'
          : canSign && (!hasRoleRestriction || isDeputy)
            ? 'border-[#1a3d32]/40 bg-white shadow-sm'
            : 'border-neutral-200 bg-white'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {round.deputy_signed_at
              ? <CheckCircle2 className="h-7 w-7 shrink-0 text-green-500" />
              : <Circle className="h-7 w-7 shrink-0 text-neutral-300" />
            }
            <div>
              <p className="text-base font-semibold text-neutral-900">Verneombud</p>
              <p className="text-xs text-neutral-500">AML § 6-2 — verneombudets representasjon</p>
              {round.deputy_signed_at ? (
                <p className="mt-0.5 text-xs font-medium text-green-700">
                  ✓ Signert {new Date(round.deputy_signed_at).toLocaleDateString('nb-NO', { dateStyle: 'medium' })}
                  {round.deputy_signed_by && userNameById.has(round.deputy_signed_by)
                    ? ` av ${userNameById.get(round.deputy_signed_by)}`
                    : ''}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-neutral-400">Venter på signatur</p>
              )}
            </div>
          </div>
          {!round.deputy_signed_at && !isSigned && (
            <button
              type="button"
              disabled={deputyButtonDisabled}
              title={unauthorizedTooltip}
              onClick={() => void handleSign('deputy')}
              className={`shrink-0 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                deputyButtonSolid
                  ? 'bg-[#1a3d32] text-white hover:bg-[#14312a]'
                  : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {signing === 'deputy' ? 'Signerer…' : 'Signer som verneombud'}
            </button>
          )}
        </div>
      </div>

      {isSigned && (
        <div className="border border-green-200 bg-green-50 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
          <p className="text-sm font-semibold text-green-800">Runden er fullstendig signert</p>
          <p className="mt-1 text-xs text-green-600">
            Arkivert i henhold til Bokføringsloven § 13 (oppbevaringsplikt 5 år).
          </p>
        </div>
      )}
    </div>
  )
}

// ── Full-page round execution ─────────────────────────────────────────────────

export function InspectionRoundPage({ supabase }: { supabase: SupabaseClient | null }) {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const inspection = useInspectionModule({ supabase })
  const { load, loadRoundDetail } = inspection

  const [activeTab, setActiveTab] = useState<PanelTab>('checklist')
  const [findingPrefillKey, setFindingPrefillKey] = useState<string | null>(null)
  const [selectedDeviationId, setSelectedDeviationId] = useState<string | null>(null)
  const [detailStarted, setDetailStarted] = useState(false)

  useEffect(() => {
    if (!roundId) return
    let cancelled = false
    void (async () => {
      await load()
      if (cancelled) return
      await loadRoundDetail(roundId)
      if (!cancelled) setDetailStarted(true)
    })()
    return () => {
      cancelled = true
    }
  }, [roundId, load, loadRoundDetail])

  const round = useMemo(
    () => (roundId ? inspection.rounds.find((r) => r.id === roundId) ?? null : null),
    [inspection.rounds, roundId],
  )

  const template = round ? inspection.templates.find((t) => t.id === round.template_id) : undefined
  const checklistItems = useMemo(
    () => (template ? parseChecklistItems(template.checklist_definition) : []),
    [template],
  )

  const findings = round ? inspection.findingsByRoundId[round.id] ?? [] : []
  const critCount = findings.filter((f) => f.severity === 'critical').length
  const itemsAnswered = round
    ? (inspection.itemsByRoundId[round.id] ?? []).filter((i) => i.status === 'completed').length
    : 0

  const locationName = round?.location_id
    ? inspection.locations.find((l) => l.id === round.location_id)?.name
    : null
  const scheduledLabel = round?.scheduled_for
    ? new Date(round.scheduled_for).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
    : '—'

  const assignedName = round?.assigned_to
    ? inspection.assignableUsers.find((u) => u.id === round.assigned_to)?.displayName ?? null
    : null

  const headerSubtitle = useMemo(() => {
    if (!round) return ''
    const parts: string[] = []
    parts.push(template?.name ? `Mal: ${template.name}` : 'Mal: —')
    parts.push(locationName ? `Lokasjon: ${locationName}` : 'Lokasjon: —')
    parts.push(assignedName ? `Ansvarlig: ${assignedName}` : 'Ansvarlig: —')
    parts.push(`Planlagt: ${scheduledLabel}`)
    parts.push(`${itemsAnswered}/${checklistItems.length} punkter besvart`)
    if (critCount > 0) parts.push(`${critCount} kritiske funn`)
    return parts.join(' · ')
  }, [
    round,
    template?.name,
    locationName,
    assignedName,
    scheduledLabel,
    itemsAnswered,
    checklistItems.length,
    critCount,
  ])

  const hubMenuItems: HubMenu1Item[] = useMemo(() => {
    if (!round) return []
    const f = inspection.findingsByRoundId[round.id] ?? []
    const answered = (inspection.itemsByRoundId[round.id] ?? []).filter((i) => i.status === 'completed').length
    const tmpl = inspection.templates.find((t) => t.id === round.template_id)
    const nItems = tmpl ? parseChecklistItems(tmpl.checklist_definition).length : 0
    return [
      {
        key: 'checklist',
        label: nItems > 0 ? `${TAB_LABELS.checklist} (${answered}/${nItems})` : TAB_LABELS.checklist,
        icon: ClipboardList,
        active: activeTab === 'checklist',
        onClick: () => setActiveTab('checklist'),
      },
      {
        key: 'findings',
        label: TAB_LABELS.findings,
        icon: AlertTriangle,
        active: activeTab === 'findings',
        badgeCount: f.length > 0 ? f.length : undefined,
        onClick: () => setActiveTab('findings'),
      },
      {
        key: 'summary',
        label: TAB_LABELS.summary,
        icon: FileText,
        active: activeTab === 'summary',
        onClick: () => setActiveTab('summary'),
      },
      {
        key: 'signatures',
        label: TAB_LABELS.signatures,
        icon: PenLine,
        active: activeTab === 'signatures',
        onClick: () => setActiveTab('signatures'),
      },
      {
        key: 'history',
        label: TAB_LABELS.history,
        icon: History,
        active: activeTab === 'history',
        onClick: () => setActiveTab('history'),
      },
    ]
  }, [round, inspection.findingsByRoundId, inspection.itemsByRoundId, inspection.templates, activeTab])

  const showSpinner = !round && (!detailStarted || inspection.loading)
  const showNotFound = detailStarted && !inspection.loading && roundId && !round

  if (!roundId) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-neutral-600"
        style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}
      >
        Mangler runde-ID.
      </div>
    )
  }

  if (showSpinner) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm text-neutral-600">Laster runde…</p>
      </div>
    )
  }

  if (showNotFound) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-4"
        style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}
      >
        <p className="text-lg font-semibold text-neutral-900">Runde ikke funnet</p>
        <button
          type="button"
          onClick={() => navigate('/inspection-module')}
          className="border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
        >
          ← Tilbake til inspeksjonsrunder
        </button>
      </div>
    )
  }

  if (!round) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm text-neutral-600">Laster runde…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}>
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-[#F9F7F2]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-4 md:px-8">
          <WorkplacePageHeading1
            breadcrumb={[
              { label: 'HMS' },
              { label: 'Inspeksjonsrunder', to: '/inspection-module' },
              { label: round.title },
            ]}
            title={round.title}
            description={<p className="max-w-4xl text-xs leading-relaxed text-neutral-600">{headerSubtitle}</p>}
            headerActions={
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                  round.status === 'signed'
                    ? 'border border-green-200 bg-green-100 text-green-800'
                    : round.status === 'active'
                      ? 'border border-blue-200 bg-blue-100 text-blue-800'
                      : 'border border-neutral-200 bg-neutral-100 text-neutral-700'
                }`}>
                  {STATUS_LABEL[round.status]}
                </span>
                <Link
                  to="/inspection-module/admin"
                  className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50"
                >
                  <Settings className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </div>
            }
            menu={<HubMenu1Bar ariaLabel="Runde-seksjoner" items={hubMenuItems} />}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
        {activeTab === 'checklist' && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            {critCount > 0 && (
              <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-5 py-2">
                <span className="text-xs font-semibold text-red-700">⚠ {critCount} kritiske funn registrert</span>
              </div>
            )}
            <ChecklistTab
              round={round}
              checklistItems={checklistItems}
              inspection={inspection}
              onSwitchToFindings={(key) => {
                setFindingPrefillKey(key)
                setActiveTab('findings')
              }}
            />
          </div>
        )}

        {activeTab === 'findings' && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            {findings.length > 0 && (
              <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-2">
                <span className="text-xs text-neutral-500">{findings.length} avvik registrert · tilknytt sjekklistepunkt ved behov</span>
                {critCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">{critCount} kritisk</span>
                )}
              </div>
            )}
            <FindingsTab
              key={`${round.id}-${findingPrefillKey ?? ''}`}
              round={round}
              inspection={inspection}
              prefillItemKey={findingPrefillKey}
              checklistItems={checklistItems}
              onOpenDeviation={(id) => setSelectedDeviationId(id)}
            />
          </div>
        )}

        {activeTab === 'summary' && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <SummaryTab key={`${round.id}-${round.updated_at}`} round={round} inspection={inspection} />
          </div>
        )}

        {activeTab === 'signatures' && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <SignaturesTab round={round} inspection={inspection} checklistItems={checklistItems} />
          </div>
        )}

        {activeTab === 'history' && supabase && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-2">
              <span className="text-xs text-neutral-500">Revisjonsspor — alle endringer loggført for denne runden</span>
            </div>
            <HseAuditLogViewer supabase={supabase} recordId={round.id} tableName="inspection_rounds" />
          </div>
        )}
      </div>

      {selectedDeviationId && supabase ? (
        <DeviationPanel
          deviationId={selectedDeviationId}
          supabase={supabase}
          onClose={() => setSelectedDeviationId(null)}
          onUpdated={() => {
            void inspection.loadRoundDetail(round.id)
          }}
        />
      ) : null}
    </div>
  )
}
