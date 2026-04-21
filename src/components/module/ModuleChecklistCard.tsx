import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, ClipboardList, Circle, HelpCircle } from 'lucide-react'
import { ComplianceBanner } from '../ui/ComplianceBanner'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { ModuleSectionCard } from './ModuleSectionCard'
import { MODULE_TABLE_TH } from './moduleTableKit'

/**
 * A single item in the checklist. Every module that renders a checklist
 * (Inspeksjonsrunder, SJA, Internkontroll, Årlig gjennomgang …) maps its own
 * domain data onto this interface.
 */
export interface ModuleChecklistItem {
  /** Stable identifier used for rows, responses and DOM ids. */
  key: string
  /** Primary question text shown to the user. */
  label: string
  /**
   * Kind of answer the user is expected to provide.
   * - `yes_no_na`: dropdown with «Ja / Nei / N/A» — the HSE-standard default.
   * - `text`: single-line or multi-line free text.
   * - `number`: numeric-only input.
   * - `readonly`: informational row (no input, no persistence).
   */
  fieldType?: 'yes_no_na' | 'text' | 'number' | 'readonly'
  /**
   * When `true`, the question must be answered before the record can be
   * signed. Renders a red asterisk next to the label and contributes to the
   * «required answered» count.
   */
  required?: boolean
  /** Explanatory text — rendered as small grey help text below the question. */
  helpText?: string
  /** Legal / regulatory reference, e.g. «AML § 4-4». Renders as a neutral badge. */
  lawRef?: string
  /** Domain-specific tag rendered as a neutral badge, e.g. HMS-kategori. */
  categoryLabel?: string
}

/**
 * Answer state for a single item — decoupled from any server row type so the
 * same component can be reused across modules (inspection_items rows, sja
 * control rows, etc.).
 */
export interface ModuleChecklistResponse {
  /** Primary answer value. `''` means unanswered. */
  value: string
  /** Free-text notes attached to this answer (optional). */
  notes?: string | null
}

export type ModuleChecklistResponseMap = Record<string, ModuleChecklistResponse | undefined>

export interface ModuleChecklistSecondaryAction {
  /** Icon-button rendered on the right of each row. */
  icon: ReactNode
  /** Accessible label + tooltip text. */
  label: string
  onClick: (itemKey: string) => void
  /** When true, hide the action for this row (e.g. read-only rounds). */
  hidden?: boolean
}

export interface ModuleChecklistCardProps {
  /** Heading shown in the green compliance banner. */
  title?: ReactNode
  /** Banner description — typically a compliance reference. */
  description?: ReactNode
  /** The ordered list of questions. */
  items: ModuleChecklistItem[]
  /** Map of `item.key → response`. Items not in the map are treated as unanswered. */
  responses: ModuleChecklistResponseMap
  /** `true` — every control is locked and answers are rendered as read-only badges. */
  readOnly?: boolean
  /** Show a loader in place of the table. */
  loading?: boolean
  /**
   * Fires when the user changes an answer. Components decide whether to
   * debounce, batch, or persist immediately.
   */
  onChange: (itemKey: string, next: ModuleChecklistResponse) => void | Promise<void>
  /**
   * Secondary row-level action, e.g. «Register avvik» or «Åpne detalj».
   * When omitted, the action column is hidden.
   */
  secondaryAction?: ModuleChecklistSecondaryAction
  /**
   * Optional alert/banner rendered between the title and the table
   * (e.g. «Aktiver runden for å begynne»).
   */
  alertBanner?: ReactNode
  /**
   * Optional secondary toolbar slot rendered on the right side of the progress
   * strip — e.g. «📍 Stempel GPS» or a filter dropdown.
   */
  toolbarExtras?: ReactNode
  /** `false` — drop the outer white card (e.g. when rendering inside one already). */
  withCard?: boolean
}

const YES_NO_OPTIONS: SelectOption[] = [
  { value: 'yes', label: 'Ja' },
  { value: 'no', label: 'Nei' },
  { value: 'na', label: 'N/A' },
]

function answerIsFilled(fieldType: ModuleChecklistItem['fieldType'], value: string): boolean {
  if (fieldType === 'readonly') return true
  return value.trim().length > 0
}

