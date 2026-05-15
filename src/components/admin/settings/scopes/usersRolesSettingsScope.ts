// Brukere & roller settings scope.
//
// Hosts everything related to who can do what in the org: internal users,
// external users (auditors / contractors / course participants / external
// functional-role holders), permission roles, HMS functional roles, role
// delegation, and the role-compliance dashboard. The functional-roles
// section reuses the existing `FunctionalRolesAdminPanel`; the others are
// placeholders until phase 2 extracts the users/roles/delegation tabs
// from `src/pages/AdminPage.tsx` and phase 3 ships the missing pages.

import { lazy } from 'react'
import {
  BarChart3,
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
import { placeholderSection } from '../placeholderSection'

const sections: SettingsSection[] = [
  {
    id: 'internal',
    label: 'Interne brukere',
    icon: UserPlus,
    capabilities: ['general'],
    searchKeywords: ['bruker', 'invitasjon', 'invite', 'user', 'interne'],
    permAny: ['users.manage', 'users.invite'],
    component: placeholderSection(
      'Interne brukere',
      'Listevisning, invitasjoner og rollebinding for ansatte. Erstatter «Brukere»-fanen fra den gamle admin-siden.',
      'Hentes inn fra /organisation/admin?tab=users i fase 2.',
    ),
  },
  {
    id: 'external',
    label: 'Eksterne brukere',
    icon: UsersRound,
    capabilities: ['general'],
    searchKeywords: ['ekstern', 'auditor', 'revisor', 'kontraktor', 'leverandør', 'kursdeltaker'],
    permAny: ['users.manage'],
    component: placeholderSection(
      'Eksterne brukere',
      'Samlet liste over revisorer (signerte lenker), kontraktører, eksterne kursdeltakere og eksterne funksjonsroller.',
      'Type-fane for revisor leses fra workflow_auditor_tokens; øvrige typer kobles på i fase 3.',
    ),
  },
  {
    id: 'roles',
    label: 'Roller & tilganger',
    icon: KeyRound,
    capabilities: ['general'],
    searchKeywords: ['rolle', 'role', 'tilgang', 'permission', 'rbac'],
    permAny: ['roles.manage'],
    component: placeholderSection(
      'Roller og tilganger',
      'Definer rolledefinisjoner og hvilke tillatelser de gir. Tabellen viser role_definitions × role_permissions.',
      'Hentes inn fra /organisation/admin?tab=roles i fase 2.',
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
    component: placeholderSection(
      'Delegering av roller',
      'Tidsavgrenset overføring av rolletilganger ved fravær.',
      'Hentes inn fra /organisation/admin?tab=delegation i fase 2.',
    ),
  },
  {
    id: 'role-compliance',
    label: 'Rolle-compliance',
    icon: BarChart3,
    capabilities: ['statistics'],
    searchKeywords: ['rolle-compliance', 'kompetanse', 'dekning', 'role compliance'],
    component: placeholderSection(
      'Rolle-compliance',
      'Dashboard som viser dekning av rollekrav på tvers av enheter.',
      'Eksisterende side på /organisation/admin?tab=role_compliance pekes inn her i en senere fase.',
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
