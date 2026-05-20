import { useMemo } from 'react'
import DiffMatchPatch from 'diff-match-patch'
import type { ContentBlock, WikiPageVersionSnapshot } from '../../types/documents'

/**
 * Side-by-side version diff (Claude Design "Rec07 — Versjonshistorikk").
 *
 * Left column = older version (deletions highlighted red), right column =
 * newer version (insertions highlighted green), with a comparison bar that
 * summarises how much changed. Plain-text diff via diff-match-patch.
 */

function blockToText(block: ContentBlock): string {
  switch (block.kind) {
    case 'text':
      return block.body.replace(/<[^>]+>/g, '')
    case 'heading':
      return block.text
    case 'alert':
      return block.text
    case 'law_ref':
      return `${block.ref}: ${block.description}`
    case 'image':
      return block.caption ?? ''
    case 'table': {
      const cap = block.caption?.trim() ? `${block.caption}\n` : ''
      const head = block.headers.join('\t')
      const body = block.rows.map((r) => r.join('\t')).join('\n')
      return `${cap}${head}\n${body}`
    }
    case 'divider':
      return '───'
    case 'module':
      return `[${block.moduleName}]`
    default: {
      const _exhaustive: never = block
      return _exhaustive
    }
  }
}

function snapshotToPlain(snapshot: WikiPageVersionSnapshot): string {
  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : []
  return blocks.map(blockToText).join('\n\n')
}

type DiffSegment = [number, string]

function DiffColumn({
  version,
  segments,
  side,
}: {
  version: WikiPageVersionSnapshot
  segments: DiffSegment[]
  side: 'left' | 'right'
}) {
  const isLeft = side === 'left'
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div
        className={`flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-xs ${
          isLeft ? 'bg-red-50/50' : 'bg-emerald-50/50'
        }`}
      >
        <p className="font-semibold text-neutral-800">
          v{version.version} · {isLeft ? 'eldre' : 'nyere'}
        </p>
        <p className="text-neutral-500">
          {version.frozenAt
            ? new Date(version.frozenAt).toLocaleDateString('nb-NO')
            : '—'}
        </p>
      </div>
      <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-[13px] leading-relaxed">
        {segments.map(([op, text], i) => {
          if (op === 0) {
            return (
              <span key={i} className="text-neutral-700">
                {text}
              </span>
            )
          }
          if (op === -1) {
            return isLeft ? (
              <span key={i} className="rounded-sm bg-red-100 text-red-800 line-through decoration-red-400">
                {text}
              </span>
            ) : null
          }
          return isLeft ? null : (
            <span key={i} className="rounded-sm bg-emerald-100 text-emerald-900">
              {text}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function WikiVersionDiff({
  versionA,
  versionB,
}: {
  /** Older version. */
  versionA: WikiPageVersionSnapshot
  /** Newer version. */
  versionB: WikiPageVersionSnapshot
}) {
  const { segments, added, removed } = useMemo(() => {
    const dmp = new DiffMatchPatch()
    const diffs = dmp.diff_main(snapshotToPlain(versionA), snapshotToPlain(versionB)) as DiffSegment[]
    dmp.diff_cleanupSemantic(diffs)
    let add = 0
    let rem = 0
    for (const [op, text] of diffs) {
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      if (op === 1) add += words
      else if (op === -1) rem += words
    }
    return { segments: diffs, added: add, removed: rem }
  }, [versionA, versionB])

  return (
    <div className="space-y-3">
      {/* Comparison bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm">
        <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
          v{versionA.version}
        </span>
        <span className="text-neutral-400" aria-hidden>
          →
        </span>
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          v{versionB.version}
        </span>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-emerald-300 bg-emerald-200" />
            {added} ord lagt til
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-red-300 bg-red-200" />
            {removed} ord fjernet
          </span>
        </div>
      </div>

      {/* Side-by-side columns */}
      <div className="grid gap-3 lg:grid-cols-2">
        <DiffColumn version={versionA} segments={segments} side="left" />
        <DiffColumn version={versionB} segments={segments} side="right" />
      </div>
    </div>
  )
}
