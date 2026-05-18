// Studio Page — the unified authoring shell at /studio.
//
// Phase 1 Task 1.1 — ScopePicker + ModeToggle + SimpleModeCards + a
// thin AdvancedShell stub. The PalettePanel, CanvasFrame,
// PropertyInspector, VersionTimeline, PublishBar, ConflictModal and
// AutosaveIndicator components lands in Phase 2a once embedders carry
// real row state. The current shell is functional end-to-end and lights
// up every registered preset on every registered scope.
//
// Spec: specs/studio-builder.md §4 + §5 Phase 1.
//
// Permission gate: ROUTE_PERMISSION_ANY in src/lib/permissionKeys.ts
// already routes /studio to studio.simple. Advanced mode gates on
// studio.advanced inside useStudioMode().

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { listStudioScopes, getStudioScope } from '../../lib/studio/studioRegistry'
import '../../lib/studio/registerStudioScopes'
import { ScopePicker } from '../../components/studio/shell/ScopePicker'
import { ModeToggle } from '../../components/studio/shell/ModeToggle'
import { SimpleModeCards } from '../../components/studio/shell/SimpleModeCards'
import { AdvancedShell } from '../../components/studio/shell/AdvancedShell'
import { CommandPalette } from '../../components/studio/shell/CommandPalette'
import { PartnerOrgSwitcher } from '../../components/studio/shell/PartnerOrgSwitcher'
import { useStudioMode } from '../../hooks/useStudioMode'
import { emitStudioTelemetry } from '../../lib/studio/telemetry'
import type { StudioTelemetryEvent } from '../../lib/studio/studioTypes'

const BREADCRUMB = [{ label: 'Studio' }]

export function StudioPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const scopes = useMemo(() => listStudioScopes(), [])
  const activeScopeId = searchParams.get('scope')
  const activeScope = activeScopeId ? getStudioScope(activeScopeId) : null
  const { mode, canUseAdvanced, setStudioMode } = useStudioMode()
  const [forcedMode, setForcedMode] = useState<'simple' | 'advanced' | null>(null)
  const effectiveMode = forcedMode ?? mode

  // Emit + funnel through Vercel Analytics.
  const emit = (event: StudioTelemetryEvent) => {
    emitStudioTelemetry(event)
  }

  function selectScope(scopeId: string) {
    const next = new URLSearchParams(searchParams)
    next.set('scope', scopeId)
    setSearchParams(next, { replace: true })
    emit({ type: 'studio.scope_opened', scopeId, mode: effectiveMode })
  }

  async function handleModeChange(next: 'simple' | 'advanced') {
    // The toggle button is locally responsive; we also persist via the hook.
    setForcedMode(next)
    await setStudioMode(next)
    if (next === 'simple') setForcedMode(null)
  }

  function clearScope() {
    const next = new URLSearchParams(searchParams)
    next.delete('scope')
    setSearchParams(next, { replace: true })
  }

  return (
    <ModulePageShell
      breadcrumb={
        activeScope
          ? [{ label: 'Studio', to: '/studio' }, { label: activeScope.label }]
          : BREADCRUMB
      }
      title={activeScope ? `Studio · ${activeScope.label}` : 'Studio'}
      description={
        activeScope
          ? activeScope.description
          : 'Velg en innholdstype for å begynne. Enkel-modus tar deg gjennom en kort veiviser; Avansert åpner kanvas + inspektør.'
      }
      headerActions={
        <div className="flex items-center gap-2">
          <PartnerOrgSwitcher />
          <div
            className="hidden md:inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-500"
            title="Trykk Cmd+K (eller Ctrl+K) for å bytte scope"
            aria-hidden
          >
            <span className="font-mono">⌘K</span>
            <span>for hurtigvalg</span>
          </div>
          <ModeToggle mode={effectiveMode} canUseAdvanced={canUseAdvanced} onChange={handleModeChange} />
        </div>
      }
    >
      {!activeScope ? (
        <ScopePicker scopes={scopes} activeScopeId={null} onSelect={selectScope} />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={clearScope}>
              ← Vis alle
            </Button>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
              style={{ borderColor: activeScope.accent, color: activeScope.accent }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: activeScope.accent }}
                aria-hidden
              />
              {activeScope.singular}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              {effectiveMode === 'simple' ? 'Enkel modus' : 'Avansert modus'}
            </span>
          </div>

          {effectiveMode === 'simple' ? (
            <SimpleModeCards scopeId={activeScope.scopeId} emit={emit} />
          ) : (
            <AdvancedShell
              scopeId={activeScope.scopeId}
              onBackToSimple={() => handleModeChange('simple')}
            />
          )}
        </div>
      )}
      <CommandPalette />
    </ModulePageShell>
  )
}
