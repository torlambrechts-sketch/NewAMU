import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../src/lib/supabaseClient'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Info,
  PenLine,
  Settings,
  Trash2,
} from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { ModulePreflightChecklist } from '../../src/components/module/ModulePreflightChecklist'
import { ModuleSignatureCard } from '../../src/components/module/ModuleSignatureCard'
import { ModuleInformationCard } from '../../src/components/module/ModuleInformationCard'
import { ModuleLegalBanner } from '../../src/components/module/ModuleLegalBanner'
import type { InspectionChecklistItem, InspectionLocationRow, InspectionRoundRow } from './types'
import { parseChecklistItems } from './schema'
import { useInspectionModule, type InspectionModuleState } from './useInspectionModule'
import { InspectionChecklistTable } from './components/InspectionChecklistTable'
import { InspectionFindingsTable } from './components/InspectionFindingsTable'
import { DeviationPanel } from '../../src/components/hse/DeviationPanel'
import { HseAuditLogViewer } from '../../src/components/hse/HseAuditLogViewer'
import { Badge } from '../../src/components/ui/Badge'
import { RiskMatrix } from '../../src/components/hse/RiskMatrix'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'

type PanelTab = 'information' | 'checklist' | 'findings' | 'summary' | 'signatures' | 'history'

const TAB_LABELS: Record<PanelTab, string> = {
  information: 'Informasjon',
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

const SEVERITY_LABELS = { low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk' }

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

  const gpsExtras =
    round.status === 'active' ? (
      round.gps_stamped_at == null ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void inspection.stampRoundGps(round.id)}
          className="shrink-0 text-neutral-800"
        >
          📍 Stempel GPS
        </Button>
      ) : (
        <p className="text-xs text-neutral-600">
          GPS:{' '}
          {round.gps_lat != null && round.gps_lon != null
            ? `${round.gps_lat.toFixed(4)}, ${round.gps_lon.toFixed(4)}`
            : '—'}
          {round.gps_accuracy_m != null && <> · ±{Math.round(round.gps_accuracy_m)}m</>}
        </p>
      )
    ) : null

  const activationBanner = isDraft ? (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-3">
      <div>
        <p className="text-sm font-medium text-amber-800">Runden er i kladd-modus</p>
        <p className="mt-0.5 text-xs text-amber-700">Aktiver runden for å begynne gjennomføringen.</p>
      </div>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => void inspection.updateRoundSchedule({ roundId: round.id, status: 'active' })}
        className="shrink-0"
      >
        Aktiver runden
      </Button>
    </div>
  ) : null

  return (
    <InspectionChecklistTable
      checklistItems={checklistItems}
      roundItems={isRoundDetailLoading ? undefined : roundItems}
      readOnly={readOnly}
      onSaveResponse={handleSaveResponse}
      onRegisterFinding={(key) => onSwitchToFindings(key)}
      activationBanner={activationBanner}
      toolbarExtras={gpsExtras}
    />
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
  const findings = useMemo(
    () => inspection.findingsByRoundId[round.id] ?? [],
    [inspection.findingsByRoundId, round.id],
  )
  const items = useMemo(() => inspection.itemsByRoundId[round.id] ?? [], [inspection.itemsByRoundId, round.id])
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high')
  const [findingProb, setFindingProb] = useState<number | null>(null)
  const [findingCons, setFindingCons] = useState<number | null>(null)
  const [linkedItemKey, setLinkedItemKey] = useState(prefillItemKey ?? '')
  const [saving, setSaving] = useState(false)
  const [linkingDeviationId, setLinkingDeviationId] = useState<string | null>(null)
  const [findingPanelOpen, setFindingPanelOpen] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      if (prefillItemKey) {
        setLinkedItemKey(prefillItemKey)
        setFindingPanelOpen(true)
      }
    })
  }, [prefillItemKey])

  const linkedItemId = useMemo(() => {
    if (!linkedItemKey) return undefined
    return items.find((i) => i.checklist_item_key === linkedItemKey)?.id
  }, [linkedItemKey, items])

  const kpiItems = useMemo(() => {
    const total = findings.length
    const critical = findings.filter((f) => f.severity === 'critical').length
    const high = findings.filter((f) => f.severity === 'high').length
    const linked = findings.filter((f) => !!f.deviation_id).length
    return [
      { big: String(total), title: 'Totalt avvik', sub: 'Registrert i runden' },
      { big: String(critical), title: 'Kritiske', sub: 'Krever umiddelbar oppfølging' },
      { big: String(high), title: 'Høy alvorlighet', sub: 'Høy risiko — følg opp' },
      { big: String(linked), title: 'Koblet til avvik', sub: 'Registrert i avviksmodulen' },
    ]
  }, [findings])

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
    setFindingPanelOpen(true)
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
    setFindingPanelOpen(false)
    setSaving(false)
  }

  const readOnly = round.status === 'signed'

  return (
    <div className="flex flex-col space-y-6">
      {!readOnly && (
        <SlidePanel
          open={findingPanelOpen}
          onClose={() => {
            resetForm()
            setFindingPanelOpen(false)
          }}
          titleId="inspection-finding-panel-title"
          title={editingFindingId ? 'Rediger avvik' : 'Registrer nytt avvik'}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  resetForm()
                  setFindingPanelOpen(false)
                }}
                className="font-medium"
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!description.trim() || saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Lagrer…' : editingFindingId ? 'Lagre endringer' : 'Registrer avvik'}
              </Button>
            </div>
          }
        >
          <p className={`${WPSTD_FORM_LEAD} mb-6`}>
            Hvert avvik lagres i avviksmodulen. Listen bak panelet forblir synlig.
          </p>
          <div className="border border-neutral-200/90 bg-white">
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
            {editingFindingId ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 px-4 py-3">
                {findings.find((x) => x.id === editingFindingId)?.deviation_id ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const devId = findings.find((x) => x.id === editingFindingId)?.deviation_id
                      if (devId) onOpenDeviation(devId)
                    }}
                  >
                    Åpne avvik
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    if (!window.confirm('Slette dette avviket?')) return
                    void inspection.deleteFinding(editingFindingId)
                    resetForm()
                    setFindingPanelOpen(false)
                  }}
                >
                  Slett avvik
                </Button>
              </div>
            ) : null}
          </div>
        </SlidePanel>
      )}

      <InspectionFindingsTable
        findings={findings}
        checklistItems={checklistItems}
        roundItems={items}
        readOnly={readOnly}
        linkingDeviationId={linkingDeviationId}
        kpiItems={kpiItems}
        onEditFinding={startEdit}
        onOpenDeviation={onOpenDeviation}
        onCreateDeviationFromFinding={async (findingId) => {
          setLinkingDeviationId(findingId)
          const id = await inspection.createDeviationFromFinding(findingId)
          setLinkingDeviationId(null)
          if (id) onOpenDeviation(id)
        }}
        onAddNew={() => {
          resetForm()
          setFindingPanelOpen(true)
        }}
      />
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
      <ComplianceBanner
        title="IK-forskriften § 5 — skriftlig protokoll"
        className="border-b border-[#1a3d32]/20"
      >
        Vernerunden skal dokumenteres skriftlig. Sammendraget arkiveres som del av HMS-protokollen.
      </ComplianceBanner>

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
        <SearchableSelect
          value={conductedBy}
          options={[
            { value: '', label: '(Valgfri)' },
            ...inspection.assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
          ]}
          onChange={(v) => setConductedBy(v)}
          disabled={readOnly}
        />
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

  const preflightItems = [
    { ok: isActive, label: 'Runden er aktiv (ikke kladd)' },
    {
      ok: allRequiredAnswered,
      label: `Alle påkrevde punkter besvart (${answeredRequiredCount}/${requiredItems.length})`,
    },
    { ok: hasSummary, label: 'Sammendrag er fylt ut' },
  ]

  type Role = 'manager' | 'deputy'
  const roles: { role: Role; title: string; lawReference: string; userIsRole: boolean }[] = [
    { role: 'manager', title: 'Leder', lawReference: 'AML § 2-1 — arbeidsgiveransvar', userIsRole: isManager },
    { role: 'deputy', title: 'Verneombud', lawReference: 'AML § 6-2 — verneombudets representasjon', userIsRole: isDeputy },
  ]

  return (
    <div className="flex flex-col">
      <ComplianceBanner title="IK-forskriften § 5 — dobbel signering" className="border-b border-[#1a3d32]/20">
        Vernerunden krever signatur fra både leder (AML § 2-1) og verneombud (AML § 6-2) for å være gyldig
        dokumentert i henhold til Internkontrollforskriften.
      </ComplianceBanner>

      <div className="space-y-5 bg-white p-5">
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

        {!isSigned && <ModulePreflightChecklist items={preflightItems} />}

        {roles.map(({ role, title, lawReference, userIsRole }) => {
          const signedAt = role === 'manager' ? round.manager_signed_at : round.deputy_signed_at
          const signedBy = role === 'manager' ? round.manager_signed_by : round.deputy_signed_by
          const byName = signedBy && userNameById.has(signedBy) ? userNameById.get(signedBy)! : null
          const primary = !hasRoleRestriction || userIsRole
          const disabled = !canSign || signing !== null || (hasRoleRestriction && !userIsRole)
          return (
            <ModuleSignatureCard
              key={role}
              title={title}
              lawReference={lawReference}
              signed={signedAt ? { at: signedAt, byName } : null}
              buttonLabel={`Signer som ${title.toLowerCase()}`}
              variant={primary ? 'primary' : 'secondary'}
              disabled={disabled}
              disabledTitle={unauthorizedTooltip}
              busy={signing === role}
              hideButton={isSigned}
              onSign={() => handleSign(role)}
            />
          )
        })}

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
    </div>
  )
}

