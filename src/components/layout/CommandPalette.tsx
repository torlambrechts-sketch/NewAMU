// Global command palette (Cmd/Ctrl+K). Opens a centered modal with a
// search input that fuzzy-matches against every visible nav module
// and sub-item. Recent paths surface when the query is empty so the
// palette doubles as a "back to where I was" shortcut.
//
// Keyboard contract:
//   Cmd/Ctrl+K  — open
//   Esc / outside click — close
//   Arrow up/down — move selection
//   Enter — activate (navigate)
//
// The palette has no React-Router dependency; the host passes
// `onSelect(path)` and decides how to navigate. This keeps the
// component reusable for keyboard-launched actions later (e.g. quick
// commands like "Ny oppgave").

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Search, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import {
  scoreEntry,
  type CommandEntry,
} from './commandPaletteEntries'

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
  entries: CommandEntry[]
  recentPaths: string[]
}

export function CommandPalette({
  open,
  onClose,
  onSelect,
  entries,
  recentPaths,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [rawActiveIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset state every time the palette opens. Intentional setState in
  // an effect — the `open` prop is the external state we're syncing
  // against; the alternative (lifting reset into the parent) would
  // duplicate the responsibility.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery('')
    setActiveIndex(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  // Esc to close, locked to this modal's lifetime.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      const seen = new Set<string>()
      const byPath = new Map(entries.map((e) => [e.path, e] as const))
      const recents = recentPaths
        .map((p) => byPath.get(p))
        .filter((e): e is CommandEntry => Boolean(e))
        .map((e) => {
          seen.add(e.path)
          return e
        })
      const rest = entries.filter((e) => !seen.has(e.path)).slice(0, 12)
      return { kind: 'browse' as const, recents, rest }
    }
    const scored = entries
      .map((e) => ({ entry: e, score: scoreEntry(e, q) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((row) => row.entry)
    return { kind: 'search' as const, hits: scored }
  }, [query, entries, recentPaths])

  const flatList: CommandEntry[] = useMemo(() => {
    if (filtered.kind === 'browse') return [...filtered.recents, ...filtered.rest]
    return filtered.hits
  }, [filtered])

  // Clamp during render so a shrunken result list never indexes out of
  // bounds (cheaper than a setState-in-effect and avoids a flash frame).
  const activeIndex =
    flatList.length === 0 ? 0 : Math.min(rawActiveIndex, flatList.length - 1)

  // Scroll active row into view when the index changes. Must be
  // declared BEFORE the `if (!open) return null` so hook order stays
  // stable across renders.
  useEffect(() => {
    if (!open) return
    if (!listRef.current) return
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-cmdpal-index="${activeIndex}"]`,
    )
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  if (!open) return null

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (flatList.length === 0 ? 0 : (i + 1) % flatList.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) =>
        flatList.length === 0 ? 0 : (i - 1 + flatList.length) % flatList.length,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = flatList[activeIndex]
      if (target) {
        onSelect(target.path)
        onClose()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
        role="dialog"
        aria-modal="true"
        aria-label="Hurtignavigasjon"
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
          <Search className="size-4 shrink-0 text-neutral-400" aria-hidden />
          <StandardInput
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Søk i moduler, sider og snarveier…"
            className="flex-1 border-0 bg-transparent p-0 text-sm shadow-none ring-0 focus:ring-0"
            aria-label="Søk"
            aria-controls="cmdpal-results"
            aria-activedescendant={
              flatList[activeIndex] ? `cmdpal-row-${flatList[activeIndex].id}` : undefined
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-7 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Lukk"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div
          ref={listRef}
          id="cmdpal-results"
          role="listbox"
          aria-label="Resultater"
          className="max-h-[60vh] overflow-y-auto py-1"
        >
          {flatList.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">
              Ingen treff for &ldquo;{query}&rdquo;.
            </p>
          ) : null}

          {filtered.kind === 'browse' && filtered.recents.length > 0 ? (
            <div className="border-b border-neutral-100 pb-1 pt-1">
              <p className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Nylig brukt
              </p>
              {filtered.recents.map((entry, idx) =>
                renderRow(entry, idx, activeIndex, () => {
                  onSelect(entry.path)
                  onClose()
                }, true),
              )}
            </div>
          ) : null}

          {filtered.kind === 'browse' && filtered.rest.length > 0 ? (
            <div className="pb-1 pt-1">
              <p className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Foreslått
              </p>
              {filtered.rest.map((entry, idx) =>
                renderRow(
                  entry,
                  filtered.recents.length + idx,
                  activeIndex,
                  () => {
                    onSelect(entry.path)
                    onClose()
                  },
                  false,
                ),
              )}
            </div>
          ) : null}

          {filtered.kind === 'search'
            ? filtered.hits.map((entry, idx) =>
                renderRow(entry, idx, activeIndex, () => {
                  onSelect(entry.path)
                  onClose()
                }, false),
              )
            : null}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/60 px-4 py-2 text-[11px] text-neutral-500">
          <span>
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
              ↑↓
            </kbd>{' '}
            naviger ·{' '}
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
              ↵
            </kbd>{' '}
            åpne ·{' '}
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
              esc
            </kbd>{' '}
            lukk
          </span>
          <span>
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>{' '}
            for å åpne
          </span>
        </div>
      </div>
    </div>
  )
}

function renderRow(
  entry: CommandEntry,
  index: number,
  activeIndex: number,
  onActivate: () => void,
  isRecent: boolean,
) {
  const Icon = entry.icon
  const active = index === activeIndex
  return (
    <Button
      key={entry.id}
      id={`cmdpal-row-${entry.id}`}
      type="button"
      variant="ghost"
      role="option"
      aria-selected={active}
      data-cmdpal-index={index}
      onClick={onActivate}
      className={`flex h-auto w-full items-center justify-start gap-3 rounded-none px-4 py-2.5 text-left text-sm transition-colors ${
        active ? 'bg-[color-mix(in_srgb,var(--ui-accent)_12%,white)] text-neutral-900' : 'text-neutral-800 hover:bg-neutral-50'
      }`}
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
          active ? 'bg-[color-mix(in_srgb,var(--ui-accent)_18%,white)]' : 'bg-neutral-100'
        }`}
      >
        {isRecent ? (
          <Clock className="size-3.5 text-neutral-500" aria-hidden />
        ) : (
          <Icon className="size-4 text-neutral-600" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{entry.title}</span>
        <span className="block truncate text-xs text-neutral-500">{entry.subtitle}</span>
      </span>
    </Button>
  )
}
