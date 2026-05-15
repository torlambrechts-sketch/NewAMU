// Beige folder-style sidebar for the unified settings hub.
//
// Mirrors the documents Bibliotek-layout (`ModuleDocumentsKandidatdetaljHub`):
// a search input + a "Alle innstillinger" entry on top, then one
// `WikiFolderNavRow` per scope. Each row's sub-label is the scope's
// group label (Organisasjon / Modul / System) followed by section count
// — the same shape documents uses for "Policy · 2 sider".

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { StandardInput } from '../../ui/Input'
import {
  BEIGE_NAV,
  WikiFolderNavRow,
} from '../../module/ModuleWikiFolderNavRow'
import type {
  SettingsScope,
  SettingsScopeGroup,
} from '../../../lib/settings/settingsRegistry'

const GROUP_LABELS: Record<SettingsScopeGroup, string> = {
  org: 'Organisasjon',
  module: 'Modul',
  system: 'System',
}

interface SettingsLeftRailProps {
  scopes: SettingsScope[]
  /** `null` selects the "Alle innstillinger" flat view. */
  activeScopeId: string | null
  /** Pass `null` to select the "Alle innstillinger" entry. */
  onSelectScope: (scopeId: string | null) => void
  /** Number of visible sections per scope (for the sub-label and the total). */
  sectionCountByScope: Record<string, number>
}

export function SettingsLeftRail({
  scopes,
  activeScopeId,
  onSelectScope,
  sectionCountByScope,
}: SettingsLeftRailProps) {
  const [query, setQuery] = useState('')

  const filteredScopes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return scopes
    return scopes.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        GROUP_LABELS[s.group].toLowerCase().includes(q),
    )
  }, [scopes, query])

  const totalSections = useMemo(
    () => scopes.reduce((sum, s) => sum + (sectionCountByScope[s.scopeId] ?? 0), 0),
    [scopes, sectionCountByScope],
  )

  return (
    <aside
      className="border-b border-neutral-200 lg:border-b-0 lg:border-r lg:border-neutral-200/80"
      style={{ backgroundColor: BEIGE_NAV }}
    >
      <div className="border-b border-neutral-200/60 p-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <StandardInput
            type="search"
            className="w-full py-2 pl-8 text-xs"
            placeholder="Søk i innstillinger…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Søk i innstillinger"
          />
        </div>
      </div>
      <nav className="p-2" aria-label="Innstillinger">
        <WikiFolderNavRow
          label="Alle innstillinger"
          sub={`${totalSections} seksjoner`}
          active={activeScopeId == null}
          onSelect={() => onSelectScope(null)}
        />
        {filteredScopes.map((scope) => {
          const count = sectionCountByScope[scope.scopeId] ?? 0
          return (
            <WikiFolderNavRow
              key={scope.scopeId}
              label={scope.label}
              sub={`${GROUP_LABELS[scope.group]} · ${count} seksjoner`}
              active={scope.scopeId === activeScopeId}
              onSelect={() => onSelectScope(scope.scopeId)}
            />
          )
        })}
        {filteredScopes.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-neutral-500">
            Ingen områder matcher søket.
          </p>
        ) : null}
      </nav>
    </aside>
  )
}
