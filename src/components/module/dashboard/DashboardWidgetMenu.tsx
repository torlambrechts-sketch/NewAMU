// DashboardWidgetMenu — popover menu rendered from each widget's
// "..." button. Three actions: Edit / Duplicate / Remove. Closes on
// outside click or Escape.

import { useEffect, useRef, useState } from 'react'
import { Copy, Download, Edit3, MoreHorizontal, Trash2 } from 'lucide-react'

type Props = {
  onEdit: () => void
  onDuplicate?: () => void
  onRemove?: () => void
  onExportCsv?: () => void
  ariaLabel?: string
}

export function DashboardWidgetMenu({ onEdit, onDuplicate, onRemove, onExportCsv, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (!popRef.current) return
      if (!popRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // pointerdown fires for both mouse and touch; mousedown alone misses
    // taps on touch devices and the popover stays open after tap-outside.
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={popRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel ?? 'Widget-meny'}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50"
          >
            <Edit3 className="h-4 w-4 text-neutral-500" aria-hidden />
            Rediger
          </button>
          {onDuplicate ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onDuplicate()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50"
            >
              <Copy className="h-4 w-4 text-neutral-500" aria-hidden />
              Dupliser
            </button>
          ) : null}
          {onExportCsv ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onExportCsv()
              }}
              className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50"
            >
              <Download className="h-4 w-4 text-neutral-500" aria-hidden />
              Eksporter CSV
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onRemove()
              }}
              className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Fjern
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
