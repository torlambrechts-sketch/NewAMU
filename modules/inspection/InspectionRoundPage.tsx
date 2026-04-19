import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../src/lib/supabaseClient'
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
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import type { HmsCategory, InspectionChecklistItem, InspectionLocationRow, InspectionRoundRow } from './types'
import { parseChecklistItems } from './schema'
import { useInspectionModule, type InspectionModuleState } from './useInspectionModule'
import { ChecklistExecutionTab } from '../../src/components/checklist/ChecklistExecutionTab'
import type { ChecklistItem, ChecklistResponse } from '../../src/components/checklist/types'
import { DeviationPanel } from '../../src/components/hse/DeviationPanel'
import { HseAuditLogViewer } from '../../src/components/hse/HseAuditLogViewer'
import { RiskMatrix, riskLabel, riskScoreFromProbCons } from '../../src/components/hse/RiskMatrix'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { StandardInput, standardFieldClassName } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'

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

function severityBadgeVariant(severity: keyof typeof SEVERITY_LABELS): BadgeVariant {
  switch (severity) {
    case 'low':
      return 'info'
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

function riskScoreBadgeVariant(score: number): BadgeVariant {
  if (score <= 4) return 'success'
  if (score <= 9) return 'medium'
  if (score <= 14) return 'high'
  return 'critical'
}

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
              <Button
                type="button"
                variant="secondary"
                onClick={() => void inspection.stampRoundGps(round.id)}
                className="shrink-0 px-3 py-1.5 text-xs text-neutral-800"
              >
                📍 Stempel GPS-posisjon
              </Button>
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
              <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">Runden er i kladd-modus</p>
                  <p className="mt-0.5 text-xs text-amber-700">Aktiver runden for å begynne gjennomføringen.</p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() =>
                    void inspection.updateRoundSchedule({ roundId: round.id, status: 'active' })
                  }
                  className="shrink-0 px-3 py-1.5 text-xs"
                >
                  Aktiver runden
                </Button>
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
        <div className="border-b border-neutral-100 bg-white px-0 py-0">
          <p className={`${WPSTD_FORM_LEAD} border-b border-neutral-200 px-4 py-3 md:px-5`}>
            {editingFindingId ? 'Rediger avvik' : 'Registrer nytt avvik'} — hvert avvik lagres i avviksmodulen.
          </p>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="finding-desc">
              Beskrivelse
            </label>
            <StandardTextarea
              id="finding-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beskriv avviket…"
              className="resize-none"
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="finding-severity">
              Alvorlighetsgrad
            </label>
            <SearchableSelect
              value={severity}
              options={(Object.keys(SEVERITY_LABELS) as (keyof typeof SEVERITY_LABELS)[]).map((s) => ({
                value: s,
                label: SEVERITY_LABELS[s],
              }))}
              onChange={(v) => setSeverity(v as typeof severity)}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="finding-item">
              Tilknyttet sjekklistepunkt (valgfri)
            </label>
            <SearchableSelect
              value={linkedItemKey}
              options={[
                { value: '', label: '(Ingen)' },
                ...checklistItems.map((ci) => ({ value: ci.key, label: ci.label })),
              ]}
              onChange={(v) => setLinkedItemKey(v)}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Risiko (sannsynlighet × konsekvens)</span>
            <div className="rounded-md border border-neutral-200 bg-white p-3">
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
          <div className="flex flex-wrap gap-2 border-t border-neutral-200 px-4 py-4 md:px-5">
            <Button
              type="button"
              variant="primary"
              disabled={!description.trim() || saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Lagrer…' : editingFindingId ? 'Lagre endringer' : 'Registrer avvik'}
            </Button>
            {(editingFindingId || description.trim()) && (
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => resetForm()}
                className="font-medium"
              >
                Avbryt
              </Button>
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
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <span>Risikoskår {riskScore} — koble til avvik i systemet</span>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={linkingDeviationId === f.id}
                      className="shrink-0 px-3 py-1 text-xs disabled:opacity-50"
                      onClick={async () => {
                        setLinkingDeviationId(f.id)
                        const id = await inspection.createDeviationFromFinding(f.id)
                        setLinkingDeviationId(null)
                        if (id) onOpenDeviation(id)
                      }}
                    >
                      {linkingDeviationId === f.id ? 'Oppretter…' : 'Opprett avvik'}
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm text-neutral-900">{f.description}</p>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Badge variant={severityBadgeVariant(f.severity)}>
                      {SEVERITY_LABELS[f.severity]}
                    </Badge>
                    {riskScore != null && (
                      <Badge variant={riskScoreBadgeVariant(riskScore)}>
                        Risiko {riskScore} — {riskLabel(riskScore)}
                      </Badge>
                    )}
                    {!readOnly && (
                      <>
                        {f.deviation_id && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => onOpenDeviation(f.deviation_id!)}
                            className="border-neutral-200 px-2 py-1 text-xs font-medium text-[#1a3d32]"
                          >
                            Åpne avvik
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => startEdit(f)}
                          className="border-transparent bg-transparent p-1 font-normal text-neutral-500 shadow-none hover:bg-neutral-100 hover:text-neutral-900"
                          aria-label="Rediger avvik"
                          title="Rediger"
                          icon={<Pencil className="h-4 w-4" />}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (!window.confirm('Slette dette avviket?')) return
                            void inspection.deleteFinding(f.id)
                            if (editingFindingId === f.id) resetForm()
                          }}
                          className="border-transparent bg-transparent p-1 font-normal text-neutral-400 shadow-none hover:bg-neutral-100 hover:text-red-600"
                          aria-label="Slett avvik"
                          title="Slett"
                          icon={<Trash2 className="h-4 w-4" />}
                        />
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
    <div className="border-b border-neutral-100 bg-white">
      <div className="border-b border-[#1a3d32]/20 bg-[#f4f1ea] px-4 py-4 md:px-5">
        <p className="text-xs font-semibold text-[#1a3d32]">IK-forskriften § 5 — skriftlig protokoll</p>
        <p className={`${WPSTD_FORM_LEAD} mt-1`}>
          Vernerunden skal dokumenteres skriftlig. Sammendraget arkiveres som del av HMS-protokollen.
        </p>
      </div>

      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="round-summary">
          Sammendrag <span className="text-red-500">*</span>
        </label>
        <StandardTextarea
          id="round-summary"
          rows={6}
          value={summary}
          readOnly={readOnly}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Beskriv gjennomføringen, observasjoner og tiltak…"
          className="resize-none"
        />
      </div>

      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="conducted-by">
          Gjennomført av
        </label>
        {readOnly ? (
          <select id="conducted-by" value={conductedBy} disabled className={standardFieldClassName}>
            <option value="">(Valgfri)</option>
            {inspection.assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        ) : (
          <SearchableSelect
            value={conductedBy}
            options={[
              { value: '', label: '(Valgfri)' },
              ...inspection.assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
            ]}
            onChange={(v) => setConductedBy(v)}
          />
        )}
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="conducted-at">
          Dato gjennomført
        </label>
        <StandardInput
          id="conducted-at"
          type="datetime-local"
          value={conductedAt}
          readOnly={readOnly}
          onChange={(e) => setConductedAt(e.target.value)}
        />
      </div>

      {!readOnly && (
        <div className="border-t border-neutral-200 px-4 py-4 md:px-5">
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? 'Lagrer…' : saved ? 'Lagret ✓' : 'Lagre sammendrag'}
          </Button>
        </div>
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
          className={`rounded-md border px-4 py-3 text-xs font-medium ${
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

      <div className="rounded-md border border-[#1a3d32]/20 bg-[#f4f1ea] p-4">
        <p className="text-xs font-semibold text-[#1a3d32]">IK-forskriften § 5 — dobbel signering</p>
        <p className="mt-1 text-xs text-neutral-500">
          Vernerunden krever signatur fra både leder (AML § 2-1) og verneombud (AML § 6-2) for å være gyldig
          dokumentert i henhold til Internkontrollforskriften.
        </p>
      </div>

      {/* Pre-flight checks */}
      {!isSigned && (
        <div className="space-y-1.5">
          <p className={WPSTD_FORM_FIELD_LABEL}>Sjekkliste før signering</p>
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
      <div className={`rounded-md border-2 p-5 transition-all ${
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
            <Button
              type="button"
              variant={managerButtonSolid ? 'primary' : 'secondary'}
              disabled={managerButtonDisabled}
              title={unauthorizedTooltip}
              onClick={() => void handleSign('manager')}
              className="shrink-0 disabled:opacity-40"
            >
              {signing === 'manager' ? 'Signerer…' : 'Signer som leder'}
            </Button>
          )}
        </div>
      </div>

      {/* Deputy */}
      <div className={`rounded-md border-2 p-5 transition-all ${
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
            <Button
              type="button"
              variant={deputyButtonSolid ? 'primary' : 'secondary'}
              disabled={deputyButtonDisabled}
              title={unauthorizedTooltip}
              onClick={() => void handleSign('deputy')}
              className="shrink-0 disabled:opacity-40"
            >
              {signing === 'deputy' ? 'Signerer…' : 'Signer som verneombud'}
            </Button>
          )}
        </div>
      </div>

      {isSigned && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center">
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

// ── Round core fields (Workplace Standard single column) ─────────────────────

function RoundBasicsForm({
  round,
  locations,
  assignableUsers,
  readOnly,
  onUpdated,
}: {
  round: InspectionRoundRow
  locations: InspectionLocationRow[]
  assignableUsers: { id: string; displayName: string }[]
  readOnly: boolean
  onUpdated: () => void | Promise<void>
}) {
  const scheduledLocal = useMemo(() => {
    if (!round.scheduled_for) return ''
    const d = new Date(round.scheduled_for)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [round.scheduled_for])

  const handleUpdate = async (patch: Partial<InspectionRoundRow>) => {
    if (!supabase) return
    const { error: upErr } = await supabase.from('inspection_rounds').update(patch).eq('id', round.id)
    if (upErr) {
      console.error(upErr.message)
      return
    }
    await Promise.resolve(onUpdated())
  }

  const statusOptions = [
    { value: 'draft', label: 'Kladd' },
    { value: 'active', label: 'Aktiv' },
    { value: 'signed', label: 'Signert' },
  ]

  const locationOptions = [
    { value: '', label: '(Ingen)' },
    ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
  ]

  const assignedOptions = [
    { value: '', label: '(Ingen)' },
    ...assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
  ]

  return (
    <div className="border-y border-neutral-200 bg-white">
      <p className={`${WPSTD_FORM_LEAD} border-b border-neutral-200 px-4 py-3 md:px-5`}>
        Grunnleggende opplysninger om runden. Endringer lagres til databasen ved hver endring.
      </p>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="round-basics-title">
          Tittel
        </label>
        <StandardInput
          id="round-basics-title"
          type="text"
          value={round.title}
          readOnly={readOnly}
          onChange={(e) => void handleUpdate({ title: e.target.value })}
        />
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="round-basics-status">
          Status
        </label>
        {readOnly ? (
          <select value={round.status} disabled className={standardFieldClassName}>
            <option value="draft">Kladd</option>
            <option value="active">Aktiv</option>
            <option value="signed">Signert</option>
          </select>
        ) : (
          <SearchableSelect
            value={round.status}
            options={statusOptions}
            onChange={(v) => void handleUpdate({ status: v as InspectionRoundRow['status'] })}
          />
        )}
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="round-basics-location">
          Lokasjon
        </label>
        {readOnly ? (
          <select value={round.location_id ?? ''} disabled className={standardFieldClassName}>
            <option value="">(Ingen)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        ) : (
          <SearchableSelect
            value={round.location_id ?? ''}
            options={locationOptions}
            placeholder="Velg lokasjon"
            onChange={(v) => void handleUpdate({ location_id: v ? v : null })}
          />
        )}
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="round-basics-assigned">
          Ansvarlig
        </label>
        {readOnly ? (
          <select value={round.assigned_to ?? ''} disabled className={standardFieldClassName}>
            <option value="">(Ingen)</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        ) : (
          <SearchableSelect
            value={round.assigned_to ?? ''}
            options={assignedOptions}
            placeholder="Velg ansvarlig"
            onChange={(v) => void handleUpdate({ assigned_to: v ? v : null })}
          />
        )}
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="round-basics-scheduled">
          Planlagt tidspunkt
        </label>
        <StandardInput
          id="round-basics-scheduled"
          type="datetime-local"
          value={scheduledLocal}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value
            void handleUpdate({
              scheduled_for: v ? new Date(v).toISOString() : null,
            })
          }}
        />
      </div>
    </div>
  )
}

// ── Full-page round execution ─────────────────────────────────────────────────

export function InspectionRoundPage() {
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
  }, [round, template, locationName, assignedName, scheduledLabel, itemsAnswered, checklistItems.length, critCount])

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
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F2] text-sm text-neutral-600">
        Mangler runde-ID.
      </div>
    )
  }

  if (showSpinner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F9F7F2]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm text-neutral-600">Laster runde…</p>
      </div>
    )
  }

  if (showNotFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F7F2] px-4">
        <p className="text-lg font-semibold text-neutral-900">Runde ikke funnet</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/inspection-module')}
          className="font-medium text-neutral-800"
        >
          ← Tilbake til inspeksjonsrunder
        </Button>
      </div>
    )
  }

  if (!round) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F9F7F2]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm text-neutral-600">Laster runde…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
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
                <Badge
                  variant={
                    round.status === 'signed' ? 'signed' : round.status === 'active' ? 'active' : 'draft'
                  }
                  className="px-3 py-1 text-xs"
                >
                  {STATUS_LABEL[round.status]}
                </Badge>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-2 font-normal text-neutral-600"
                  icon={<Settings className="w-4 h-4" aria-hidden />}
                  onClick={() => navigate('/inspection-module/admin')}
                >
                  <span className="hidden sm:inline">Admin</span>
                </Button>
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
                <Badge variant="critical" className="text-xs font-semibold shadow-none">
                  ⚠ {critCount} kritiske funn registrert
                </Badge>
              </div>
            )}
            <RoundBasicsForm
              round={round}
              locations={inspection.locations}
              assignableUsers={inspection.assignableUsers}
              readOnly={round.status === 'signed'}
              onUpdated={() => void inspection.loadRoundDetail(round.id)}
            />
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
                  <Badge variant="critical" className="border-transparent shadow-none">
                    {critCount} kritisk
                  </Badge>
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

        {activeTab === 'history' && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-2">
              <span className="text-xs text-neutral-500">Revisjonsspor — alle endringer loggført for denne runden</span>
            </div>
            <HseAuditLogViewer supabase={supabase} recordId={round.id} tableName="inspection_rounds" />
          </div>
        )}
      </div>

      {selectedDeviationId ? (
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
