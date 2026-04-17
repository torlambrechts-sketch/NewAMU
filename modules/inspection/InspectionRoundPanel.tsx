import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, X } from 'lucide-react'
import type { HmsCategory, InspectionChecklistItem, InspectionItemRow, InspectionRoundRow } from './types'
import { parseChecklistItems } from './schema'
import type { InspectionModuleState } from './useInspectionModule'

type Props = {
  round: InspectionRoundRow
  inspection: InspectionModuleState
  onClose: () => void
}

type PanelTab = 'checklist' | 'findings' | 'summary' | 'signatures'

const TAB_LABELS: Record<PanelTab, string> = {
  checklist: 'Sjekkliste',
  findings: 'Funn',
  summary: 'Sammendrag',
  signatures: 'Signaturer',
}

const STATUS_LABEL: Record<InspectionRoundRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}
const STATUS_COLOR: Record<InspectionRoundRow['status'], string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  active: 'bg-blue-100 text-blue-800',
  signed: 'bg-green-100 text-green-800',
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
const HMS_ORDER: HmsCategory[] = ['fysisk', 'ergonomi', 'kjemikalier', 'psykososialt', 'brann', 'maskiner', 'annet']

const SEVERITY_LABELS = { low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk' }
const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-700',
}

const PANEL_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-700'
const PANEL_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'

// ── Single checklist item row ─────────────────────────────────────────────────

