// Lightweight popover for chip-editing.
//
// When a chip is clicked, the parent toggles `open`. This component renders
// an absolutely-positioned card with form fields. Esc closes (handled in
// the parent via onClose). The popover stays in-flow visually as a card
// under the chip — no portals (the existing dashboards/popover work shows
// portals are overkill for this density).

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../ui/Button'

export function ChipPopover({
  open,
  title,
  onClose,
  children,
  width = 'w-[min(28rem,90vw)]',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      className={`absolute z-40 mt-2 ${width} rounded-xl border border-neutral-200 bg-white p-4 shadow-xl`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</h4>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Lukk"
          className="rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  )
}