function renderReadOnlyAnswer(item: ModuleChecklistItem, value: string): ReactNode {
  const ft = item.fieldType ?? 'yes_no_na'
  if (ft === 'yes_no_na') {
    if (!value) return <span className="text-xs italic text-neutral-400">Ikke besvart</span>
    const variant = value === 'yes' ? 'success' : value === 'no' ? 'critical' : 'neutral'
    const label = YES_NO_OPTIONS.find((o) => o.value === value)?.label ?? value
    return <Badge variant={variant}>{label}</Badge>
  }
  if (ft === 'readonly') return null
  return value ? <span className="whitespace-normal text-sm text-neutral-800">{value}</span> : (
    <span className="text-xs italic text-neutral-400">Ikke besvart</span>
  )
}

/**
 * Generic, reusable HSE checklist card.
 *
 * Usage (Inspeksjonsrunder adapter simplifies further):
 * ```tsx
 * <ModuleChecklistCard
 *   title="IK-forskriften § 5 — sjekkliste"
 *   description="Gå gjennom punktene og registrer svar."
 *   items={checklistItems}
 *   responses={responseMap}
 *   readOnly={round.status === 'signed'}
 *   onChange={(key, r) => upsertResponse(key, r)}
 *   secondaryAction={{
 *     icon: <AlertCircle className="h-4 w-4" />,
 *     label: 'Registrer avvik',
 *     onClick: (key) => switchToFindings(key),
 *   }}
 * />
 * ```
 */
