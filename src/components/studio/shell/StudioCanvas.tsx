// StudioCanvas — shared 3-column builder layout used by every scope's
// Advanced mode. Replaces the per-scope free-form embedders so the
// visual + structural surface is identical across all 8 scopes.
//
// Layout (lg+):
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Header: title  · review chip · save / publish actions        │
//   ├────────────┬───────────────────────────────────┬─────────────┤
//   │ Items      │ Main editor                       │ Properties  │
//   │ (left)     │ (center; per-scope content)       │ (right)     │
//   │            │                                   │             │
//   │ + Ny item  │ ...                               │ ...         │
//   └────────────┴───────────────────────────────────┴─────────────┘
//
// Below lg: stacks vertically (items → editor → properties).
//
// Scopes plug in by providing a StudioCanvasAdapter — items list,
// renderEditor, renderProperties, onAddItem, onRemoveItem, etc.

import type { ReactNode } from 'react'
import { Button } from '../../ui/Button'
import { Plus } from 'lucide-react'

export type StudioCanvasAdapter<TItem> = {
  /** The items shown in the left column. */
  items: TItem[]
  /** Stable id extractor used for React keys + selection. */
  getItemId: (item: TItem) => string
  /** Short label shown for each item in the left list. */
  renderItemLabel: (item: TItem) => ReactNode
  /** Center column — full editor for the currently selected item. */
  renderEditor: (selected: TItem | null) => ReactNode
  /** Right column — per-item properties (or scope-level if no selection). */
  renderProperties: (selected: TItem | null) => ReactNode
  /** Selected item id, or null. */
  selectedId: string | null
  /** Called when user clicks an item in the left list. */
  onSelect: (id: string) => void
  /** Optional add-item action. */
  onAddItem?: () => void
  /** Label for the add-item button (defaults to "+ Ny"). */
  addLabel?: string
  /** Empty-state shown when items.length === 0. */
  emptyState?: ReactNode
}

export type StudioCanvasProps<TItem> = {
  /** Center-column title (e.g. "Sjekkliste-mal · HMS-grunnmur"). */
  title: ReactNode
  /** Optional subtitle / metadata under the title. */
  subtitle?: ReactNode
  /** Right side of the header — status chip + save Buttons. */
  headerActions?: ReactNode
  adapter: StudioCanvasAdapter<TItem>
}

export function StudioCanvas<TItem>({ title, subtitle, headerActions, adapter }: StudioCanvasProps<TItem>) {
  const {
    items,
    getItemId,
    renderItemLabel,
    renderEditor,
    renderProperties,
    selectedId,
    onSelect,
    onAddItem,
    addLabel = '+ Ny',
    emptyState,
  } = adapter

  const selected = items.find((item) => getItemId(item) === selectedId) ?? null

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 font-serif">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p> : null}
        </div>
        {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
      </header>

      {/* 3-column body */}
      <div className="grid gap-3 lg:grid-cols-[240px_1fr_280px]">
        {/* Left: items list */}
        <aside className="rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Innhold
            </p>
          </div>
          {items.length === 0 ? (
            <div className="p-3 text-xs text-neutral-500">
              {emptyState ?? 'Ingen elementer enda.'}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {items.map((item) => {
                const id = getItemId(item)
                const active = id === selectedId
                return (
                  <li key={id}>
                    <Button
                      variant={active ? 'primary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start rounded-none py-2.5 font-normal"
                      onClick={() => onSelect(id)}
                    >
                      <span className="truncate text-left">{renderItemLabel(item)}</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {onAddItem ? (
            <div className="border-t border-neutral-200 p-2">
              <Button variant="secondary" size="sm" className="w-full" onClick={onAddItem}>
                <Plus className="h-3.5 w-3.5" /> {addLabel}
              </Button>
            </div>
          ) : null}
        </aside>

        {/* Center: editor */}
        <section className="min-h-[400px] rounded-xl border border-neutral-200 bg-white p-4">
          {renderEditor(selected)}
        </section>

        {/* Right: properties */}
        <aside className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Egenskaper
          </p>
          {renderProperties(selected)}
        </aside>
      </div>
    </div>
  )
}
