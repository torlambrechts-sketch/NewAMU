// Multi-select filter dropdown. Pairs with FilterBar to build data-grid
// filter rows (Sjekklister, Avvik, Undersøkelser, …). The trigger style
// mirrors <SearchableSelect> so the two look like siblings; the menu
// uses the same portal + position-aware logic, but with checkbox rows
// and selection accumulators.
//
// Pattern:
//   <FilterChip
//     label="Status"
//     options={[{ value: 'pågår', label: 'Pågår' }, …]}
//     value={selectedValues}
//     onChange={setSelectedValues}
//   />
//
// Empty `value` reads as "no filter" (matches all). Selecting an option
// adds it; selecting again removes. A clear-X appears when ≥1 selected.

import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

export type FilterOption = {
  value: string
  label: string
  /** Optional count rendered to the right of the label. */
  count?: number
  /** Optional icon node before the label. */
  icon?: ReactNode
}

export interface FilterChipProps {
  /** Short noun for the filter (e.g. "Status"). Used in the trigger label. */
  label: string
  options: readonly FilterOption[]
  value: readonly string[]
  onChange: (next: string[]) => void
  /** Search placeholder. Defaults to `Filter <label.toLowerCase()>…`. */
  searchPlaceholder?: string
  /** Disable the trigger entirely. */
  disabled?: boolean
  className?: string
  triggerClassName?: string
}

type MenuPos = {
  top: number
  left: number
  width: number
  maxHeight: number
}

const FILTER_BAR_PX = 52

export function FilterChip({
  label,
  options,
  value,
  onChange,
  searchPlaceholder,
  disabled,
  className,
  triggerClassName,
}: FilterChipProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedSet = new Set(value)
  const selectedCount = value.length
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Trigger label: "Status: Alle" / "Status: Pågår" / "Status: 2"
  const triggerSummary =
    selectedCount === 0
      ? 'Alle'
      : selectedCount === 1
        ? (options.find((o) => o.value === value[0])?.label ?? '1')
        : `${selectedCount}`

  const toggle = (val: string) => {
    if (selectedSet.has(val)) {
      onChange(value.filter((v) => v !== val))
    } else {
      onChange([...value, val])
    }
  }

  const clear = () => {
    onChange([])
  }

  const updateMenuPosition = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const edgePad = 8
    const maxList = 260
    const minList = 96
    const minMenuWidth = Math.max(rect.width, 240)

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
        width: minMenuWidth,
        maxHeight: bodyMax,
      })
    } else {
      const bodyMax = Math.min(maxList, availBelow < minList ? availBelow : Math.max(minList, availBelow))
      setMenuPos({
        top: rect.bottom + gap,
        left: rect.left,
        width: minMenuWidth,
        maxHeight: bodyMax,
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!open || disabled) {
      // Portal positioning state — synchronising DOM measurements
      // with React state is exactly what the lint rule was named
      // before "you might not need an effect". The alternative is
      // useSyncExternalStore, which is overkill for a single popover.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isActive = selectedCount > 0

  return (
    <div ref={wrapRef} className={twMerge('relative inline-block', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
          setQuery('')
        }}
        className={twMerge(
          'inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ui-accent)_25%,transparent)]',
          disabled ? 'cursor-not-allowed bg-neutral-50 opacity-60' : '',
          open
            ? 'border-[var(--ui-accent)] ring-1 ring-[color-mix(in_srgb,var(--ui-accent)_25%,transparent)]'
            : isActive
              ? 'border-[var(--ui-accent)] text-neutral-900'
              : 'border-neutral-300 text-neutral-700 hover:border-neutral-400',
          triggerClassName,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-medium text-neutral-600">{label}:</span>
        <span className={isActive ? 'font-semibold text-neutral-900' : 'text-neutral-500'}>
          {triggerSummary}
        </span>
        {isActive ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Tøm ${label.toLowerCase()}`}
            onClick={(e) => {
              e.stopPropagation()
              clear()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                clear()
              }
            }}
            className="ml-0.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-3" aria-hidden />
          </span>
        ) : (
          <ChevronDown
            className={['size-3.5 shrink-0 transition-transform', open ? 'rotate-180 text-[var(--ui-accent)]' : 'text-neutral-400'].join(' ')}
            aria-hidden
          />
        )}
      </button>

      {open && !disabled && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[1000] rounded-md border border-neutral-300 bg-white shadow-lg"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                maxHeight: menuPos.maxHeight + FILTER_BAR_PX,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
              role="listbox"
              aria-multiselectable
              aria-label={label}
            >
              <div className="shrink-0 border-b border-neutral-200 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder ?? `Filtrer ${label.toLowerCase()}…`}
                    className="w-full rounded border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[color-mix(in_srgb,var(--ui-accent)_50%,transparent)]"
                  />
                </div>
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto py-1"
                style={{ maxHeight: menuPos.maxHeight }}
              >
                {filtered.map((o) => {
                  const checked = selectedSet.has(o.value)
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(o.value)}
                      className={[
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                        checked
                          ? 'bg-[color-mix(in_srgb,var(--ui-accent)_10%,white)] text-neutral-900'
                          : 'text-neutral-800 hover:bg-neutral-50',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                          checked
                            ? 'border-[var(--ui-accent)] bg-[var(--ui-accent)] text-white'
                            : 'border-neutral-300 bg-white',
                        ].join(' ')}
                        aria-hidden
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                      {o.icon ? <span className="shrink-0">{o.icon}</span> : null}
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {typeof o.count === 'number' ? (
                        <span className="shrink-0 text-xs text-neutral-500 tabular-nums">{o.count}</span>
                      ) : null}
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-neutral-500">Ingen treff</p>
                )}
              </div>
              {selectedCount > 0 && (
                <div className="shrink-0 border-t border-neutral-100 bg-neutral-50/60 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={clear}
                    className="w-full rounded px-2 py-1 text-left text-xs font-medium text-neutral-600 hover:bg-white hover:text-neutral-900"
                  >
                    Tøm {label.toLowerCase()} ({selectedCount})
                  </button>
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
