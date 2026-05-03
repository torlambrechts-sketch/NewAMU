import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

export type SelectOption = { value: string; label: string; suffix?: ReactNode }

type MenuPos = {
  top: number
  left: number
  width: number
  maxHeight: number
}

export function SearchableSelect({
  value,
  options,
  placeholder = 'Velg …',
  onChange,
  disabled,
  className,
  triggerClassName,
}: {
  value: string
  options: readonly SelectOption[]
  placeholder?: string
  onChange: (val: string) => void
  disabled?: boolean
  /** Optional class on the outer wrapper (e.g. table cells: `mt-0`). */
  className?: string
  /** Optional class on the trigger button (e.g. compact `py-1.5 text-xs`). */
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const filtered = filter
    ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
    : options

  /** Approximate height of filter row in px — keep in sync with padding + input */
  const FILTER_BAR_PX = 52

  const updateMenuPosition = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const edgePad = 8
    const maxList = 208
    const minList = 72

    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap - edgePad)
    const spaceAbove = Math.max(0, rect.top - gap - edgePad)

    const availBelow = Math.max(0, spaceBelow - FILTER_BAR_PX)
    const availAbove = Math.max(0, spaceAbove - FILTER_BAR_PX)

    const openAbove =
      (availAbove > availBelow && availAbove >= 48) ||
      (availBelow < minList && availAbove >= minList && availAbove > availBelow)

    if (openAbove) {
      const bodyMax = Math.min(maxList, Math.max(minList, availAbove))
      const totalH = FILTER_BAR_PX + bodyMax
      const top = rect.top - gap - totalH
      setMenuPos({
        top: Math.max(edgePad, top),
        left: rect.left,
        width: rect.width,
        maxHeight: bodyMax,
      })
    } else {
      const bodyMax = Math.min(maxList, availBelow < minList ? availBelow : Math.max(minList, availBelow))
      setMenuPos({
        top: rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: bodyMax,
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!open || disabled) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
  }, [open, disabled, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const onScrollResize = () => updateMenuPosition()
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    return () => {
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={wrapRef} className={twMerge('relative mt-1.5 w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((v) => !v)
            setFilter('')
          }
        }}
        className={twMerge(
          'flex w-full items-center justify-between border bg-white px-3 py-2.5',
          'text-left text-sm outline-none transition-colors',
          disabled ? 'cursor-not-allowed bg-neutral-50 opacity-60' : '',
          open
            ? 'border-[#1a3d32] ring-1 ring-[#1a3d32]/25'
            : 'border-neutral-300 hover:border-neutral-400',
          triggerClassName,
        )}
      >
        <span className={`flex min-w-0 items-center gap-2 ${selected ? 'text-neutral-900' : 'text-neutral-400'}`}>
          <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
          {selected?.suffix ?? null}
        </span>
        <ChevronDown
          className={[
            'h-4 w-4 shrink-0 transition-transform',
            open ? 'rotate-180 text-[#1a3d32]' : 'text-neutral-400',
          ].join(' ')}
        />
      </button>

      {open && !disabled && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[1000] border border-neutral-300 bg-white shadow-lg"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                maxHeight: menuPos.maxHeight + FILTER_BAR_PX,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div className="shrink-0 border-b border-neutral-200 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                  <input
                    autoFocus
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter..."
                    className="w-full border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[#1a3d32]/50"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-1" style={{ maxHeight: menuPos.maxHeight }}>
                {filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                    className={[
                      'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-neutral-50',
                      o.value === value
                        ? 'bg-neutral-100 font-medium text-neutral-900 border-l-2 border-[#1a3d32]'
                        : 'text-neutral-800 border-l-2 border-transparent',
                    ].join(' ')}
                  >
                    <span className="min-w-0 truncate">{o.label}</span>
                    {o.suffix ? <span className="shrink-0">{o.suffix}</span> : null}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-neutral-500">Ingen treff</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