function ChecklistItemRow({
  item,
  position,
  existing,
  roundId,
  readOnly,
  inspection,
  onAddFinding,
}: {
  item: InspectionChecklistItem
  position: number
  existing: InspectionItemRow | undefined
  roundId: string
  readOnly: boolean
  inspection: InspectionModuleState
  onAddFinding: (itemKey: string, itemLabel: string) => void
}) {
  const fieldType = item.fieldType ?? 'yes_no_na'
  const currentValue = typeof existing?.response?.value === 'string' ? existing.response.value : ''
  const hasExistingNotes = (existing?.notes ?? '').trim().length > 0
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [showNotes, setShowNotes] = useState(hasExistingNotes)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const displayedValue = optimisticValue ?? currentValue

  useEffect(() => {
    setNotes(existing?.notes ?? '')
  }, [existing?.notes])

  useEffect(() => {
    if (hasExistingNotes) setShowNotes(true)
  }, [hasExistingNotes])

  useEffect(() => {
    if (!justSaved) return
    const timeoutId = window.setTimeout(() => setJustSaved(false), 1200)
    return () => window.clearTimeout(timeoutId)
  }, [justSaved])

  const saveResponse = useCallback(
    async (value: string, noteOverride?: string) => {
      setSaving(true)
      await inspection.upsertItemResponse({
        roundId,
        checklistItemKey: item.key,
        checklistItemLabel: item.label,
        position,
        response: { value },
        status: value ? 'completed' : 'pending',
        notes: noteOverride !== undefined ? noteOverride : notes,
      })
      setOptimisticValue(null)
      if (!inspection.error) setJustSaved(true)
      setSaving(false)
    },
    [inspection, roundId, item.key, item.label, position, notes, inspection.error],
  )

  const saveNotes = useCallback(async () => {
    if (notes === (existing?.notes ?? '')) return
    setSaving(true)
    await inspection.upsertItemResponse({
      roundId,
      checklistItemKey: item.key,
      checklistItemLabel: item.label,
      position,
      response: existing?.response ?? {},
      status: existing?.status ?? 'pending',
      notes,
    })
    if (!inspection.error) setJustSaved(true)
    setSaving(false)
  }, [inspection, roundId, item.key, item.label, position, notes, existing, inspection.error])

  return (
    <div
      className={`border-b border-neutral-100 px-5 py-4 transition-shadow last:border-b-0 ${
        justSaved ? 'ring-1 ring-green-400' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-xs text-neutral-400">{position + 1}.</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-900">{item.label}</span>
            {item.required && (
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Påkrevd</span>
            )}
            {item.lawRef && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{item.lawRef}</span>
            )}
            {saving && <span className="text-[10px] text-neutral-400">Lagrer…</span>}
          </div>
          {item.helpText && <p className="text-xs text-neutral-500">{item.helpText}</p>}

          {/* Response control */}
          {!readOnly && fieldType === 'yes_no_na' && (
            <div className="flex gap-1.5">
              {(['yes', 'no', 'na'] as const).map((v) => {
                const labels = { yes: 'Ja', no: 'Nei', na: 'N/A' }
                const activeClass =
                  v === 'yes'
                    ? 'bg-green-600 text-white border-green-600'
                    : v === 'no'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-neutral-500 text-white border-neutral-500'
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      const nextValue = displayedValue === v ? '' : v
                      setOptimisticValue(nextValue)
                      void saveResponse(nextValue)
                    }}
                    className={`rounded border px-3 py-1 text-xs font-semibold transition-colors ${
                      displayedValue === v ? activeClass : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {labels[v]}
                  </button>
                )
              })}
            </div>
          )}
          {readOnly && fieldType === 'yes_no_na' && displayedValue && (
            <span className="inline-block rounded border border-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
              {displayedValue === 'yes' ? 'Ja' : displayedValue === 'no' ? 'Nei' : 'N/A'}
            </span>
          )}
          {fieldType === 'text' && (
            <textarea
              rows={2}
              value={currentValue}
              readOnly={readOnly}
              onChange={(e) => !readOnly && void saveResponse(e.target.value)}
              placeholder="Skriv svar…"
              className={`${PANEL_INPUT} resize-none`}
            />
          )}
          {fieldType === 'number' && (
            <input
              type="number"
              value={currentValue}
              readOnly={readOnly}
              onChange={(e) => !readOnly && void saveResponse(e.target.value)}
              className={PANEL_INPUT}
            />
          )}
          {(fieldType === 'photo' || fieldType === 'photo_required' || fieldType === 'signature') && (
            <p className="text-xs text-neutral-400 italic">
              {fieldType === 'signature' ? 'Signatur' : 'Foto'} — ikke implementert i nettleseren.
            </p>
          )}

          {/* Notes */}
          {!readOnly && !showNotes && !hasExistingNotes && (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 hover:underline"
            >
              + Legg til notat
            </button>
          )}
          {!readOnly && (showNotes || hasExistingNotes) && (
            <textarea
              rows={1}
              value={notes}
              autoFocus={!hasExistingNotes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void saveNotes()}
              placeholder="Notat (valgfritt)…"
              className={`${PANEL_INPUT} resize-none text-xs`}
            />
          )}
          {readOnly && existing?.notes && (
            <p className="text-xs text-neutral-500 italic">{existing.notes}</p>
          )}

          {/* Inline finding prompt when NEI */}
          {!readOnly && displayedValue === 'no' && (
            <button
              type="button"
              onClick={() => onAddFinding(item.key, item.label)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              + Legg til funn for dette punktet
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Checklist tab ─────────────────────────────────────────────────────────────

function ChecklistTab({
  round,
  checklistItems,
  inspection,
  onAddFinding,
}: {
  round: InspectionRoundRow
  checklistItems: InspectionChecklistItem[]
  inspection: InspectionModuleState
  onAddFinding: (itemKey: string, itemLabel: string) => void
}) {
  const roundItems = inspection.itemsByRoundId[round.id]
  const isRoundDetailLoading = roundItems === undefined

  const itemResponseByKey = useMemo(() => {
    const map = new Map<string, InspectionItemRow>()
    for (const item of roundItems ?? []) {
      map.set(item.checklist_item_key, item)
    }
    return map
  }, [roundItems])

  const grouped = useMemo(() => {
    const groups = new Map<HmsCategory | '__none__', InspectionChecklistItem[]>()
    for (const item of checklistItems) {
      const key = item.hmsCategory ?? '__none__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    return groups
  }, [checklistItems])

  const orderedKeys = useMemo(() => {
    const keys: (HmsCategory | '__none__')[] = [...HMS_ORDER.filter((k) => grouped.has(k))]
    if (grouped.has('__none__')) keys.push('__none__')
    return keys
  }, [grouped])

  const answered = useMemo(
    () => checklistItems.filter((i) => {
      const row = itemResponseByKey.get(i.key)
      return row?.status === 'completed' || (typeof row?.response?.value === 'string' && row.response.value !== '')
    }).length,
    [checklistItems, itemResponseByKey],
  )

  const readOnly = round.status === 'signed'
  const isDraft = round.status === 'draft'
  const total = checklistItems.length

  return (
    <div>
      {isDraft && (
        <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-3">
          <div>
            <p className="text-sm font-medium text-amber-800">Runden er i kladd-modus</p>
            <p className="mt-0.5 text-xs text-amber-600">Aktiver runden for å begynne gjennomføringen.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              void inspection.updateRoundSchedule({ roundId: round.id, status: 'active' })
            }
            className="shrink-0 rounded px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: '#1a3d32' }}
          >
            Aktiver runden
          </button>
        </div>
      )}

      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">
            {answered} / {total} punkter besvart
          </span>
          <span className="text-sm font-semibold text-[#1a3d32]">
            {total > 0 ? Math.round((answered / total) * 100) : 0}%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-[#1a3d32] transition-all duration-300"
            style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {isRoundDetailLoading && (
        <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-neutral-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
          Laster sjekkliste…
        </div>
      )}

      {!isRoundDetailLoading && orderedKeys.map((cat) => {
        const catItems = grouped.get(cat) ?? []
        const catLabel = cat === '__none__' ? 'Generelt' : HMS_LABELS[cat]
        const catLaw = cat !== '__none__' ? HMS_LAW[cat] : undefined
        return (
          <div key={cat}>
            <div className="sticky top-14 z-10 border-b border-neutral-200 bg-neutral-50 px-5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">{catLabel}</span>
                {catLaw && (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600">{catLaw}</span>
                )}
              </div>
            </div>
            {catItems.map((item, idx) => (
              <ChecklistItemRow
                key={item.key}
                item={item}
                position={idx}
                existing={itemResponseByKey.get(item.key)}
                roundId={round.id}
                readOnly={readOnly}
                inspection={inspection}
                onAddFinding={onAddFinding}
              />
            ))}
          </div>
        )
      })}

      {checklistItems.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-neutral-400">
          Ingen sjekklistepunkter i malen.
        </p>
      )}
    </div>
  )
}

// ── Findings tab ──────────────────────────────────────────────────────────────

function FindingsTab({
  round,
  inspection,
  prefillItemKey,
  checklistItems,
}: {
  round: InspectionRoundRow
  inspection: InspectionModuleState
  prefillItemKey: string | null
  checklistItems: InspectionChecklistItem[]
}) {
  const findings = inspection.findingsByRoundId[round.id] ?? []
  const items = inspection.itemsByRoundId[round.id] ?? []
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [linkedItemKey, setLinkedItemKey] = useState(prefillItemKey ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (prefillItemKey) setLinkedItemKey(prefillItemKey)
  }, [prefillItemKey])

  const linkedItemId = useMemo(() => {
    if (!linkedItemKey) return undefined
    return items.find((i) => i.checklist_item_key === linkedItemKey)?.id
  }, [linkedItemKey, items])

  async function handleAdd() {
    if (!description.trim()) return
    setSaving(true)
    await inspection.addFinding({
      roundId: round.id,
      description,
      severity,
      itemId: linkedItemId,
    })
    setDescription('')
    setSeverity('medium')
    setLinkedItemKey('')
    setSaving(false)
  }

  const readOnly = round.status === 'signed'

  return (
    <div className="divide-y divide-neutral-100">
      {!readOnly && (
        <div className="space-y-3 px-5 py-5">
          <p className={PANEL_FIELD_LABEL}>Nytt funn</p>
          <div>
            <label className={PANEL_FIELD_LABEL} htmlFor="finding-desc">Beskrivelse</label>
            <textarea
              id="finding-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beskriv funnet…"
              className={`${PANEL_INPUT} resize-none`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={PANEL_FIELD_LABEL} htmlFor="finding-severity">Alvorlighetsgrad</label>
              <select
                id="finding-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as typeof severity)}
                className={PANEL_INPUT}
              >
                {(Object.keys(SEVERITY_LABELS) as (keyof typeof SEVERITY_LABELS)[]).map((s) => (
                  <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={PANEL_FIELD_LABEL} htmlFor="finding-item">Tilknyttet punkt (valgfri)</label>
              <select
                id="finding-item"
                value={linkedItemKey}
                onChange={(e) => setLinkedItemKey(e.target.value)}
                className={PANEL_INPUT}
              >
                <option value="">(Ingen)</option>
                {checklistItems.map((ci) => (
                  <option key={ci.key} value={ci.key}>{ci.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            disabled={!description.trim() || saving}
            onClick={() => void handleAdd()}
            className="rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#1a3d32' }}
          >
            {saving ? 'Lagrer…' : 'Legg til funn'}
          </button>
        </div>
      )}

      {findings.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-400">Ingen funn registrert.</p>
      ) : (
        <div>
          {findings.map((f) => {
            const linkedLabel = f.item_id
              ? (items.find((i) => i.id === f.item_id)?.checklist_item_label ?? null)
              : null
            return (
              <div key={f.id} className="border-b border-neutral-100 px-5 py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-neutral-900">{f.description}</p>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_COLORS[f.severity]}`}
                  >
                    {SEVERITY_LABELS[f.severity]}
                  </span>
                </div>
                {linkedLabel && (
                  <p className="mt-1 text-xs text-neutral-500">Punkt: {linkedLabel}</p>
                )}
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
      <div className="rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-4">
        <p className="text-xs font-semibold text-neutral-700">IK-forskriften § 5 — skriftlig protokoll</p>
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
          className="rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
          className={`rounded-none border px-4 py-3 text-xs font-medium ${
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

      <div className="rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-4">
        <p className="text-xs font-semibold text-neutral-700">IK-forskriften § 5 — dobbel signering</p>
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
      <div className="rounded-none border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Leder</p>
            <p className="text-xs text-neutral-500">AML § 2-1 — arbeidsgiveransvar</p>
            {round.manager_signed_at ? (
              <p className="mt-1 text-xs text-green-700">
                Signert{' '}
                {new Date(round.manager_signed_at).toLocaleDateString('nb-NO', { dateStyle: 'medium' })}
                {round.manager_signed_by && userNameById.has(round.manager_signed_by)
                  ? ` av ${userNameById.get(round.manager_signed_by)}`
                  : ''}
              </p>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">Ikke signert</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {round.manager_signed_at ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <Circle className="h-6 w-6 text-neutral-300" />
            )}
            {!round.manager_signed_at && !isSigned && (
              <button
                type="button"
                disabled={managerButtonDisabled}
                title={unauthorizedTooltip}
                onClick={() => void handleSign('manager')}
                className={`rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  managerButtonSolid ? 'text-white' : 'border border-neutral-300 bg-white text-neutral-700'
                }`}
                style={managerButtonSolid ? { backgroundColor: '#1a3d32' } : undefined}
              >
                {signing === 'manager' ? 'Signerer…' : 'Signer som leder'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Deputy */}
      <div className="rounded-none border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Verneombud</p>
            <p className="text-xs text-neutral-500">AML § 6-2 — verneombudets representasjon</p>
            {round.deputy_signed_at ? (
              <p className="mt-1 text-xs text-green-700">
                Signert{' '}
                {new Date(round.deputy_signed_at).toLocaleDateString('nb-NO', { dateStyle: 'medium' })}
                {round.deputy_signed_by && userNameById.has(round.deputy_signed_by)
                  ? ` av ${userNameById.get(round.deputy_signed_by)}`
                  : ''}
              </p>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">Ikke signert</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {round.deputy_signed_at ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <Circle className="h-6 w-6 text-neutral-300" />
            )}
            {!round.deputy_signed_at && !isSigned && (
              <button
                type="button"
                disabled={deputyButtonDisabled}
                title={unauthorizedTooltip}
                onClick={() => void handleSign('deputy')}
                className={`rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  deputyButtonSolid ? 'text-white' : 'border border-neutral-300 bg-white text-neutral-700'
                }`}
                style={deputyButtonSolid ? { backgroundColor: '#1a3d32' } : undefined}
              >
                {signing === 'deputy' ? 'Signerer…' : 'Signer som verneombud'}
              </button>
            )}
          </div>
        </div>
      </div>

      {isSigned && (
        <div className="rounded border border-green-200 bg-green-50 p-4 text-center">
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

// ── Main panel ────────────────────────────────────────────────────────────────

export function InspectionRoundPanel({ round, inspection, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>('checklist')
  const [findingPrefillKey, setFindingPrefillKey] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    void inspection.loadRoundDetail(round.id)
  }, [round.id])

  const template = inspection.templates.find((t) => t.id === round.template_id)
  const checklistItems = useMemo(
    () => (template ? parseChecklistItems(template.checklist_definition) : []),
    [template],
  )

  function handleAddFinding(itemKey: string, _itemLabel: string) {
    setFindingPrefillKey(itemKey)
    setActiveTab('findings')
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const findings = inspection.findingsByRoundId[round.id] ?? []
  const critCount = findings.filter((f) => f.severity === 'critical').length

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/45 backdrop-blur-[2px]"
      onClick={handleOverlayClick}
    >
      <div className="flex h-full w-full max-w-[min(100vw,920px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]">
        {/* Header */}
        <div className="shrink-0 border-b border-neutral-200/90 bg-white px-6 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-neutral-900">{round.title}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[round.status]}`}
                >
                  {STATUS_LABEL[round.status]}
                </span>
                {critCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    {critCount} kritisk
                  </span>
                )}
              </div>
              {template && (
                <p className="mt-0.5 text-xs text-neutral-500">Mal: {template.name}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-0.5">
            {(Object.keys(TAB_LABELS) as PanelTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-[#1a3d32] text-[#1a3d32]'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {TAB_LABELS[tab]}
                {tab === 'findings' && findings.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                    {findings.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'checklist' && (
            <ChecklistTab
              round={round}
              checklistItems={checklistItems}
              inspection={inspection}
              onAddFinding={handleAddFinding}
            />
          )}
          {activeTab === 'findings' && (
            <FindingsTab
              round={round}
              inspection={inspection}
              prefillItemKey={findingPrefillKey}
              checklistItems={checklistItems}
            />
          )}
          {activeTab === 'summary' && (
            <SummaryTab round={round} inspection={inspection} />
          )}
          {activeTab === 'signatures' && (
            <SignaturesTab round={round} inspection={inspection} checklistItems={checklistItems} />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-neutral-500">
              {round.status === 'signed'
                ? 'Signert og arkivert — skrivebeskyttet'
                : `${(inspection.itemsByRoundId[round.id] ?? []).filter((i) => i.status === 'completed').length} / ${checklistItems.length} punkter besvart`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Lukk
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
