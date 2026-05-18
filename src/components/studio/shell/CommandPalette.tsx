// Studio command palette — Cmd+K / Ctrl+K quick switcher.
//
// Power-user shortcut for scope switching. Filters across every
// registered StudioScope; selecting one navigates to /studio?scope=<id>.
// Keyboard: ↑/↓ to move, Enter to commit, Esc to close. Hard-coded to
// the studio for now; a global palette is out of scope.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { StandardInput } from '../../ui/Input'
import { listStudioScopes } from '../../../lib/studio/studioRegistry'

const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Global Cmd/Ctrl+K listener.
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const isK = e.key === 'k' || e.key === 'K'
      const isMod = e.metaKey || e.ctrlKey
      if (isK && isMod) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open])

  // Autofocus when opened.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
    if (!open) {
      // Reset on close
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset transient state on close transition
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  const scopes = useMemo(() => listStudioScopes(), [])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return scopes
    return scopes.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.singular.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    )
  }, [scopes, query])

  const commit = useCallback(
    (scopeId: string) => {
      setOpen(false)
      navigate(`/studio?scope=${encodeURIComponent(scopeId)}`)
    },
    [navigate],
  )

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filtered[activeIndex]
      if (target) commit(target.scopeId)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 pt-[18vh]"
      role="dialog"
      aria-modal
      aria-label="Studio hurtigvelger"
      onKeyDown={handleKey}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
          <Search className="h-4 w-4 text-neutral-400" aria-hidden />
          <StandardInput
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="Søk etter scope… (sjekklister, møter, læring, …)"
            className="flex-1 border-0 bg-transparent shadow-none px-0 py-0 focus-visible:ring-0"
            aria-label="Søk i studio-scopes"
          />
          <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
            {MOD_KEY}+K
          </span>
        </div>
        <ul role="listbox" aria-label="Studio-scopes" className="max-h-[50vh] overflow-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-neutral-500">Ingen treff for «{query}».</li>
          ) : (
            filtered.map((s, idx) => {
              const active = idx === activeIndex
              return (
                <li
                  key={s.scopeId}
                  role="option"
                  aria-selected={active}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                    active ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                  }`}
                  onClick={() => commit(s.scopeId)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.accent }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{s.label}</p>
                    <p className="truncate text-[11px] text-neutral-500">{s.description}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">{s.singular}</span>
                </li>
              )
            })
          )}
        </ul>
        <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[10px] text-neutral-500">
          ↑↓ for å navigere · Enter for å åpne · Esc for å lukke
        </div>
      </div>
    </div>
  )
}