// ── Informasjon-kort (generell info om runden) ────────────────────────────────

function RoundInformationCard({
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
    <ModuleInformationCard
      title="Informasjon om vernerunden"
      description={
        <p>
          Generell informasjon om denne inspeksjonsrunden — kan redigeres så lenge runden er i
          kladd- eller aktiv-status.
        </p>
      }
      rows={[
        {
          id: 'title',
          label: 'Tittel',
          htmlFor: 'round-basics-title',
          required: true,
          value: (
            <StandardInput
              id="round-basics-title"
              type="text"
              value={round.title}
              readOnly={readOnly}
              onChange={(e) => void handleUpdate({ title: e.target.value })}
            />
          ),
        },
        {
          id: 'status',
          label: 'Status',
          htmlFor: 'round-basics-status',
          value: (
            <SearchableSelect
              value={round.status}
              options={statusOptions}
              onChange={(v) => void handleUpdate({ status: v as InspectionRoundRow['status'] })}
              disabled={readOnly}
            />
          ),
        },
        {
          id: 'location',
          label: 'Lokasjon',
          htmlFor: 'round-basics-location',
          value: (
            <SearchableSelect
              value={round.location_id ?? ''}
              options={locationOptions}
              placeholder="Velg lokasjon"
              onChange={(v) => void handleUpdate({ location_id: v || null })}
              disabled={readOnly}
            />
          ),
        },
        {
          id: 'assigned',
          label: 'Ansvarlig',
          htmlFor: 'round-basics-assigned',
          value: (
            <SearchableSelect
              value={round.assigned_to ?? ''}
              options={assignedOptions}
              placeholder="Velg ansvarlig"
              onChange={(v) => void handleUpdate({ assigned_to: v || null })}
              disabled={readOnly}
            />
          ),
        },
        {
          id: 'scheduled',
          label: 'Planlagt tidspunkt',
          htmlFor: 'round-basics-scheduled',
          value: (
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
          ),
        },
      ]}
    />
  )
}

