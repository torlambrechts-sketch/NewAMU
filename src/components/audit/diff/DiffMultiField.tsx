// Multi-field diff — spec §4.2. Each change is its own field-label +
// two-card pair. Caps at 3 visible changes by default with a
// "Vis N flere endringer" expander.

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Diff } from '../../../lib/audit/diffShape'
import { SemanticValue } from './semanticValue'
import { Button } from '../../ui/Button'

type MultiFieldDiff = Extract<Diff, { kind: 'multi_field' }>

const DEFAULT_VISIBLE = 3

export function DiffMultiField({ diff }: { diff: MultiFieldDiff }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const total = diff.changes.length
  const visible = expanded ? total : Math.min(DEFAULT_VISIBLE, total)
  const hiddenCount = total - visible

  return (
    <div className="space-y-4">
      {diff.changes.slice(0, visible).map((change, idx) => {
        const same = change.before.display === change.after.display
        return (
          <div key={`${change.field_label_nb}-${idx}`} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {change.field_label_nb}
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
              <Card label={t('endringslogg.before', 'Før')}>
                <SemanticValue value={change.before} />
              </Card>
              <ArrowRight className="mt-6 h-4 w-4 text-neutral-400" aria-hidden />
              <Card label={t('endringslogg.after', 'Etter')} highlight>
                <SemanticValue value={change.after} />
              </Card>
            </div>
            {same ? (
              <p className="text-xs italic text-neutral-400">
                {t('endringslogg.unchanged', '(uendret)')}
              </p>
            ) : null}
          </div>
        )
      })}
      {hiddenCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-xs font-medium text-indigo-700 hover:text-indigo-900"
          onClick={() => setExpanded(true)}
        >
          {t('endringslogg.showMore', { count: hiddenCount, defaultValue: `Vis ${hiddenCount} flere endringer` })}
        </Button>
      ) : null}
      {expanded && total > DEFAULT_VISIBLE ? (
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
          onClick={() => setExpanded(false)}
        >
          {t('endringslogg.showLess', 'Vis færre')}
        </Button>
      ) : null}
    </div>
  )
}

function Card({
  label,
  highlight,
  children,
}: {
  label: string
  highlight?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        highlight ? 'border-neutral-300 bg-white' : 'border-neutral-200 bg-neutral-50/60'
      }`}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <div>{children}</div>
    </div>
  )
}
