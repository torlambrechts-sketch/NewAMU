// Single-field diff — spec §4.1. Two cards side by side, equal width,
// arrow between. Field label sits above the cards in uppercase tracking.

import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Diff } from '../../../lib/audit/diffShape'
import { SemanticValue } from './semanticValue'

type SingleFieldDiff = Extract<Diff, { kind: 'single_field' }>

export function DiffSingleField({ diff }: { diff: SingleFieldDiff }) {
  const { t } = useTranslation()
  const sameValue = diff.before.display === diff.after.display
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {diff.field_label_nb}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
        <DiffCard label={t('endringslogg.before', 'Før')}>
          <SemanticValue value={diff.before} />
        </DiffCard>
        <ArrowRight className="mt-6 h-4 w-4 text-neutral-400" aria-hidden />
        <DiffCard label={t('endringslogg.after', 'Etter')} highlight>
          <SemanticValue value={diff.after} />
        </DiffCard>
      </div>
      {sameValue ? (
        <p className="text-xs italic text-neutral-400">
          {t('endringslogg.unchanged', '(uendret)')}
        </p>
      ) : null}
    </div>
  )
}

function DiffCard({
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
