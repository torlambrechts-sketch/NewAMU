// Unified admin settings shell. Replaces the seven per-module admin
// pages (compliance, survey, tasks, learning, documents, meetings,
// registers) and the org-level admin tabs by hosting a registry-driven
// scope picker. Each scope's sections render lazily so the admin bundle
// doesn't balloon.
//
// Route: `/admin/settings/:scope?/:section?`. When either param is
// missing or unknown, falls back to the first visible scope/section.
//
// Wiring trio:
//   1. `src/lib/settings/settingsRegistry.ts` — registration API
//   2. `src/lib/settings/registerAll.ts` — side-effect barrel
//   3. THIS file — the runtime

import { Suspense, useEffect } from 'react'
import { Loader2, Settings } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { useScopeNavigation } from '../../lib/settings/useScopeNavigation'
import { SettingsLeftRail } from '../../components/admin/settings/SettingsLeftRail'
import { SettingsSearchBox } from '../../components/admin/settings/SettingsSearchBox'
import { SettingsResetToDefaultsButton } from '../../components/admin/settings/SettingsResetToDefaultsButton'

// Side-effect: register every scope. Importing the barrel here means
// the registry is populated by the time `useScopeNavigation` reads it.
import '../../lib/settings/registerAll'

export function AdminSettingsPage() {
  const { visibleScopes, activeScope, visibleSections, activeSection, goTo } =
    useScopeNavigation()

  // Normalise the URL: if the user landed on `/admin/settings` (no
  // params) or on a denied/unknown scope/section, redirect to the
  // resolved active one so deep links are stable.
  useEffect(() => {
    if (activeScope && activeSection) {
      const path = `/admin/settings/${activeScope.scopeId}/${activeSection.id}`
      if (typeof window !== 'undefined' && window.location.pathname !== path) {
        // useScopeNavigation.goTo replaces history.
        goTo(activeScope.scopeId, activeSection.id)
      }
    }
  }, [activeScope, activeSection, goTo])

  const tabs: TabItem[] = visibleSections.map((s) => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
  }))

  const SectionComponent = activeSection?.component ?? null

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Hjem', to: '/app' },
        { label: 'Admin', to: '/admin/settings' },
        { label: activeScope?.label ?? 'Innstillinger' },
      ]}
      title={activeScope?.label ?? 'Innstillinger'}
      description="Konfigurer organisasjon, moduler og system fra ett sted."
      headerActions={
        <div className="flex items-center gap-3">
          <SettingsSearchBox
            scopes={visibleScopes}
            onMatch={(scopeId, sectionId) => goTo(scopeId, sectionId)}
          />
          {activeScope ? <SettingsResetToDefaultsButton scope={activeScope} /> : null}
        </div>
      }
    >
      <div className="flex gap-6">
        <SettingsLeftRail
          scopes={visibleScopes}
          activeScopeId={activeScope?.scopeId ?? null}
          onSelectScope={(scopeId) => goTo(scopeId)}
        />

        <div className="min-w-0 flex-1 space-y-4">
          {activeScope ? (
            <div className="flex items-center gap-3">
              {activeScope.accent ? (
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: activeScope.accent }}
                />
              ) : (
                <Settings className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              )}
              <h2 className="text-base font-semibold text-neutral-900">{activeScope.label}</h2>
            </div>
          ) : null}

          {tabs.length > 0 && activeSection ? (
            <Tabs
              items={tabs}
              activeId={activeSection.id}
              onChange={(id) => activeScope && goTo(activeScope.scopeId, id)}
              overflow="scroll"
            />
          ) : null}

          <ModuleSectionCard>
            <Suspense
              fallback={
                <div className="flex items-center gap-2 p-6 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Laster…
                </div>
              }
            >
              {SectionComponent && activeScope ? (
                <SectionComponent scopeId={activeScope.scopeId} />
              ) : (
                <div className="p-6 text-sm text-neutral-500">
                  Ingen innstillinger er tilgjengelige for kontoen din.
                </div>
              )}
            </Suspense>
          </ModuleSectionCard>
        </div>
      </div>
    </ModulePageShell>
  )
}