export function ModuleChecklistCard({
  title = 'Sjekkliste',
  description,
  items,
  responses,
  readOnly = false,
  loading = false,
  onChange,
  secondaryAction,
  alertBanner,
  toolbarExtras,
  withCard = true,
}: ModuleChecklistCardProps) {
  const totals = useMemo(() => {
    let answered = 0
    let required = 0
    let requiredAnswered = 0
    for (const item of items) {
      const response = responses[item.key]
      const value = response?.value ?? ''
      const filled = answerIsFilled(item.fieldType, value)
      if (filled) answered++
      if (item.required) {
        required++
        if (filled) requiredAnswered++
      }
    }
    const total = items.length
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0
    const requiredPct = required > 0 ? Math.round((requiredAnswered / required) * 100) : 100
    return { answered, total, pct, required, requiredAnswered, requiredPct }
  }, [items, responses])

  const hasSecondary = Boolean(secondaryAction)
  const colCount = 4 + (hasSecondary ? 1 : 0)

  const body = (
    <>
      <ComplianceBanner title={title} className="border-b border-[#1a3d32]/20">
        {description ?? (
          <p>Besvar hvert punkt. Påkrevde punkter er merket med *.</p>
        )}
      </ComplianceBanner>

      {alertBanner ? <div className="border-b border-neutral-100 bg-white">{alertBanner}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 bg-neutral-50/60 px-5 py-4">
        <div className="min-w-[16rem] flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-600">Fremdrift</span>
            <span
              className={`text-sm font-bold tabular-nums ${
                totals.pct === 100 ? 'text-green-600' : 'text-[#1a3d32]'
              }`}
            >
              {totals.pct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totals.pct === 100 ? 'bg-green-500' : 'bg-[#1a3d32]'
              }`}
              style={{ width: `${totals.pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            {totals.answered} av {totals.total} punkter besvart
            {totals.required > 0
              ? ` · ${totals.requiredAnswered}/${totals.required} påkrevde besvart`
              : ''}
          </p>
        </div>
        {toolbarExtras ? <div className="shrink-0">{toolbarExtras}</div> : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-neutral-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
          Laster sjekkliste…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className={`${MODULE_TABLE_TH} w-12 text-center`}>Status</th>
                <th className={`${MODULE_TABLE_TH} w-full`}>Sjekkpunkt</th>
                <th className={MODULE_TABLE_TH}>Kategori</th>
                <th className={MODULE_TABLE_TH}>Svar</th>
                {hasSecondary ? (
                  <th className={`${MODULE_TABLE_TH} text-right`}>Handlinger</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-5 py-12 text-center text-sm whitespace-normal text-neutral-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <ClipboardList className="h-10 w-10 text-neutral-300" aria-hidden />
                      <span>Ingen sjekklistepunkter.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <ChecklistRow
                    key={item.key}
                    item={item}
                    response={responses[item.key]}
                    readOnly={readOnly}
                    onChange={onChange}
                    secondaryAction={secondaryAction}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  if (!withCard) return <div>{body}</div>
  return <ModuleSectionCard>{body}</ModuleSectionCard>
}

function ChecklistRow({
  item,
  response,
  readOnly,
  onChange,
  secondaryAction,
}: {
  item: ModuleChecklistItem
  response: ModuleChecklistResponse | undefined
  readOnly: boolean
  onChange: (itemKey: string, next: ModuleChecklistResponse) => void | Promise<void>
  secondaryAction?: ModuleChecklistSecondaryAction
}) {
  const fieldType = item.fieldType ?? 'yes_no_na'
  const persisted = response?.value ?? ''
  const [localValue, setLocalValue] = useState(persisted)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalValue(persisted)
  }, [persisted])

  const persist = useCallback(
    async (next: string) => {
      setSaving(true)
      try {
        await onChange(item.key, { value: next, notes: response?.notes ?? null })
      } finally {
        setSaving(false)
      }
    },
    [item.key, onChange, response?.notes],
  )

  const answered = answerIsFilled(fieldType, localValue)
  const hasSecondary = Boolean(secondaryAction) && !secondaryAction?.hidden

  let answerCell: ReactNode = null
  if (readOnly || fieldType === 'readonly') {
    answerCell = renderReadOnlyAnswer(item, localValue)
  } else if (fieldType === 'yes_no_na') {
    answerCell = (
      <div className="w-44">
        <SearchableSelect
          value={localValue}
          options={[{ value: '', label: 'Velg …' }, ...YES_NO_OPTIONS]}
          onChange={(v) => {
            setLocalValue(v)
            void persist(v)
          }}
          disabled={saving}
          className="mt-0"
          triggerClassName="py-1.5 px-2 text-xs"
        />
      </div>
    )
  } else if (fieldType === 'text') {
    answerCell = (
      <StandardTextarea
        rows={2}
        value={localValue}
        readOnly={readOnly}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          if (localValue !== persisted) void persist(localValue)
        }}
        placeholder="Skriv svar…"
        className="text-sm whitespace-normal"
      />
    )
  } else if (fieldType === 'number') {
    answerCell = (
      <StandardInput
        type="number"
        value={localValue}
        readOnly={readOnly}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          if (localValue !== persisted) void persist(localValue)
        }}
      />
    )
  }

  return (
    <tr className="border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50">
      <td className="px-5 py-4 text-center align-middle">
        {answered ? (
          <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" aria-hidden />
        ) : (
          <Circle className="mx-auto h-5 w-5 text-neutral-300" aria-hidden />
        )}
      </td>
      <td className="w-full min-w-0 px-5 py-4 align-middle whitespace-normal">
        <div className="flex items-start gap-2">
          <span className="font-medium text-sm text-neutral-900">
            {item.label}
            {item.required ? <span className="ml-1 text-red-500">*</span> : null}
          </span>
          {item.helpText ? (
            <span className="mt-0.5 inline-flex items-center" title={item.helpText}>
              <HelpCircle className="h-3.5 w-3.5 text-neutral-300" aria-hidden />
            </span>
          ) : null}
        </div>
        {item.helpText ? <p className="mt-1 text-xs text-neutral-500">{item.helpText}</p> : null}
        {item.lawRef ? (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[#1a3d32]/80">
            {item.lawRef}
          </p>
        ) : null}
      </td>
      <td className="px-5 py-4 align-middle">
        <Badge variant="neutral">{item.categoryLabel ?? 'Generelt'}</Badge>
      </td>
      <td className="px-5 py-4 align-middle whitespace-normal">{answerCell}</td>
      {hasSecondary && secondaryAction ? (
        <td className="px-5 py-4 text-right align-middle">
          <div className="inline-flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => secondaryAction.onClick(item.key)}
              title={secondaryAction.label}
              aria-label={secondaryAction.label}
            >
              {secondaryAction.icon ?? <AlertCircle className="h-4 w-4 text-neutral-400 hover:text-red-600" />}
            </Button>
          </div>
        </td>
      ) : null}
    </tr>
  )
}