// ── Full-page round execution ─────────────────────────────────────────────────

export function InspectionRoundPage() {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const inspection = useInspectionModule({ supabase })
  const { load, loadRoundDetail } = inspection

  const [activeTab, setActiveTab] = useState<PanelTab>('information')
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

  const tabItems: TabItem[] = useMemo(() => {
    if (!round) return []
    const f = inspection.findingsByRoundId[round.id] ?? []
    const answered = (inspection.itemsByRoundId[round.id] ?? []).filter((i) => i.status === 'completed').length
    const tmpl = inspection.templates.find((t) => t.id === round.template_id)
    const nItems = tmpl ? parseChecklistItems(tmpl.checklist_definition).length : 0
    return [
      {
        id: 'information',
        label: TAB_LABELS.information,
        icon: Info,
      },
      {
        id: 'checklist',
        label: nItems > 0 ? `${TAB_LABELS.checklist} (${answered}/${nItems})` : TAB_LABELS.checklist,
        icon: ClipboardList,
      },
      {
        id: 'findings',
        label: TAB_LABELS.findings,
        icon: AlertTriangle,
        badgeCount: f.length > 0 ? f.length : undefined,
      },
      {
        id: 'summary',
        label: TAB_LABELS.summary,
        icon: FileText,
      },
      {
        id: 'signatures',
        label: TAB_LABELS.signatures,
        icon: PenLine,
      },
      {
        id: 'history',
        label: TAB_LABELS.history,
        icon: History,
      },
    ]
  }, [round, inspection.findingsByRoundId, inspection.itemsByRoundId, inspection.templates])

  const showSpinner = !round && (!detailStarted || inspection.loading)
  const showNotFound = detailStarted && !inspection.loading && roundId && !round

  if (!roundId) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder', to: '/inspection-module' }]}
        title="Inspeksjonsrunde"
        notFound={{ title: 'Mangler runde-ID', onBack: () => navigate('/inspection-module') }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (showSpinner) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder', to: '/inspection-module' }]}
        title="Laster runde…"
        loading
        loadingLabel="Laster runde…"
      >
        {null}
      </ModulePageShell>
    )
  }

  if (showNotFound) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder', to: '/inspection-module' }]}
        title="Runde ikke funnet"
        notFound={{
          title: 'Runde ikke funnet',
          backLabel: '← Tilbake til inspeksjonsrunder',
          onBack: () => navigate('/inspection-module'),
        }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!round) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder', to: '/inspection-module' }]}
        title="Laster runde…"
        loading
        loadingLabel="Laster runde…"
      >
        {null}
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
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
            variant={round.status === 'signed' ? 'signed' : round.status === 'active' ? 'active' : 'draft'}
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
      tabs={<Tabs items={tabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as PanelTab)} />}
    >
      <ModuleLegalBanner
        collapsible
        title="Inspeksjonsrunder"
        intro={
          <p>
            Vernerunder og inspeksjonsrunder er dokumenterte gjennomganger av arbeidsmiljøet.
            Dokumentasjonen skal arkiveres og gjøres tilgjengelig for tilsyn.
          </p>
        }
        references={[
          {
            code: 'IK-forskriften § 5',
            text: (
              <>
                Skriftlig dokumentasjon av systematisk HMS-arbeid — inkluderer kartlegging,
                tiltak og gjennomgang. Dekker også dobbel signering (leder + verneombud) av
                utførte runder.
              </>
            ),
          },
          {
            code: 'AML § 2-1 og § 6-2',
            text: (
              <>
                Arbeidsgivers ansvar for systematisk HMS-arbeid (AML § 2-1) og verneombudets
                representasjon ved vernerunder (AML § 6-2).
              </>
            ),
          },
          {
            code: 'Bokføringsloven § 13',
            text: <>Oppbevaringsplikt minimum 5 år for signerte protokoller og HMS-dokumenter.</>,
          },
        ]}
      />

      {activeTab === 'information' && (
        <RoundInformationCard
          round={round}
          locations={inspection.locations}
          assignableUsers={inspection.assignableUsers}
          readOnly={round.status === 'signed'}
          onUpdated={() => void inspection.loadRoundDetail(round.id)}
        />
      )}

      {activeTab === 'checklist' && (
        <div className="flex flex-col space-y-6">
          {critCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-5 py-3">
              <Badge variant="critical" className="text-xs font-semibold shadow-none">
                ⚠ {critCount} kritiske funn registrert
              </Badge>
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
        <FindingsTab
          key={`${round.id}-${findingPrefillKey ?? ''}`}
          round={round}
          inspection={inspection}
          prefillItemKey={findingPrefillKey}
          checklistItems={checklistItems}
          onOpenDeviation={(id) => setSelectedDeviationId(id)}
        />
      )}

      {activeTab === 'summary' && (
        <ModuleSectionCard>
          <SummaryTab key={`${round.id}-${round.updated_at}`} round={round} inspection={inspection} />
        </ModuleSectionCard>
      )}

      {activeTab === 'signatures' && (
        <ModuleSectionCard>
          <SignaturesTab round={round} inspection={inspection} checklistItems={checklistItems} />
        </ModuleSectionCard>
      )}

      {activeTab === 'history' && (
        <ModuleSectionCard>
          <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-2">
            <span className="text-xs text-neutral-500">Revisjonsspor — alle endringer loggført for denne runden</span>
          </div>
          <HseAuditLogViewer supabase={supabase} recordId={round.id} tableName="inspection_rounds" />
        </ModuleSectionCard>
      )}

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
    </ModulePageShell>
  )
}
