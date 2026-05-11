// MandatoryGapsNoticePanel — expandable amber notice listing agenda items
// missing protokoll-content. Renders the same visual shell as
// `WorkplaceNoticePanel variant="warning"` (the "Boks — advarsel
// (liste)" block from /platform-admin/layout), but collapsed by default
// to one row showing the count + a chevron toggle.

import { useState } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import {
  WORKPLACE_LAYOUT_BOX_CARD,
  WORKPLACE_LAYOUT_BOX_SHADOW,
} from '../../../src/components/layout/workplaceLayoutKit'

export type MandatoryGapsNoticePanelProps = {
  gaps: string[]
  /** Initial open/closed state. Default closed. */
  defaultOpen?: boolean
}

export function MandatoryGapsNoticePanel({
  gaps,
  defaultOpen = false,
}: MandatoryGapsNoticePanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  if (gaps.length === 0) return null

  const visible = gaps.slice(0, 5)
  const overflow = gaps.length - visible.length

  return (
    <div className={WORKPLACE_LAYOUT_BOX_CARD} style={WORKPLACE_LAYOUT_BOX_SHADOW}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mandatory-gaps-list"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-50/40"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Obligatoriske saker mangler innhold
            </span>
            <span className="text-sm text-neutral-800">
              {gaps.length} sak{gaps.length === 1 ? '' : 'er'} må fylles ut før signering.
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
            {gaps.length}
          </span>
          <ChevronDown
            className={`size-4 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <ul id="mandatory-gaps-list" className="divide-y divide-neutral-100 border-t border-neutral-100">
          {visible.map((title, idx) => (
            <li key={`${idx}-${title}`} className="flex gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-800">{title}</p>
                <p className="mt-1 text-xs text-neutral-400">Må fylles ut før signering</p>
              </div>
            </li>
          ))}
          {overflow > 0 ? (
            <li className="flex gap-3 px-4 py-3 text-xs text-neutral-500">
              <span className="size-9 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">… og {overflow} til</span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
