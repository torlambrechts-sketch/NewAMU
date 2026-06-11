// useOrgMembers — org member list (auth user id + display name) for
// assignee/owner pickers. Sourced from the org profiles already loaded into
// context so each picker doesn't re-query. The id is profiles.id, which IS
// the auth user id — so it's exactly what "my work" matching keys on
// (see MittArbeidInnboksPage). Replaces ad-hoc free-text name fields.

import { useMemo } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { AssignableUser } from './useAssignableUsers'

export function useOrgMembers(): AssignableUser[] {
  const { orgProfiles } = useOrgSetupContext()
  return useMemo(
    () =>
      orgProfiles
        .map((p) => ({
          id: p.id,
          displayName: p.display_name?.trim() || p.email?.trim() || 'Bruker',
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'nb')),
    [orgProfiles],
  )
}
