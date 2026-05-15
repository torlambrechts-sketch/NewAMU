// Unified admin settings shell. Replaces the seven per-module admin
// pages (compliance, survey, tasks, learning, documents, meetings,
// registers) and the org-level admin tabs by hosting a registry-driven
// scope picker. Each scope's sections render lazily so the admin bundle
// doesn't balloon.
//
// Route: `/admin/settings/:scope?/:section?`. The reserved scope id
// `all` activates the flat "Alle innstillinger" cross-scope table.
// Otherwise an unknown/denied param falls back to the first visible
// scope/section.
//
// Layout mirrors the documents Bibliotek-shell — a beige folder sidebar
// (`SettingsLeftRail`) on the left, scope content (tabs + section card)
// or the flat all-sections table on the right.
//
// Wiring trio:
//   1. `src/lib/settings/settingsRegistry.ts` — registration API
//   2. `src/lib/settings/registerAll.ts` — side-effect barrel
//   3. THIS file — the runtime

import { Suspense, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Settings } from 'lucide-react'
import { ModulePageShell } from '../../components/module'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { useScopeNavigation } from '../../lib/settings/useScopeNavigation'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { SettingsLeftRail } from '../../components/admin/settings/SettingsLeftRail'
import { SettingsSearchBox } from '../../components/admin/settings/SettingsSearchBox'
import { SettingsResetToDefaultsButton } from '../../components/admin/settings/SettingsResetToDefaultsButton'
import { SettingsAllSectionsTable } from '../../components/admin/settings/SettingsAllSectionsTable'
import { canSeePermAny } from '../../lib/settings/settingsRegistry'

// Side-effect: register every scope. Importing the barrel here means
// the registry is populated by the time `useScopeNavigation` reads it.
import '../../lib/settings/registerAll'

const ALL_VIEW_SCOPE_PARAM = 'all'

export function AdminSettingsPage() {
  const { scope: scopeParam } = useParams<{ scope?: string; section?: string }>()
  const { can, isAdmin } = useOrgSetupContext()
  const { visibleScopes, activeScope, visibleSections, activeSection, goTo } =
    useScopeNavigation()

  // Bare `/admin/settings` and the reserved `all` scope both render the
  // flat cross-scope view. The sidebar entry "Admin → Innstillinger"
  // points at `/admin/settings` and should land on this overview
  // instead of silently redirecting to whichever scope happens to come
  // first in the registry.
  const viewAll = scopeParam == null || scopeParam === ALL_VIEW_SCOPE_PARAM

  const sectionCountByScope = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const scope of visibleScopes) {
      const visible = scope.sections.filter((section) =>
        canSeePermAny(section.permAny ?? scope.permAny, can, isAdmin),
      )
      counts[scope.scopeId] = visible.length
    }
    return counts
  }, [visibleScopes, can, isAdmin])

  // Normalise the URL: outside the all-view, redirect deep links to the
  // resolved active scope/section so refreshes are stable.
  useEffect(() => {
    if (viewAll) return
    if (activeScope && activeSection) {
      const path = `/admin/settings/${activeScope.scopeId}/${activeSection.id}`
      if (typeof window !== 'undefined' && window.location.pathname !== path) {
        goTo(activeScope.scopeId, activeSection.id)
      }
    }
  }, [viewAll, activeScope, activeSection, goTo])

  const tabs: TabItem[] = visibleSections.map((s) => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
  }))

  const SectionComponent = activeSection?.component ?? null

  const handleSelectScope = (scopeId: string | null) => {
    if (scopeId == null) goTo(ALL_VIEW_SCOPE_PARAM)
    else goTo(scopeId)
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Hjem', to: '/app' },
        { label: 'Admin' },
        { label: 'Innstillinger' },
      ]}
      title="Innstillinger"
      description="Konfigurer organisasjon, moduler og system fra ett sted."
      headerActions={
        <div className="flex items-center gap-3">
          <SettingsSearchBox
            scopes={visibleScopes}
            onMatch={(scopeId, sectionId) => goTo(scopeId, sectionId)}
          />
          {!viewAll && activeScope ? (
            <SettingsResetToDefaultsButton scope={activeScope} />
          ) : null}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm lg:grid-cols-[minmax(200px,22%)_1fr]">
        <SettingsLeftRail
          scopes={visibleScopes}
          activeScopeId={viewAll ? null : activeScope?.scopeId ?? null}
          onSelectScope={handleSelectScope}
          sectionCountByScope={sectionCountByScope}
        />

        <div className="min-w-0 bg-white p-4 md:p-6">
          {viewAll ? (
            <SettingsAllSectionsTable
              scopes={visibleScopes}
              onOpenSection={(scopeId, sectionId) => goTo(scopeId, sectionId)}
            />
          ) : (
            <div className="space-y-4">
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
            </div>
          )}
        </div>
      </div>
    </ModulePageShell>
  )
}
