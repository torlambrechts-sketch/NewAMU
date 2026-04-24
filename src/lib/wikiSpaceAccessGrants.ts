import type { OrganizationMemberRow, ProfileRow } from '../types/organization'
import type { PermissionKey } from './permissionKeys'
import { canBypassWikiFolderGrants, canEditWikiDocuments } from './documentsAccess'

export type WikiSpaceGrantType = 'user' | 'department' | 'team'

/** One row: folder (space) + subject + what they may do when the folder is restricted. */
export type WikiSpaceAccessGrant = {
  id: string
  spaceId: string
  grantType: WikiSpaceGrantType
  /** `user` → auth user id; `department` → departments.id; `team` → teams.id */
  subjectId: string
  canRead: boolean
  canCreate: boolean
  canWrite: boolean
  canArchive: boolean
  canDelete: boolean
}

export type WikiFolderEffectiveAccess = {
  canRead: boolean
  canCreate: boolean
  canWrite: boolean
  canArchive: boolean
  canDelete: boolean
}

const STORAGE_PREFIX = 'atics-wiki-space-grants-v2:'

function normalizeGrant(g: Partial<WikiSpaceAccessGrant> & Pick<WikiSpaceAccessGrant, 'id' | 'spaceId' | 'grantType' | 'subjectId'>): WikiSpaceAccessGrant {
  return {
    id: g.id,
    spaceId: g.spaceId,
    grantType: g.grantType,
    subjectId: g.subjectId,
    canRead: g.canRead !== false,
    canCreate: g.canCreate === true,
    canWrite: g.canWrite === true,
    canArchive: g.canArchive === true,
    canDelete: g.canDelete === true,
  }
}

export function loadWikiSpaceGrantsFromStorage(organizationId: string | null | undefined): WikiSpaceAccessGrant[] {
  if (!organizationId || typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + organizationId)
    if (!raw) {
      const legacy = localStorage.getItem(`atics-wiki-space-grants-v1:${organizationId}`)
      if (!legacy) return []
      const parsed = JSON.parse(legacy) as Partial<WikiSpaceAccessGrant>[]
      return Array.isArray(parsed)
        ? parsed
            .filter((g) => g?.spaceId && g?.subjectId && g?.grantType)
            .map((g) =>
              normalizeGrant({
                id: String(g.id ?? crypto.randomUUID()),
                spaceId: String(g.spaceId),
                grantType: g.grantType as WikiSpaceGrantType,
                subjectId: String(g.subjectId),
              }),
            )
        : []
    }
    const parsed = JSON.parse(raw) as Partial<WikiSpaceAccessGrant>[]
    return Array.isArray(parsed)
      ? parsed
          .filter((g) => g?.spaceId && g?.subjectId && g?.grantType)
          .map((g) =>
            normalizeGrant({
              id: String(g.id ?? crypto.randomUUID()),
              spaceId: String(g.spaceId),
              grantType: g.grantType as WikiSpaceGrantType,
              subjectId: String(g.subjectId),
              canRead: g.canRead,
              canCreate: g.canCreate,
              canWrite: g.canWrite,
              canArchive: g.canArchive,
              canDelete: g.canDelete,
            }),
          )
      : []
  } catch {
    return []
  }
}

export function saveWikiSpaceGrantsToStorage(organizationId: string, grants: WikiSpaceAccessGrant[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_PREFIX + organizationId, JSON.stringify(grants))
    localStorage.removeItem(`atics-wiki-space-grants-v1:${organizationId}`)
  } catch {
    /* ignore quota */
  }
}

function subjectMatchesGrant(
  g: Pick<WikiSpaceAccessGrant, 'grantType' | 'subjectId'>,
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  members: OrganizationMemberRow[],
): boolean {
  const uid = userId ?? ''
  const deptId = profile?.department_id ?? null
  const memberTeamId = (() => {
    const em = profile?.email?.trim().toLowerCase()
    if (!em) return null
    const m = members.find((x) => (x.email ?? '').trim().toLowerCase() === em)
    return m?.team_id ?? null
  })()
  if (g.grantType === 'user' && g.subjectId === uid) return true
  if (g.grantType === 'department' && deptId && g.subjectId === deptId) return true
  if (g.grantType === 'team' && memberTeamId && g.subjectId === memberTeamId) return true
  return false
}

export function wikiSpaceHasGrants(spaceId: string, grants: WikiSpaceAccessGrant[]): boolean {
  return grants.some((g) => g.spaceId === spaceId)
}

