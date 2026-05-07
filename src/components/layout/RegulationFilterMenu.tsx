// RegulationFilterMenu — multi-select toggle list for the cross-module
// regulation filter (category-architecture §T4). Replaces the legacy
// single-select ShellCompliancePackSwitcher in the top bar + sidebar.
//
// Per OQ-A3 the menu carries "Vis alle" + "Skjul alle" shortcuts.
// Empty active set = "show all" (OQ-A4) so the trigger label stays
// honest even when the user has no toggles flipped.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Filter } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegulations } from '../../hooks/useRegulations'
import { useRegulationFilter } from '../../context/RegulationFilterContext'

type Variant = 'topbar' | 'sidebar'

type Props = {
  variant?: Variant
}

export function RegulationFilterMenu({ variant = 'topbar' }: Props) {
  const { supabase } = useOrgSetupContext()
  const { regulations, loading } = useRegulations({ supabase })
  const { activeRegulationIds, toggle, setAll, clear } = useRegulationFilter()

  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerLabel = useMemo(() => {
    if (activeRegulationIds.size === 0) return 'Alle regelverk'
    if (activeRegulationIds.size === 1) {
      const only = regulations.find((r) => activeRegulationIds.has(r.id))
      return only?.shortName ?? '1 regelverk'
    }
    return `${activeRegulationIds.size} regelverk`
  }, [activeRegulationIds, regulations])

  if (loading || regulations.length === 0) return null

  const triggerClass =
    variant === 'topbar'
      ? 'inline-flex items-center gap-1.5 border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/15'
      : 'inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-50'

  const allActive = activeRegulationIds.size === regulations.length

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClass}
        aria-label="Filter på regelverk"
      >
        <Filter className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-[160px] truncate">{triggerLabel}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Velg regelverk"
          aria-multiselectable="true"
          className="absolute right-0 z-50 mt-1 min-w-[18rem] border border-neutral-300 bg-white shadow-lg"
        >
          {/* Shortcut row (OQ-A3) */}
          <div className="flex border-b border-neutral-100 bg-neutral-50/70 text-xs">
            <button
              type="button"
              onClick={() => setAll(regulations.map((r) => r.id))}
              disabled={allActive}
              className="flex-1 px-3 py-1.5 text-left text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Vis alle
            </button>
            <span aria-hidden className="w-px bg-neutral-200" />
            <button
              type="button"
              onClick={() => clear()}
              disabled={activeRegulationIds.size === 0}
              className="flex-1 px-3 py-1.5 text-right text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Skjul alle
            </button>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {regulations.map((r) => {
              const checked = activeRegulationIds.has(r.id)
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(r.id)}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm text-neutral-800 transition-colors hover:bg-neutral-50"
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center border ${
                        checked
                          ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                          : 'border-neutral-300 bg-white'
                      }`}
                    >
                      {checked ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-tight">
                        {r.shortName}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {r.name}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {activeRegulationIds.size === 0 ? (
            <p className="border-t border-neutral-100 px-3 py-2 text-[11px] text-neutral-500">
              Ingen valgt — alle regelverk vises.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
