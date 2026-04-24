import type { PermissionKey } from './permissionKeys'

/** Any of these allows entering the documents module and viewing wiki routes (see PermissionGate + nav). */
export const DOCUMENTS_MODULE_ACCESS: PermissionKey[] = [
  'module.view.dashboard',
  'documents.view',
  'documents.edit',
  'documents.manage',
]

export function canAccessDocumentsModule(can: (k: PermissionKey) => boolean): boolean {
  return DOCUMENTS_MODULE_ACCESS.some((k) => can(k))
}

/**
 * Folder grant bypass — only full documents admin (and org admin profile) ignores per-folder rules.
 * Editors and viewers follow mappe-regler (see wikiSpaceAccessGrants).
 */
export function canBypassWikiFolderGrants(
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
): boolean {
  if (isOrgAdminProfile) return true
  return can('documents.manage')
}

/** Create, edit, publish, archive wiki pages (not org template library admin). */
export function canEditWikiDocuments(
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
): boolean {
  if (isOrgAdminProfile) return true
  return can('documents.manage') || can('documents.edit')
}

/** Template library admin, folder settings, system maler — full documents admin. */
export function canAdminDocumentTemplates(
  can: (k: PermissionKey) => boolean,
  isOrgAdminProfile: boolean | undefined,
): boolean {
  if (isOrgAdminProfile) return true
  return can('documents.manage')
}