/** Matching grant rows for the signed-in user in this folder (may be empty). */
export function grantsForSubjectInSpace(
  spaceId: string,
  grants: WikiSpaceAccessGrant[],
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  members: OrganizationMemberRow[],
): WikiSpaceAccessGrant[] {
  return grants.filter((g) => g.spaceId === spaceId && subjectMatchesGrant(g, userId, profile, members))
}

/** Fold matched rows into one effective capability set (OR across rows). */
export function effectiveFolderAccess(matched: WikiSpaceAccessGrant[]): WikiFolderEffectiveAccess {
  if (matched.length === 0) {
    return { canRead: false, canCreate: false, canWrite: false, canArchive: false, canDelete: false }
  }
  return {
    canRead: matched.some((g) => g.canRead),
    canCreate: matched.some((g) => g.canCreate),
    canWrite: matched.some((g) => g.canWrite),
    canArchive: matched.some((g) => g.canArchive),
    canDelete: matched.some((g) => g.canDelete),
  }
}

/**
 * May see the folder in navigation / lists when the org uses folder grants.
 * - Admin + documents.manage: all folders.
 * - No grant rows for folder: everyone with module access sees it.
 * - With rows: documents.view needs canRead; documents.edit needs read or any write flag; manage already bypassed.
 */
export function canViewWikiSpace(args: {
  spaceId: string
  grants: WikiSpaceAccessGrant[]
  can: (k: PermissionKey) => boolean
  isOrgAdminProfile: boolean | undefined
  userId: string | null | undefined
  profile: ProfileRow | null | undefined
  members: OrganizationMemberRow[]
}): boolean {
  const { spaceId, grants, can, isOrgAdminProfile, userId, profile, members } = args
  if (canBypassWikiFolderGrants(can, isOrgAdminProfile)) return true
  if (!wikiSpaceHasGrants(spaceId, grants)) return true
  const matched = grantsForSubjectInSpace(spaceId, grants, userId, profile, members)
  const eff = effectiveFolderAccess(matched)
  if (can('documents.edit')) {
    return eff.canRead || eff.canCreate || eff.canWrite || eff.canArchive || eff.canDelete
  }
  if (can('documents.view')) {
    return eff.canRead
  }
  return eff.canRead
}

export function folderAllowsCreate(
  spaceId: string,
  grants: WikiSpaceAccessGrant[],
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
): boolean {
  if (canBypassWikiFolderGrants(can, isOrgAdminProfile)) return true
  if (!canEditWikiDocuments(can, isOrgAdminProfile)) return false
  if (!wikiSpaceHasGrants(spaceId, grants)) return true
  return effectiveFolderAccess(grants.filter((g) => g.spaceId === spaceId)).canCreate
}

function editorEffective(
  spaceId: string,
  grants: WikiSpaceAccessGrant[],
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  members: OrganizationMemberRow[],
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
): WikiFolderEffectiveAccess | null {
  if (canBypassWikiFolderGrants(can, isOrgAdminProfile)) return null
  if (!wikiSpaceHasGrants(spaceId, grants)) return null
  if (!canEditWikiDocuments(can, isOrgAdminProfile)) return null
  return effectiveFolderAccess(grantsForSubjectInSpace(spaceId, grants, userId, profile, members))
}

export function folderAllowsWritePage(
  spaceId: string,
  grants: WikiSpaceAccessGrant[],
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  members: OrganizationMemberRow[],
): boolean {
  if (!canEditWikiDocuments(can, isOrgAdminProfile)) return false
  const eff = editorEffective(spaceId, grants, userId, profile, members, can, isOrgAdminProfile)
  if (eff === null) return true
  return eff.canWrite
}

export function folderAllowsArchivePage(
  spaceId: string,
  grants: WikiSpaceAccessGrant[],
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  members: OrganizationMemberRow[],
): boolean {
  if (!canEditWikiDocuments(can, isOrgAdminProfile)) return false
  const eff = editorEffective(spaceId, grants, userId, profile, members, can, isOrgAdminProfile)
  if (eff === null) return true
  return eff.canArchive
}

export function folderAllowsDeletePage(
  spaceId: string,
  grants: WikiSpaceAccessGrant[],
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  members: OrganizationMemberRow[],
): boolean {
  if (!canEditWikiDocuments(can, isOrgAdminProfile)) return false
  const eff = editorEffective(spaceId, grants, userId, profile, members, can, isOrgAdminProfile)
  if (eff === null) return true
  return eff.canDelete
}

/** Read pages in folder (view document) — view role uses canRead; editors use canViewWikiSpace. */
export function folderAllowsReadPages(
  spaceId: string,
  grants: WikiSpaceAccessGrant[],
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  members: OrganizationMemberRow[],
): boolean {
  return canViewWikiSpace({ spaceId, grants, can, isOrgAdminProfile, userId, profile, members })
}
