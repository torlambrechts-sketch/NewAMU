// Horizontal data-grid filter bar. Renders a row of <FilterChip>s
// supplied by the consumer, plus an optional saved-views control on
// the right.
//
// The bar is layout-only — it knows nothing about which filters exist,
// only how to lay them out and how to wire the saved-views dropdown +
// star to a useSavedViews() hook. Module pages compose by passing in
// the chips they need:
//
//   <FilterBar
//     chips={
//       <>
//         <FilterChip label="Kategori" … />
//         <FilterChip label="Status" … />
//         <FilterChip label="Mal" … />
//       </>
//     }
//     savedViews={savedViewsControl}
//     onReset={resetAll}
//     activeFilterCount={3}
//   />

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bookmark, Check, ChevronDown, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from './Button'
import { StandardInput } from './Input'
import type { SavedView, UseSavedViewsResult } from '../../hooks/useSavedViews'

export interface FilterBarProps {
  /** The <FilterChip> children. Rendered left-to-right with gap-2. */
  chips: ReactNode
  /** Saved-views control on the right edge (use <SavedViewsControl>). */
  savedViews?: ReactNode
  /** Optional reset-all button — shown when activeFilterCount > 0. */
  onReset?: () => void
  /** Number of currently-applied filters (drives "Tøm alle (N)"). */
  activeFilterCount?: number
  /** Extra slot on the far right (e.g. view-mode switcher). */
  trailing?: ReactNode
}

