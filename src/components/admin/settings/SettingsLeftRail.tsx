// Left rail for the unified settings hub.
//
// Renders three groups (Organisasjon / Moduler / System) and lists the
// visible scopes inside each. Highlights the active scope and emits
// `onSelectScope(scopeId)` so the parent can re-route via
// `useScopeNavigation().goTo`. Empty groups are hidden entirely.

import { twMerge } from 'tailwind-merge'
import type { LucideIcon } from 'lucide-react'
import type { SettingsScope, SettingsScopeGroup } from '../../../lib/settings/settingsRegistry'

type GroupMeta = { id: SettingsScopeGroup; label: string }

const GROUPS: GroupMeta[] = [
  { id: 'org', label: 'Organisasjon' },
  { id: 'module', label: 'Moduler' },
  { id: 'system', label: 'System' },
]

interface SettingsLeftRailProps {
  scopes: SettingsScope[]
  activeScopeId: string | null
  onSelectScope: (scopeId: string) => void
}

export function SettingsLeftRail({ scopes, activeScopeId, onSelectScope }: SettingsLeftRailProps) {
  return (
    <nav aria-label="Innstillinger" className="flex w-64 shrink-0 flex-col gap-6 pr-4">
      {GROUPS.map((group) => {
        const groupScopes = scopes.filter((s) => s.group === group.id)
        if (groupScopes.length === 0) return null
        return (
          <div key={group.id} className="flex flex-col gap-1">
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {group.label}
            </div>
            <ul className="flex flex-col gap-0.5">
              {groupScopes.map((scope) => (
                <li key={scope.scopeId}>
                  <ScopeButton
                    label={scope.label}
                    icon={scope.icon}
                    accent={scope.accent}
                    active={scope.scopeId === activeScopeId}
                    onClick={() => onSelectScope(scope.scopeId)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function ScopeButton({
  label,
  icon: Icon,
  accent,
  active,
  onClick,
}: {
  label: string
  icon?: LucideIcon
  accent?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={twMerge(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
      )}
      style={active && accent ? { backgroundColor: accent } : undefined}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{label}</span>
    </button>
  )
}
