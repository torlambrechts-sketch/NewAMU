// Studio scope picker — home-page card grid.
//
// Renders every registered studio scope as a card. Clicking selects the
// scope and reveals its SimpleModeCards (or AdvancedShell). The accent
// border per card mirrors the per-scope accent registered on the scope
// (cf. compliance #1a3d32, survey #7c3aed, …).

import { useMemo } from 'react'
import { Button } from '../../ui/Button'
import type { StudioScope } from '../../../lib/studio/studioTypes'

export type ScopePickerProps = {
  scopes: StudioScope[]
  activeScopeId: string | null
  onSelect: (scopeId: string) => void
}

export function ScopePicker({ scopes, activeScopeId, onSelect }: ScopePickerProps) {
  const sorted = useMemo(() => [...scopes].sort((a, b) => a.order - b.order), [scopes])
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((scope) => {
        const isActive = scope.scopeId === activeScopeId
        return (
          <Button
            key={scope.scopeId}
            variant="secondary"
            onClick={() => onSelect(scope.scopeId)}
            className={`group flex flex-col items-stretch rounded-xl border p-5 text-left shadow-sm transition-all w-full h-auto font-normal whitespace-normal ${
              isActive
                ? 'border-[var(--scope-accent)] ring-2 ring-[var(--scope-accent)]/30'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
            style={{
              ['--scope-accent' as string]: scope.accent,
              backgroundColor: isActive ? scope.tint : undefined,
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-neutral-900 font-serif">
                {scope.label}
              </h3>
              {scope.recommended ? (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0 text-[9.5px] font-bold text-amber-800 uppercase tracking-wider">
                  Anbefalt
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-neutral-600 line-clamp-2">{scope.description}</p>
            <p
              className="mt-3 text-[11px] uppercase tracking-wider font-medium"
              style={{ color: scope.accent }}
            >
              {scope.sample}
            </p>
          </Button>
        )
      })}
    </div>
  )
}
