import type { OrganizationMemberRow, ProfileRow } from '../types/organization'

export type WikiSpaceGrantType = 'user' | 'department' | 'team'

/** One row: folder (space) + who may view it when the folder is restricted. */
export type WikiSpaceAccessGrant = {
  id: string
  spaceId: string
  grantType: WikiSpaceGrantType
  /** `user` → profiles.id; `department` → departments.id; `team` → teams.id */
  subjectId: string
}

const STORAGE_PREFIX = 'atics-wiki-space-grants-v1:'

export function loadWikiSpaceGrantsFromStorage(organizationId: string | null | undefined): WikiSpaceAccessGrant[] {
  if (!organizationId || typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + organizationId)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WikiSpaceAccessGrant[]
    return Array.isArray(parsed) ? parsed.filter((g) => g?.spaceId && g?.subjectId && g?.grantType) : []
  } catch {
    return []
  }
}

export function saveWikiSpaceGrantsToStorage(organizationId: string, grants: WikiSpaceAccessGrant[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_PREFIX + organizationId, JSON.stringify(grants))
  } catch {
    /* ignore quota */
  }
}

export function canViewWikiSpace(args: {
  spaceId: string
  grants: WikiSpaceAccessGrant[]
  /** Org admins / documents managers always see every folder */
  bypassRestriction: boolean
  userId: string | null | undefined
  profile: ProfileRow | null | undefined
  members: OrganizationMemberRow[]
}): boolean {
  const { spaceId, grants, bypassRestriction, userId, profile, members } = args
  if (bypassRestriction) return true
  const rules = grants.filter((g) => g.spaceId === spaceId)
  if (rules.length === 0) return true
  const uid = userId ?? ''
  const deptId = profile?.department_id ?? null
  const memberTeamId = (() => {
    const em = profile?.email?.trim().toLowerCase()
    if (!em) return null
    const m = members.find((x) => (x.email ?? '').trim().toLowerCase() === em)
    return m?.team_id ?? null
  })()
  for (const g of rules) {
    if (g.grantType === 'user' && g.subjectId === uid) return true
    if (g.grantType === 'department' && deptId && g.subjectId === deptId) return true
    if (g.grantType === 'team' && memberTeamId && g.subjectId === memberTeamId) return true
  }
  return false
}
