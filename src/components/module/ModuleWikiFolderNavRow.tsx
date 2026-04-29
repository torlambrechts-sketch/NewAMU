import type { DragEvent, ReactNode } from 'react'
import { Folder } from 'lucide-react'

/** Beige folder nav — matches wiki dokument-hub (`ModuleDocumentsKandidatdetaljHub`). */
export const BEIGE_NAV = '#EDE4D3'

export const WIKI_FOLDER_NAV_FOREST = '#1a3d32'

/** Folder glyph size — shared with dokument-tabellrader. */
export const WIKI_FOLDER_ICON_CLASS = 'size-3.5 shrink-0 text-neutral-500'

export type WikiFolderNavRowProps = {
  label: string
  sub: string
  active: boolean
  highlightDrop?: boolean
  onSelect: () => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: (e: DragEvent) => void
  actions?: ReactNode
}

/**
 * Single folder row in the beige wiki sidebar (mapper under dokumenter).
 * Shared by dokument-hub og undersøkelsesbygger for konsistent utseende.
 */
export function WikiFolderNavRow({
  label,
  sub,
  active,
  highlightDrop,
  onSelect,
  onDragOver,
  onDrop,
  actions,
}: WikiFolderNavRowProps) {
  return (
    <div
      className={`mb-0.5 flex w-full items-stretch gap-0.5 rounded-md transition ${
        highlightDrop
          ? 'bg-emerald-50 ring-2 ring-[#1a3d32]/30'
          : active
            ? 'bg-white/70 text-neutral-900 shadow-sm'
            : 'text-neutral-600 hover:bg-white/40'
      }`}
      style={active && !highlightDrop ? { boxShadow: `inset 3px 0 0 ${WIKI_FOLDER_NAV_FOREST}` } : undefined}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 rounded-md px-3 py-2.5 text-left"
        aria-current={active ? 'true' : undefined}
      >
        <span className="flex items-start gap-2">
          <Folder className={`${WIKI_FOLDER_ICON_CLASS} mt-0.5`} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{label}</span>
            <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{sub}</span>
          </span>
        </span>
      </button>
      {actions ? (
        <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-neutral-200/50 py-1 pr-1">{actions}</div>
      ) : null}
    </div>
  )
}
