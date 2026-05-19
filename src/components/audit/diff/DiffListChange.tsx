// list_change diff — spec §4.3. One field, with added/removed entries
// listed side-by-side using explicit + / − glyphs. Long lists collapse
// the middle with "… og N flere".

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Diff } from '../../../lib/audit/diffShape'
import { SemanticValue } from './semanticValue'
import { Button } from '../../ui/Button'

type ListChangeDiff = Extract<Diff, { kind: 'list_change' }>

const SOFT_CAP = 6

export function DiffListChange({ diff }: { diff: ListChangeDiff }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const total = diff.added.length + diff.removed.length
  const overflowing = !expanded && total > SOFT_CAP

  // When capped, show first N/2 from each side; the rest hide behind
  // the expander. Stable order preserved.
  const half = Math.floor(SOFT_CAP / 2)
  const visibleAdded = overflowing ? diff.added.slice(0, half) : diff.added
  const visibleRemoved = overflowing ? diff.removed.slice(0, half) : diff.removed
  const hiddenCount = total - visibleAdded.length - visibleRemoved.length

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {diff.field_label_nb}
      </p>
      <div className="overflow-hidden rounded-md border border-neutral-200">
        {visibleAdded.map((v, idx) => (
          <div
            key={`add-${idx}`}
            className="flex items-center gap-2 border-b border-green-100 bg-green-50/60 px-3 py-1.5 text-sm last:border-b-0"
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-green-700" aria-hidden />
            <span className="sr-only">Lagt til:</span>
            <SemanticValue value={v} />
          </div>
        ))}
        {visibleRemoved.map((v, idx) => (
          <div
            key={`rem-${idx}`}
            className="flex items-center gap-2 border-b border-red-100 bg-red-50/60 px-3 py-1.5 text-sm last:border-b-0"
          >
            <Minus className="h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden />
            <span className="sr-only">Fjernet:</span>
            <span className="line-through decoration-red-400">
              <SemanticValue value={v} />
            </span>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-1.5 text-xs italic text-neutral-500">
            … og {hiddenCount} flere
          </div>
        ) : null}
      </div>
      {overflowing ? (
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-xs font-medium text-indigo-700 hover:text-indigo-900"
          onClick={() => setExpanded(true)}
        >
          {t('endringslogg.showMore', { count: hiddenCount, defaultValue: `Vis ${hiddenCount} flere` })}
        </Button>
      ) : null}
    </div>
  )
}
