import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import type { InspectionChecklistItem, InspectionFieldType, InspectionItemRow } from '../types'

const TH_CELL = `${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200`

const TR_ROW = `${LAYOUT_TABLE1_POSTINGS_BODY_ROW} border-b border-neutral-100 hover:bg-neutral-50 transition-colors`

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Ja' },
  { value: 'no', label: 'Nei' },
  { value: 'na', label: 'N/A' },
]

function fieldTypeForItem(item: InspectionChecklistItem): InspectionFieldType {
  const ft = item.fieldType ?? 'yes_no_na'
  return ft === 'photo_required' ? 'photo' : ft
}

function isAnswered(row: InspectionItemRow | undefined, value: string): boolean {
  if (!row) return value.length > 0
  return row.status === 'completed' || (typeof row.response?.value === 'string' && row.response.value !== '')
}

type ChecklistRowProps = {
  item: InspectionChecklistItem
  categoryLabel: string
  row: InspectionItemRow | undefined
  readOnly: boolean
  onSaveResponse: (key: string, value: string, notes: string | null) => Promise<void>
  onRegisterFinding: (itemKey: string) => void
}

function InspectionChecklistRow({
  item,
  categoryLabel,
  row,
  readOnly,
  onSaveResponse,
  onRegisterFinding,
}: ChecklistRowProps) {
  const fieldType = fieldTypeForItem(item)
  const persisted = typeof row?.response?.value === 'string' ? row.response.value : ''
  const [localValue, setLocalValue] = useState(persisted)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalValue(persisted)
  }, [persisted])

  const answered = isAnswered(row, localValue)

  const persist = useCallback(
    async (next: string) => {
      setSaving(true)
      try {
        await onSaveResponse(item.key, next, null)
      } finally {
        setSaving(false)
      }
    },
    [item.key, onSaveResponse],
  )

  const answerCell = () => {
    if (readOnly && fieldType === 'yes_no_na') {
      if (!localValue) return <span className="text-xs italic text-neutral-400">Ikke besvart</span>
      const label = YES_NO_OPTIONS.find((o) => o.value === localValue)?.label ?? localValue
      return (
        <Badge variant={localValue === 'yes' ? 'success' : localValue === 'no' ? 'critical' : 'neutral'}>
          {label}
        </Badge>
      )
    }

    if (!readOnly && fieldType === 'yes_no_na') {
      return (
        <SearchableSelect
          value={localValue}
          options={[{ value: '', label: 'Velg …' }, ...YES_NO_OPTIONS]}
          onChange={(v) => {
            setLocalValue(v)
            void persist(v)
          }}
          disabled={saving}
        />
      )
    }

    if (fieldType === 'text') {
      return (
        <StandardTextarea
          rows={2}
          value={localValue}
          readOnly={readOnly}
          onChange={(e) => {
            if (readOnly) return
            setLocalValue(e.target.value)
          }}
          onBlur={() => {
            if (readOnly) return
            if (localValue !== persisted) void persist(localValue)
          }}
          placeholder="Skriv svar…"
          className="text-sm"
        />
      )
    }

    if (fieldType === 'number') {
      return (
        <StandardInput
          type="number"
          value={localValue}
          readOnly={readOnly}
          onChange={(e) => {
            if (readOnly) return
            setLocalValue(e.target.value)
          }}
          onBlur={() => {
            if (readOnly) return
            if (localValue !== persisted) void persist(localValue)
          }}
        />
      )
    }

    if (fieldType === 'photo' || fieldType === 'signature') {
      return (
        <p className="text-xs italic text-neutral-400">
          {fieldType === 'signature' ? 'Signatur' : 'Foto'} registreres ikke her.
        </p>
      )
    }

    return null
  }

  return (
    <tr className={TR_ROW}>
      <td className="w-12 px-5 py-4 align-middle">
        {answered ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
        ) : (
          <Circle className="h-5 w-5 text-neutral-300" aria-hidden />
        )}
      </td>
      <td className="px-5 py-4 align-top">
        <div className="flex min-w-0 max-w-[min(28rem,50vw)] flex-col space-y-1">
          <span className="font-medium text-sm text-neutral-900">{item.label}</span>
          {item.helpText ? <span className="text-xs text-neutral-500">{item.helpText}</span> : null}
        </div>
      </td>
      <td className="px-5 py-4 align-middle">
        <Badge
          variant="neutral"
          className="rounded-md border border-neutral-300 bg-white font-normal normal-case tracking-normal text-neutral-800 shadow-none"
        >
          {categoryLabel}
        </Badge>
      </td>
      <td className="w-48 min-w-[12rem] px-5 py-4 align-middle">{answerCell()}</td>
      <td className="px-5 py-4 text-right align-middle">
        {!readOnly ? (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => onRegisterFinding(item.key)}>
              Registrer avvik
            </Button>
          </div>
        ) : null}
      </td>
    </tr>
  )
}

