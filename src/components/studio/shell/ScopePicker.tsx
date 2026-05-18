// Studio scope picker — home-page card grid.
//
// Per-scope accent treatment: a generous coloured header band (per scope's
// registered accent) + iconographic preview area. Mirrors the original
// mockup at docs/mockups/klarert-studio.html rather than the flat
// version 1 cards.

import { useMemo } from 'react'
import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Workflow,
  Wand2,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '../../ui/Button'
import type { StudioScope } from '../../../lib/studio/studioTypes'

const ICON_REGISTRY: Record<string, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  ClipboardList,
  BarChart3,
  FileText,
  GraduationCap,
  CalendarCheck,
  Database,
  LayoutDashboard,
  Workflow,
  Wand2,
}

export type ScopePickerProps = {
  scopes: StudioScope[]
  activeScopeId: string | null
  onSelect: (scopeId: string) => void
}

export function ScopePicker({ scopes, activeScopeId, onSelect }: ScopePickerProps) {
  const sorted = useMemo(() => [...scopes].sort((a, b) => a.order - b.order), [scopes])
  return (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((scope) => {
        const isActive = scope.scopeId === activeScopeId
        const Icon = ICON_REGISTRY[scope.icon] ?? Wand2
        return (
          <Button
            key={scope.scopeId}
            variant="secondary"
            onClick={() => onSelect(scope.scopeId)}
            className={`group flex w-full flex-col items-stretch p-0 overflow-hidden rounded-xl border shadow-sm transition-all h-auto font-normal whitespace-normal ${
              isActive
                ? 'border-[var(--scope-accent)] ring-2 ring-[var(--scope-accent)]/30'
                : 'border-neutral-200 hover:border-neutral-300 hover:shadow-md'
            }`}
            style={{ ['--scope-accent' as string]: scope.accent }}
            aria-label={`Velg ${scope.label}`}
          >
            {/* Top accent band with the scope's icon. The tint colour
                comes from the scope registration; the icon size is large
                enough to read at a glance. */}
            <div
              className="flex h-20 items-center justify-center"
              style={{ backgroundColor: scope.tint, color: scope.accent }}
              aria-hidden
            >
              <Icon className="h-9 w-9" aria-hidden />
            </div>
            <div className="flex-1 p-4 text-left">
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
              <p className="mt-2 text-xs text-neutral-600 line-clamp-2">
                {scope.description}
              </p>
              <p
                className="mt-3 text-[11px] uppercase tracking-wider font-medium"
                style={{ color: scope.accent }}
              >
                F.eks. {scope.sample}
              </p>
            </div>
          </Button>
        )
      })}
    </div>
  )
}
