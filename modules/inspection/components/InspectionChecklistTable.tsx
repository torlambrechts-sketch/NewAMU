import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, Ghost } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { Button } from '../../../src/components/ui/Button'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import type { InspectionFieldType } from '../types'

export type InspectionChecklistTableRow = {
  key: string
  label: string
  helpText?: string
  categoryLabel: string
  fieldType?: InspectionFieldType
  required?: boolean
  value: string
  completed: boolean
}

const YES_NO_OPTIONS = [
  { value: '', label: '—' },
  { value: 'yes', label: 'Ja' },
  { value: 'no', label: 'Nei' },
  { value: 'na', label: 'N/A' },
]

type AnswerCellProps = {
  row: InspectionChecklistTableRow
  readOnly: boolean
  onUpdateItem: (key: string, value: string) => void | Promise<void>
}

function ChecklistAnswerCell({ row, readOnly, onUpdateItem }: AnswerCellProps) {
  const field = row.fieldType === 'photo_required' ? 'photo' : row.fieldType ?? 'yes_no_na'
  const [local, setLocal] = useState(row.value)

  useEffect(() => {
    setLocal(row.value)
  }, [row.key, row.value])

  const flush = useCallback(
    async (next: string) => {
      if (next === row.value) return
      await onUpdateItem(row.key, next)
    },
    [onUpdateItem, row.key, row.value],
  )

  if (field === 'photo' || field === 'signature') {
    return <span className="text-xs italic text-neutral-400">{field === 'signature' ? 'Signatur' : 'Foto'} — ikke her</span>
  }

  if (field === 'yes_no_na') {
    return (
      <SearchableSelect
        value={local}
        options={YES_NO_OPTIONS}
        disabled={readOnly}
        onChange={(v) => {
          setLocal(v)
          void flush(v)
        }}
      />
    )
  }

  if (field === 'number') {
    return (
      <StandardInput
        type="number"
        readOnly={readOnly}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => void flush(local)}
        className="max-w-[10rem]"
      />
    )
  }

  /* text and default */
  return (
    <StandardTextarea
      readOnly={readOnly}
      rows={2}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => void flush(local)}
      placeholder="Skriv svar…"
      className="resize-none text-sm"
    />
  )
}

export type InspectionChecklistTableProps = {
  rows: InspectionChecklistTableRow[]
  readOnly: boolean
  onUpdateItem: (key: string, value: string) => void | Promise<void>
  onRegisterFinding: (itemKey: string) => void
}

export function InspectionChecklistTable({ rows, readOnly, onUpdateItem, onRegisterFinding }: InspectionChecklistTableProps) {
  const colCount = 5

  return (
    <LayoutTable1PostingsShell
      wrap={false}
      titleTypography="sans"
      title="Sjekkpunkter"
      toolbar={<span className="text-sm text-neutral-500">Utfør sjekklisten punkt for punkt</span>}
    >
      <table className="w-full min-w-0 border-collapse text-left text-sm">
        <thead>
          <tr className={`${LAYOUT_TABLE1_POSTINGS_HEADER_ROW} bg-neutral-50`}>
            <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-14`}>Status</th>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Sjekkpunkt</th>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Svar</th>
            <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-44`}>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
              <td className="px-5 py-12 text-center align-middle" colSpan={colCount}>
                <div className="flex flex-col items-center justify-center gap-2 text-neutral-500">
                  <Ghost className="h-10 w-10 text-neutral-300" aria-hidden />
                  <p className="text-sm font-medium text-neutral-600">Ingen sjekklistepunkter</p>
                  <p className="max-w-sm text-xs text-neutral-500">Malen inneholder ingen punkter å gjennomføre.</p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const done = row.completed || row.value.length > 0
              const field = row.fieldType === 'photo_required' ? 'photo' : row.fieldType ?? 'yes_no_na'
              const showFindingCta = !readOnly && field === 'yes_no_na' && row.value === 'no'

              return (
                <tr key={row.key} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                  <td className="px-5 py-4 align-middle">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-label="Besvart" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-neutral-300" aria-label="Venter" />
                    )}
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">{row.label}</p>
                      {row.helpText ? <p className="mt-0.5 text-xs text-neutral-500">{row.helpText}</p> : null}
                      {row.required ? (
                        <span className="mt-1 inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600">
                          Påkrevd
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle text-neutral-700">{row.categoryLabel}</td>
                  <td className="px-5 py-4 align-middle">
                    <ChecklistAnswerCell row={row} readOnly={readOnly} onUpdateItem={onUpdateItem} />
                  </td>
                  <td className="px-5 py-4 align-middle">
                    {showFindingCta ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onRegisterFinding(row.key)}>
                        Registrer avvik
                      </Button>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </LayoutTable1PostingsShell>
  )
}
