// Brukere & roller settings scope.
//
// Hosts everything related to who can do what in the org: internal users,
// external users (auditors / contractors / course participants / external
// functional-role holders), permission roles, HMS functional roles, role
// delegation, and the role-compliance dashboard. The internal-users,
// roles, and delegation panels were extracted from the legacy
// `src/pages/AdminPage.tsx` in phase 2. External users and role-compliance
// remain placeholders until phase 3.

import { lazy } from 'react'
import {
  KeyRound,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../../lib/settings/settingsRegistry'

const sections: SettingsSection[] = [
  {
    id: 'internal',
    label: 'Interne brukere',
    icon: UserPlus,
    capabilities: ['general'],
    searchKeywords: ['bruker', 'invitasjon', 'invite', 'user', 'interne'],
    permAny: ['users.manage', 'users.invite'],
    component: lazy(() =>
      import('../../users/UsersInternalAdminPanel').then((m) => ({
        default: m.UsersInternalAdminPanel,
      })),
    ),
  },
  {
    id: 'external',
    label: 'Eksterne brukere',
    icon: UsersRound,
    capabilities: ['general'],
    searchKeywords: ['ekstern', 'auditor', 'revisor', 'kontraktor', 'leverandør', 'kursdeltaker'],
    permAny: ['users.manage'],
    component: lazy(() =>
      import('../../users/ExternalUsersAdminPanel').then((m) => ({
        default: m.ExternalUsersAdminPanel,
      })),
    ),
  },
  {
    id: 'roles',
    label: 'Roller & tilganger',
    icon: KeyRound,
    capabilities: ['general'],
    searchKeywords: ['rolle', 'role', 'tilgang', 'permission', 'rbac'],
    permAny: ['roles.manage'],
    component: lazy(() =>
      import('../../roles/RolesAdminPanel').then((m) => ({
        default: m.RolesAdminPanel,
      })),
    ),
  },
  {
    id: 'functional-roles',
    label: 'Funksjonelle roller',
    icon: UserCheck,
    capabilities: ['general'],
    searchKeywords: ['verneombud', 'amu', 'hms', 'dpo', 'funksjonsroller'],
    component: lazy(() =>
      import('../../../../pages/admin/FunctionalRolesAdminPanel').then((m) => ({
        default: m.FunctionalRolesAdminPanel,
      })),
    ),
  },
  {
    id: 'delegation',
    label: 'Delegering',
    icon: UserCog,
    capabilities: ['general'],
    searchKeywords: ['delegering', 'delegation', 'stedfortreder', 'vikar'],
    permAny: ['roles.manage', 'delegation.manage'],
    component: lazy(() =>
      import('../../roles/DelegationAdminPanel').then((m) => ({
        default: m.DelegationAdminPanel,
      })),
    ),
  },
]

registerSettingsScope({
  scopeId: 'users-roles',
  label: 'Brukere & roller',
  group: 'org',
  order: 10,
  icon: ShieldCheck,
  permAny: ['users.manage', 'users.invite', 'roles.manage', 'module.view.admin'],
  sections,
})
