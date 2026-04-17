import { useMemo } from 'react'
import { X } from 'lucide-react'
import type { Block, WikiPageVersionSnapshot } from '../../types/documents'
import { diffBlockSummaries, diffWordsInline, type LineDiffOp } from '../../lib/wikiPageContent'

type Props = {
  open: boolean
  onClose: () => void
  currentVersion: number
  currentBlocks: Block[]
  previous: WikiPageVersionSnapshot | null
}

function stripKindPrefix(line: string): { kind: string; body: string } {
  const m = /^\[([^\]]+)\]\s*(.*)$/.exec(line)
  if (m) return { kind: m[1]!, body: m[2] ?? '' }
  return { kind: '', body: line }
}

function renderWordOps(ops: ReturnType<typeof diffWordsInline>) {
  return (
    <span className="font-mono text-[11px] leading-relaxed">
      {ops.map((op, i) => {
        if (op.type === 'same') return <span key={i}>{op.text}</span>
        if (op.type === 'add') return <mark key={i} className="bg-emerald-200/90 text-emerald-950">{op.text}</mark>
        return <del key={i} className="bg-red-200/80 text-red-950">{op.text}</del>
      })}
    </span>
  )
}

type Row =
  | { type: 'same'; text: string }
  | { type: 'add'; text: string }
  | { type: 'remove'; text: string }
  | { type: 'modified'; kind: string; wordOps: ReturnType<typeof diffWordsInline>; oldLine: string; newLine: string }

function buildRows(ops: LineDiffOp[]): Row[] {
  const rows: Row[] = []
  for (let i = 0; i < ops.length; i++) {
    const cur = ops[i]!
    if (cur.type === 'remove' && ops[i + 1]?.type === 'add') {
      const nxt = ops[i + 1]!
      const a = stripKindPrefix(cur.text)
      const b = stripKindPrefix(nxt.text)
      if (a.kind && a.kind === b.kind) {
        rows.push({
          type: 'modified',
          kind: a.kind,
          wordOps: diffWordsInline(a.body, b.body),
          oldLine: cur.text,
          newLine: nxt.text,
        })
        i += 1
        continue
      }
    }
    if (cur.type === 'same') rows.push({ type: 'same', text: cur.text })
    else if (cur.type === 'add') rows.push({ type: 'add', text: cur.text })
    else rows.push({ type: 'remove', text: cur.text })
  }
  return rows
}

export function WikiVersionDiffModal({ open, onClose, currentVersion, currentBlocks, previous }: Props) {
  const rows = useMemo(() => {
    if (!previous) return []
    return buildRows(diffBlockSummaries(previous.blocks, currentBlocks))
  }, [previous, currentBlocks])

  if (!open || !previous) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/50 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wiki-diff-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[min(85vh,720px)] w-full max-w-2xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 id="wiki-diff-title" className="text-sm font-semibold text-neutral-900">
            Vis endringer · v{previous.version} → v{currentVersion}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Lukk">
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[calc(85vh-4rem)] overflow-y-auto p-4 text-sm">
          <p className="mb-3 text-xs text-neutral-500">
            Blokk-for-blokk sammenligning. Grønt = nytt, rødt = fjernet, gult markering = ord endret innenfor samme blokktype.
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-600">Ingen tekstforskjeller i blokksammendrag.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row, idx) => {
                if (row.type === 'same') {
                  return (
                    <li key={idx} className="rounded border border-neutral-100 bg-neutral-50/80 px-2 py-1.5 text-xs text-neutral-600">
                      {row.text}
                    </li>
                  )
                }
                if (row.type === 'remove') {
                  return (
                    <li key={idx} className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-900">
                      <span className="font-semibold">Fjernet: </span>
                      {row.text}
                    </li>
                  )
                }
                if (row.type === 'add') {
                  return (
                    <li key={idx} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-950">
                      <span className="font-semibold">Lagt til: </span>
                      {row.text}
                    </li>
                  )
                }
                return (
                  <li key={idx} className="rounded border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-xs text-amber-950">
                    <span className="font-semibold">Endret [{row.kind}]: </span>
                    {renderWordOps(row.wordOps)}
                    <details className="mt-1 text-[10px] text-neutral-500">
                      <summary className="cursor-pointer">Vis fulle linjer</summary>
                      <p className="mt-1 font-mono text-[10px] text-red-800 line-through">{row.oldLine}</p>
                      <p className="font-mono text-[10px] text-emerald-800">{row.newLine}</p>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
