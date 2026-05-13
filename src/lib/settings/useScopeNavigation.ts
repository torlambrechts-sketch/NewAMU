// URL ↔ active scope/section sync for the settings shell.
//
// Route shape: `/admin/settings/:scope?/:section?`. This hook reads the
// params, resolves them against `listSettingsScopes()` (falling back to
// the first visible scope/section when unspecified or unknown), and
// returns navigation helpers that update the URL via `react-router-dom`.
//
// Visibility filtering uses `canSeePermAny` against the current
// `useOrgSetupContext().can` + admin short-circuit. The hook never
// returns a scope/section the current user can't see — denied URLs
// resolve to the first allowed entry.

import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import {
  canSeePermAny,
  getSettingsScope,
  listSettingsScopes,
  type SettingsScope,
  type SettingsSection,
} from './settingsRegistry'

export type ScopeNavigationState = {
  /** All scopes visible to the current user, sorted as `listSettingsScopes` returns them. */
  visibleScopes: SettingsScope[]
  /** Currently-active scope (always non-null when `visibleScopes` is non-empty). */
  activeScope: SettingsScope | null
  /** Sections of `activeScope` visible to the current user. */
  visibleSections: SettingsSection[]
  /** Currently-active section within `activeScope`. */
  activeSection: SettingsSection | null
  /** Navigate to `(scopeId, sectionId?)`. Replaces history entry. */
  goTo: (scopeId: string, sectionId?: string) => void
}

export function useScopeNavigation(): ScopeNavigationState {
  const { scope: scopeParam, section: sectionParam } = useParams<{
    scope?: string
    section?: string
  }>()
  const navigate = useNavigate()
  const { can, isAdmin } = useOrgSetupContext()

  const visibleScopes = useMemo(
    () => listSettingsScopes().filter((s) => canSeePermAny(s.permAny, can, isAdmin)),
    [can, isAdmin],
  )

  const activeScope = useMemo<SettingsScope | null>(() => {
    if (scopeParam) {
      const direct = getSettingsScope(scopeParam)
      if (direct && canSeePermAny(direct.permAny, can, isAdmin)) return direct
    }
    return visibleScopes[0] ?? null
  }, [scopeParam, visibleScopes, can, isAdmin])

  const visibleSections = useMemo<SettingsSection[]>(() => {
    if (!activeScope) return []
    return activeScope.sections.filter((s) =>
      canSeePermAny(s.permAny ?? activeScope.permAny, can, isAdmin),
    )
  }, [activeScope, can, isAdmin])

  const activeSection = useMemo<SettingsSection | null>(() => {
    if (!activeScope) return null
    if (sectionParam) {
      const direct = visibleSections.find((s) => s.id === sectionParam)
      if (direct) return direct
    }
    return visibleSections[0] ?? null
  }, [activeScope, sectionParam, visibleSections])

  const goTo = useCallback(
    (scopeId: string, sectionId?: string) => {
      const target = sectionId
        ? `/admin/settings/${scopeId}/${sectionId}`
        : `/admin/settings/${scopeId}`
      navigate(target, { replace: true })
    },
    [navigate],
  )

  return { visibleScopes, activeScope, visibleSections, activeSection, goTo }
}
