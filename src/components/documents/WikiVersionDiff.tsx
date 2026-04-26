import { useMemo } from 'react'
import DiffMatchPatch from 'diff-match-patch'
import type { ContentBlock, WikiPageVersionSnapshot } from '../../types/documents'

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

export function WikiVersionDiff({
  versionA,
  versionB,
}: {
  versionA: WikiPageVersionSnapshot
  versionB: WikiPageVersionSnapshot
}) {
  const segments = useMemo(() => {
    const dmp = new DiffMatchPatch()
    const diffs = dmp.diff_main(snapshotToPlain(versionA), snapshotToPlain(versionB))
    dmp.diff_cleanupSemantic(diffs)
    return diffs
  }, [versionA, versionB])

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm">
      <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-wide text-neutral-500">
        v{versionA.version} → v{versionB.version}
      </p>
      <div className="whitespace-pre-wrap break-words">
        {segments.map(([op, text], i) =>
          op === 0 ? (
            <span key={i} className="text-neutral-700">
              {text}
            </span>
          ) : op === -1 ? (
            <span key={i} className="bg-red-100 text-red-700 line-through">
              {text}
            </span>
          ) : (
            <span key={i} className="bg-emerald-100 text-emerald-800">
              {text}
            </span>
          ),
        )}
      </div>
    </div>
  )
}
