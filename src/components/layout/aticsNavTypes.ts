// Shared nav types. Pulled out of AticsShell so they can be reused by
// the nav builder (`aticsNavBuilder.ts`) and the filter/render utilities
// without forcing a circular import. The shapes match what the shell
// has always emitted — nothing semantic changed when this file landed.

import type { ComponentType } from 'react'
import type { PermissionKey } from '../../lib/permissionKeys'

type IconComponent = ComponentType<{
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

export type SubItem = {
  label: string
  path: string
  match: (loc: { pathname: string; search: string }) => boolean
  /** When RBAC is active, hide this sub-link unless the user has the permission. */
  requirePerm?: PermissionKey
  /** If set, user needs at least one of these (overrides requirePerm when both would apply). */
  requirePermAny?: PermissionKey[]
  /** Save horizontal space: show only `Icon` in the nav row; `label` is used for tooltip and accessibility. */
  iconOnly?: boolean
  Icon?: IconComponent
  /**
   * 'header' renders the row as a clickable section heading (no NavLink)
   * that toggles expand/collapse for its child items. Items below a
   * header are linked to it via `headerKey`; the header carries the
   * same value. Defaults to 'item' (the existing link behaviour).
   */
  kind?: 'item' | 'header'
  /** Stable identifier shared between a header row and the items below it. */
  headerKey?: string
  /** Render a numeric counter pill on the row when > 0. */
  badgeCount?: number
  /** Optional colour override for `badgeCount`. */
  badgeTone?: 'amber' | 'danger'
}

export type NavModule = {
  to: string
  label: string
  end: boolean
  icon: IconComponent
  subs: SubItem[]
  /** When set and RBAC is active, module is hidden if user lacks this permission. */
  perm?: PermissionKey
  /** When set, user needs any of these permissions (overrides `perm` for the gate). */
  permAny?: PermissionKey[]
  /** Maps to the slug in the modules table; item is hidden when the module is disabled. */
  moduleSlug?: string
  /** When true, sub-items render at module-level size and indent (e.g. pinned templates). */
  flatSubs?: boolean
}

export type NavGroup = {
  id: string
  label: string
  icon: IconComponent
  modules: NavModule[]
}

export type NavSection = {
  id: string
  /** Uppercase label rendered between group clusters. */
  label: string
  /** Icon shown in rail 1 (sidebar) — one per section, not per group. */
  icon: IconComponent
  groups: NavGroup[]
}
