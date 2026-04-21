import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Circle, ClipboardList } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import { LAYOUT_TABLE1_POSTINGS_BODY_ROW } from '../../../src/components/layout/layoutTable1PostingsKit'
import { MODULE_TABLE_TH } from '../../../src/components/module/moduleTableKit'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import type { InspectionChecklistItem, InspectionFieldType, InspectionItemRow } from '../types'

const TH = MODULE_TABLE_TH

const TR_BODY = `${LAYOUT_TABLE1_POSTINGS_BODY_ROW} border-b border-neutral-100 last:border-b-0 transition-colors hover:bg-neutral-50`

const SELECT_COMPACT = 'mt-0'
const SELECT_TRIGGER_SM = 'py-1.5 px-2 text-xs'

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

function categoryLabel(item: InspectionChecklistItem): string {
  if (!item.hmsCategory) return 'Generelt'
  const map: Record<string, string> = {
    fysisk: 'Fysisk arbeidsmiljø',
    ergonomi: 'Ergonomi og tilrettelegging',
    kjemikalier: 'Kjemikalier og farlige stoffer',
    psykososialt: 'Psykososialt arbeidsmiljø',
    brann: 'Brann og rømning',
    maskiner: 'Maskiner og teknisk utstyr',
    annet: 'Annet',
  }
  return map[item.hmsCategory] ?? 'Generelt'
}

type RowProps = {
  item: InspectionChecklistItem
  row: InspectionItemRow | undefined
  readOnly: boolean
  onSaveResponse: (key: string, value: string, notes: string | null) => Promise<void>
  onRegisterFinding: (itemKey: string) => void
}

function ChecklistTableRow({ item, row, readOnly, onSaveResponse, onRegisterFinding }: RowProps) {
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

  let answerCell: ReactNode = null

  if (readOnly && fieldType === 'yes_no_na') {
    answerCell = !localValue ? (
      <span className="text-xs italic text-neutral-400">Ikke besvart</span>
    ) : (
      <Badge variant={localValue === 'yes' ? 'success' : localValue === 'no' ? 'critical' : 'neutral'}>
        {YES_NO_OPTIONS.find((o) => o.value === localValue)?.label ?? localValue}
      </Badge>
    )
  } else if (!readOnly && fieldType === 'yes_no_na') {
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
          className={SELECT_COMPACT}
          triggerClassName={SELECT_TRIGGER_SM}
        />
      </div>
    )
  } else if (fieldType === 'text') {
    answerCell = (
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
        className="text-sm whitespace-normal"
      />
    )
  } else if (fieldType === 'number') {
    answerCell = (
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
  } else if (fieldType === 'photo' || fieldType === 'signature') {
    answerCell = (
      <span className="text-xs italic text-neutral-400 whitespace-normal">
        {fieldType === 'signature' ? 'Signatur' : 'Foto'} registreres ikke her.
      </span>
    )
  }

  return (
    <tr className={TR_BODY}>
      <td className="px-5 py-4 text-center align-middle">
        {answered ? (
          <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" aria-hidden />
        ) : (
          <Circle className="mx-auto h-5 w-5 text-neutral-300" aria-hidden />
        )}
      </td>
      <td className="w-full min-w-0 px-5 py-4 align-middle whitespace-normal">
        <div className="font-medium text-sm text-neutral-900">{item.label}</div>
        {item.helpText ? <div className="mt-1 text-xs text-neutral-500">{item.helpText}</div> : null}
      </td>
      <td className="px-5 py-4 align-middle">
        <Badge variant="neutral">{categoryLabel(item)}</Badge>
      </td>
      <td className="px-5 py-4 align-middle whitespace-normal">{answerCell}</td>
      <td className="px-5 py-4 text-right align-middle">
        {!readOnly ? (
          <div className="inline-flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRegisterFinding(item.key)}
              title="Registrer avvik"
              aria-label="Registrer avvik"
            >
              <AlertCircle className="h-4 w-4 text-neutral-400 hover:text-red-600" />
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
}

export function InspectionChecklistTable({
  checklistItems,
  roundItems,
  readOnly,
  onSaveResponse,
  onRegisterFinding,
  activationBanner,
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

  const toolbar = (
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
  )

  const emptyCols = 5

  return (
    <div>
      {activationBanner}

      <LayoutTable1PostingsShell
        wrap={false}
        titleTypography="sans"
        title="Sjekkliste"
        description="Gå gjennom punktene og registrer svar. Bruk handlingsikonet for å hoppe til avvik."
        toolbar={toolbar}
      >
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className={TH}>Status</th>
                <th className={`${TH} w-full`}>Sjekkpunkt</th>
                <th className={TH}>Kategori</th>
                <th className={TH}>Svar</th>
                <th className={`${TH} text-right`}>Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {checklistItems.length === 0 ? (
                <tr className={TR_BODY}>
                  <td colSpan={emptyCols} className="px-5 py-12 text-center text-sm whitespace-normal text-neutral-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <ClipboardList className="h-10 w-10 text-neutral-300" aria-hidden />
                      <span>Ingen sjekklistepunkter i malen.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                checklistItems.map((item) => (
                  <ChecklistTableRow
                    key={item.key}
                    item={item}
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