export type InspectionChecklistTableProps = {
  checklistItems: InspectionChecklistItem[]
  roundItems: InspectionItemRow[] | undefined
  readOnly: boolean
  onSaveResponse: (key: string, value: string, notes: string | null) => Promise<void>
  onRegisterFinding: (itemKey: string) => void
  activationBanner?: ReactNode
  headerActions?: ReactNode
}

export function InspectionChecklistTable({
  checklistItems,
  roundItems,
  readOnly,
  onSaveResponse,
  onRegisterFinding,
  activationBanner,
  headerActions,
}: InspectionChecklistTableProps) {
  const rowByKey = useMemo(() => {
    const m = new Map<string, InspectionItemRow>()
    for (const r of roundItems ?? []) m.set(r.checklist_item_key, r)
    return m
  }, [roundItems])

  const { answered, total, pct } = useMemo(() => {
    const total = checklistItems.length
    let answered = 0
    for (const item of checklistItems) {
      const row = rowByKey.get(item.key)
      const v = typeof row?.response?.value === 'string' ? row.response.value : ''
      if (isAnswered(row, v)) answered++
    }
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0
    return { answered, total, pct }
  }, [checklistItems, rowByKey])

  const categoryLabel = useCallback((item: InspectionChecklistItem) => {
    return item.hmsCategory
      ? ({
          fysisk: 'Fysisk arbeidsmiljø',
          ergonomi: 'Ergonomi og tilrettelegging',
          kjemikalier: 'Kjemikalier og farlige stoffer',
          psykososialt: 'Psykososialt arbeidsmiljø',
          brann: 'Brann og rømning',
          maskiner: 'Maskiner og teknisk utstyr',
          annet: 'Annet',
        }[item.hmsCategory] ?? 'Generelt')
      : 'Generelt'
  }, [])

  const emptyCols = 5

  return (
    <div className="flex flex-col">
      {activationBanner}

      <div className={WPSTD_FORM_ROW_GRID}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 md:col-span-2">
          <div className="min-w-0">
            <p className={WPSTD_FORM_FIELD_LABEL}>Sjekkliste</p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-neutral-600">
              Gå gjennom punktene og registrer svar. Bruk «Registrer avvik» når et punkt avdekker et avvik.
            </p>
          </div>
          {headerActions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div> : null}
        </div>
      </div>

      <LayoutTable1PostingsShell
        wrap={false}
        toolbar={
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-neutral-600">Fremdrift</span>
              <span className={`text-sm font-bold tabular-nums ${pct === 100 ? 'text-green-600' : 'text-[#1a3d32]'}`}>
                {pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-[#1a3d32]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              {answered} av {total} punkter besvart
            </p>
          </div>
        }
      >
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className={`${TH_CELL} w-12`}>Status</th>
                <th className={TH_CELL}>Sjekkpunkt</th>
                <th className={TH_CELL}>Kategori</th>
                <th className={`${TH_CELL} w-48`}>Svar</th>
                <th className={`${TH_CELL} text-right`}>Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {checklistItems.length === 0 ? (
                <tr className={TR_ROW}>
                  <td colSpan={emptyCols} className="px-5 py-0">
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <ClipboardList className="h-12 w-12 text-neutral-300" aria-hidden />
                      <p className="mt-4 font-medium text-neutral-900">Ingen sjekklistepunkter</p>
                      <p className="mt-1 max-w-md text-sm text-neutral-500">
                        Malen for denne runden inneholder ingen punkter. Velg en annen mal eller kontakt administrator.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                checklistItems.map((item) => (
                  <InspectionChecklistRow
                    key={item.key}
                    item={item}
                    categoryLabel={categoryLabel(item)}
                    row={rowByKey.get(item.key)}
                    readOnly={readOnly}
                    onSaveResponse={onSaveResponse}
                    onRegisterFinding={onRegisterFinding}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </LayoutTable1PostingsShell>
    </div>
  )
}
