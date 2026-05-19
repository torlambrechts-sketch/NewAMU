// Word-level text diff — spec §4.4.
//
// Uses diff-match-patch (already in deps) to compute a word-granular
// patch. Renders deletions with red strikethrough, insertions with
// green underline, unchanged text in default colour. Constrained to a
// max-height with a "Vis hele" expander; long blocks open in a modal
// when needed (modal deferred to P3 — until then the expander just
// removes the clamp).

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DiffMatchPatch from 'diff-match-patch'
import type { Diff as AuditDiff } from '../../../lib/audit/diffShape'
import { Button } from '../../ui/Button'

type TextBlockDiff = Extract<AuditDiff, { kind: 'text_block' }>

const DMP = new DiffMatchPatch()

type Segment = { op: -1 | 0 | 1; text: string }

// diff-match-patch ships character-level; for human-readable text the
// library recommends word-level cleanup which we do via its built-in
// diff_cleanupSemantic helper. Good enough for v1; full word-aware
// tokenisation can land later.
function computeSegments(before: string, after: string): Segment[] {
  const dmp = DMP
  const raw = dmp.diff_main(before, after)
  dmp.diff_cleanupSemantic(raw)
  return raw.map(([op, text]) => ({ op: op as -1 | 0 | 1, text }))
}

export function DiffTextBlock({ diff }: { diff: TextBlockDiff }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const segments = useMemo(() => computeSegments(diff.before, diff.after), [diff.before, diff.after])

  const len = diff.before.length + diff.after.length

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {diff.field_label_nb}
      </p>
      <div
        className="rounded-md border border-neutral-200 bg-white p-3 text-sm leading-relaxed text-neutral-800"
        style={!expanded && len > 600 ? { maxHeight: 280, overflow: 'hidden' } : undefined}
      >
        {segments.map((seg, idx) => (
          <SegmentSpan key={idx} segment={seg} />
        ))}
      </div>
      {len > 600 && !expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-xs font-medium text-indigo-700 hover:text-indigo-900"
          onClick={() => setExpanded(true)}
        >
          {t('endringslogg.viewFull', 'Vis hele')}
        </Button>
      ) : null}
    </div>
  )
}

function SegmentSpan({ segment }: { segment: Segment }) {
  if (segment.op === 1) {
    return (
      <span className="bg-green-50 text-green-900 underline decoration-green-400 decoration-1">
        {segment.text}
      </span>
    )
  }
  if (segment.op === -1) {
    return (
      <span className="bg-red-50 text-red-900 line-through decoration-red-400 decoration-1">
        {segment.text}
      </span>
    )
  }
  return <span>{segment.text}</span>
}
