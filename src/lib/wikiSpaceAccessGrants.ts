import type { OrganizationMemberRow, ProfileRow } from '../types/organization'

export type WikiSpaceGrantType = 'user' | 'department' | 'team'

/** One row: folder (space) + subject + capability flags when the folder is restricted. */
export type WikiSpaceAccessGrant = {
  id: string
  spaceId: string
  grantType: WikiSpaceGrantType
  /** `user` → profiles.id; `department` → departments.id; `team` → teams.id */
  subjectId: string
  canRead: boolean
  canCreate: boolean
  canWrite: boolean
  canArchive: boolean
  canDelete: boolean
}

const STORAGE_PREFIX = 'atics-wiki-space-grants-v2:'

type LegacyGrantV1 = {
  id: string
  spaceId: string
  grantType: WikiSpaceGrantType
  subjectId: string
  canRead?: boolean
  canCreate?: boolean
  canWrite?: boolean
  canArchive?: boolean
  canDelete?: boolean
}

function normalizeGrant(g: LegacyGrantV1): WikiSpaceAccessGrant | null {
  if (!g?.spaceId || !g?.subjectId || !g?.grantType) return null
  return {
    id: g.id,
    spaceId: g.spaceId,
    grantType: g.grantType,
    subjectId: g.subjectId,
    canRead: g.canRead !== false,
    canCreate: Boolean(g.canCreate),
    canWrite: Boolean(g.canWrite),
    canArchive: Boolean(g.canArchive),
    canDelete: Boolean(g.canDelete),
  }
}

export function loadWikiSpaceGrantsFromStorage(organizationId: string | null | undefined): WikiSpaceAccessGrant[] {
  if (!organizationId || typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + organizationId)
    if (raw) {
      const parsed = JSON.parse(raw) as LegacyGrantV1[]
      return Array.isArray(parsed) ? parsed.map(normalizeGrant).filter(Boolean) as WikiSpaceAccessGrant[] : []
    }
    const legacyRaw = localStorage.getItem(`atics-wiki-space-grants-v1:${organizationId}`)
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as LegacyGrantV1[]
      const migrated = (Array.isArray(parsed) ? parsed.map(normalizeGrant).filter(Boolean) : []) as WikiSpaceAccessGrant[]
      saveWikiSpaceGrantsToStorage(organizationId, migrated)
      return migrated
    }
    return []
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

export function wikiSpaceHasRestrictedAccess(spaceId: string, grants: WikiSpaceAccessGrant[]): boolean {
  return grants.some((g) => g.spaceId === spaceId)
}

function subjectMatchesGrant(
  g: WikiSpaceAccessGrant,
  args: {
    userId: string
    deptId: string | null
    memberTeamId: string | null
  },
): boolean {
  const { userId, deptId, memberTeamId } = args
  if (g.grantType === 'user' && g.subjectId === userId) return true
  if (g.grantType === 'department' && deptId && g.subjectId === deptId) return true
  if (g.grantType === 'team' && memberTeamId && g.subjectId === memberTeamId) return true
  return false
}

function memberTeamIdForProfile(profile: ProfileRow | null | undefined, members: OrganizationMemberRow[]): string | null {
  const em = profile?.email?.trim().toLowerCase()
  if (!em) return null
  const m = members.find((x) => (x.email ?? '').trim().toLowerCase() === em)
  return m?.team_id ?? null
}

export type EffectiveFolderGrantCaps = {
  canRead: boolean
  canCreate: boolean
  canWrite: boolean
  canArchive: boolean
  canDelete: boolean
}

/** Effective capabilities for the current user in a folder (OR across all matching grant rows). */
export function effectiveFolderGrantCaps(args: {
  spaceId: string
  grants: WikiSpaceAccessGrant[]
  userId: string | null | undefined
  profile: ProfileRow | null | undefined
  members: OrganizationMemberRow[]
}): EffectiveFolderGrantCaps {
  const { spaceId, grants, userId, profile, members } = args
  const uid = userId ?? ''
  const deptId = profile?.department_id ?? null
  const teamId = memberTeamIdForProfile(profile, members)
  const rules = grants.filter((g) => g.spaceId === spaceId)
  const matchCtx = { userId: uid, deptId, memberTeamId: teamId }
  const caps: EffectiveFolderGrantCaps = {
    canRead: false,
    canCreate: false,
    canWrite: false,
    canArchive: false,
    canDelete: false,
  }
  for (const g of rules) {
    if (!subjectMatchesGrant(g, matchCtx)) continue
    if (g.canRead) caps.canRead = true
    if (g.canCreate) caps.canCreate = true
    if (g.canWrite) caps.canWrite = true
    if (g.canArchive) caps.canArchive = true
    if (g.canDelete) caps.canDelete = true
  }
  return caps
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
  const { spaceId, grants, bypassRestriction } = args
  if (bypassRestriction) return true
  const rules = grants.filter((g) => g.spaceId === spaceId)
  if (rules.length === 0) return true
  const eff = effectiveFolderGrantCaps(args)
  return eff.canRead
}

export function folderAllowsCreateInSpace(args: Parameters<typeof effectiveFolderGrantCaps>[0]): boolean {
  if (args.grants.filter((g) => g.spaceId === args.spaceId).length === 0) return true
  return effectiveFolderGrantCaps(args).canCreate
}

export function folderAllowsWritePageInSpace(args: Parameters<typeof effectiveFolderGrantCaps>[0]): boolean {
  if (args.grants.filter((g) => g.spaceId === args.spaceId).length === 0) return true
  return effectiveFolderGrantCaps(args).canWrite
}

export function folderAllowsArchivePageInSpace(args: Parameters<typeof effectiveFolderGrantCaps>[0]): boolean {
  if (args.grants.filter((g) => g.spaceId === args.spaceId).length === 0) return true
  return effectiveFolderGrantCaps(args).canArchive
}

export function folderAllowsDeletePageInSpace(args: Parameters<typeof effectiveFolderGrantCaps>[0]): boolean {
  if (args.grants.filter((g) => g.spaceId === args.spaceId).length === 0) return true
  return effectiveFolderGrantCaps(args).canDelete
}