export function FilterBar({
  chips,
  savedViews,
  onReset,
  activeFilterCount = 0,
  trailing,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-white px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">{chips}</div>

      {activeFilterCount > 0 && onReset ? (
        <Button
          variant="ghost"
          onClick={onReset}
          className="h-auto rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          aria-label="Tøm alle filtre"
        >
          Tøm alle ({activeFilterCount})
        </Button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {savedViews}
        {trailing}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// SavedViewsControl — the dropdown + star + save button for picking
// and managing saved views. Encapsulates all the saved-views UI so
// FilterBar consumers just pass current filters + a useSavedViews()
// instance.
// ─────────────────────────────────────────────────────────────────────

export interface SavedViewsControlProps<Filters> {
  /** Current filter state — used when the user clicks "Save as new view". */
  currentFilters: Filters
  /** Active view id (the one currently applied), or null. */
  activeViewId: string | null
  /** Called when the user picks a view from the dropdown. */
  onApplyView: (view: SavedView<Filters>) => void
  /** Called after the user clears the selection (back to a custom state). */
  onClearActive: () => void
  /** The hook returned by useSavedViews(moduleSlug). */
  saved: UseSavedViewsResult<Filters>
  /** Whether the user has unsaved changes vs the active view. */
  hasUnsavedChanges?: boolean
}

export function SavedViewsControl<Filters>({
  currentFilters,
  activeViewId,
  onApplyView,
  onClearActive,
  saved,
  hasUnsavedChanges = false,
}: SavedViewsControlProps<Filters>) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeView = activeViewId ? saved.views.find((v) => v.id === activeViewId) : null
  const isDefault = activeViewId !== null && saved.defaultViewId === activeViewId

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      setOpen(false)
      setCreating(false)
      setNewName('')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (creating) {
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [creating])

  const triggerLabel = activeView
    ? hasUnsavedChanges
      ? `${activeView.name} *`
      : activeView.name
    : 'Tilpasset visning'

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const id = await saved.createView(name, currentFilters)
    if (id) {
      setCreating(false)
      setNewName('')
      // Apply the newly-created view so the chip name matches
      const created: SavedView<Filters> = {
        id,
        name,
        filters: currentFilters,
        createdBy: null,
        createdAt: new Date().toISOString(),
      }
      onApplyView(created)
    }
  }

  const handleStar = async () => {
    if (!activeViewId) return
    if (isDefault) {
      await saved.clearDefaultView()
    } else {
      await saved.setDefaultView(activeViewId)
    }
  }

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-1">
      {/* Star — pin/unpin the active view as my default landing */}
      <Button
        variant="ghost"
        size="icon"
        disabled={!activeViewId}
        onClick={handleStar}
        className={[
          'size-8 rounded-md transition-colors',
          isDefault
            ? 'text-[var(--color-atics-gold)] hover:bg-[color-mix(in_srgb,var(--color-atics-gold)_15%,white)]'
            : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700',
          !activeViewId ? 'cursor-not-allowed opacity-50' : '',
        ].join(' ')}
        title={
          !activeViewId
            ? 'Lagre visningen først for å sette som standard'
            : isDefault
              ? 'Standard — klikk for å fjerne'
              : 'Sett som min standard for denne modulen'
        }
        aria-label={
          isDefault ? 'Fjern som standardvisning' : 'Sett som standardvisning'
        }
        aria-pressed={isDefault}
      >
        <Star
          className="size-4"
          fill={isDefault ? 'currentColor' : 'none'}
          aria-hidden
        />
      </Button>

      {/* Dropdown trigger */}
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex h-auto items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
          open
            ? 'border-[var(--ui-accent)] ring-1 ring-[color-mix(in_srgb,var(--ui-accent)_25%,transparent)]'
            : activeViewId
              ? 'border-neutral-300 text-neutral-800'
              : 'border-dashed border-neutral-300 text-neutral-500 hover:border-neutral-400',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Bookmark className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate font-medium">{triggerLabel}</span>
        <ChevronDown
          className={['size-3.5 shrink-0 transition-transform', open ? 'rotate-180' : ''].join(' ')}
          aria-hidden
        />
      </Button>

      {open ? (
        <div
          className="absolute right-0 top-full z-[1000] mt-1 w-72 rounded-md border border-neutral-300 bg-white shadow-lg"
          role="listbox"
          aria-label="Lagrede visninger"
        >
          {saved.error ? (
            <p className="border-b border-neutral-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {saved.error}
            </p>
          ) : null}

          {saved.loading ? (
            <p className="px-3 py-4 text-center text-sm text-neutral-500">Laster…</p>
          ) : saved.views.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-neutral-500">
              Ingen lagrede visninger ennå.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {activeViewId !== null ? (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onClearActive()
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50"
                  >
                    <span className="size-4 shrink-0" aria-hidden />
                    <span className="italic">Tilpasset visning (ingen)</span>
                  </button>
                </li>
              ) : null}
              {saved.views.map((view) => {
                const isActive = view.id === activeViewId
                const isUserDefault = view.id === saved.defaultViewId
                return (
                  <li key={view.id} className="group flex items-center gap-1 px-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onApplyView(view)
                        setOpen(false)
                      }}
                      className={[
                        'flex flex-1 items-center gap-2 rounded px-1.5 py-2 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-[color-mix(in_srgb,var(--ui-accent)_10%,white)] text-neutral-900'
                          : 'text-neutral-800 hover:bg-neutral-50',
                      ].join(' ')}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {isActive ? (
                          <Check className="size-4 text-[var(--ui-accent)]" aria-hidden />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{view.name}</span>
                      {isUserDefault ? (
                        <Star
                          className="size-3.5 shrink-0 text-[var(--color-atics-gold)]"
                          fill="currentColor"
                          aria-label="Din standard"
                        />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (confirm(`Slette visningen «${view.name}»?`)) {
                          await saved.deleteView(view.id)
                        }
                      }}
                      className="invisible size-7 shrink-0 rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-600 group-hover:visible"
                      aria-label={`Slett «${view.name}»`}
                      title="Slett"
                    >
                      <Trash2 className="mx-auto size-3.5" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Save-as-new section */}
          <div className="border-t border-neutral-100 bg-neutral-50/60 p-2">
            {creating ? (
              <div className="flex items-center gap-2">
                <StandardInput
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleCreate()
                    }
                  }}
                  placeholder="Navn på visningen…"
                  className="flex-1 !py-1.5 !text-sm"
                  maxLength={80}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                >
                  Lagre
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreating(false)
                    setNewName('')
                  }}
                >
                  Avbryt
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setCreating(true)}
                className="inline-flex h-auto w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-[var(--ui-accent)] hover:bg-white"
              >
                <Plus className="size-3.5 shrink-0" aria-hidden />
                Lagre nåværende filtre som ny visning
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
