// Tasks (Oppgaver) settings scope.
//
// Mirrors `modules/tasks/admin/TasksAdminPage.tsx`. Seven functional
// tabs are registered (Maler / Kategorier / Pakker / Krav / SLA /
// Varsler / Statistikk). The eighth tab "Roller" (deferred to Phase 6
// in the original page) is intentionally omitted from the registry —
// once it lands, add it as a normal section.

import { lazy } from 'react'
import {
  BarChart2,
  Bell,
  CheckSquare,
  Clock,
  FolderOpen,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../src/lib/settings/settingsRegistry'

const sections: SettingsSection[] = [
  {
    id: 'maler',
    label: 'Maler',
    icon: CheckSquare,
    capabilities: ['templates'],
    searchKeywords: ['mal', 'oppgave', 'template'],
    component: lazy(() =>
      import('../admin/TasksMalerTab').then((m) => ({ default: m.TasksMalerTab })),
    ),
  },
  {
    id: 'kategorier',
    label: 'Kategorier',
    icon: FolderOpen,
    capabilities: ['categories'],
    searchKeywords: ['kategori', 'gruppe'],
    component: lazy(() =>
      import('../admin/TasksKategorierTab').then((m) => ({ default: m.TasksKategorierTab })),
    ),
  },
  {
    id: 'pakker',
    label: 'Pakker',
    icon: Layers,
    capabilities: ['packs'],
    searchKeywords: ['pakke', 'pack'],
    component: lazy(() =>
      import('../admin/TasksPakkerTab').then((m) => ({ default: m.TasksPakkerTab })),
    ),
  },
  {
    id: 'krav',
    label: 'Krav',
    icon: ShieldCheck,
    capabilities: ['requirements'],
    searchKeywords: ['krav', 'compliance', 'lovkrav'],
    component: lazy(() =>
      import('../admin/TasksKravTab').then((m) => ({ default: m.TasksKravTab })),
    ),
  },
  {
    id: 'sla',
    label: 'SLA & Innstillinger',
    icon: Clock,
    capabilities: ['general'],
    searchKeywords: ['sla', 'frist', 'eskalering', 'tier'],
    component: lazy(() =>
      import('../admin/TasksSLATab').then((m) => ({ default: m.TasksSLATab })),
    ),
  },
  {
    id: 'varsler',
    label: 'Varsler',
    icon: Bell,
    capabilities: ['general'],
    searchKeywords: ['varsel', 'notification', 'epost', 'prioritet'],
    component: lazy(() =>
      import('../admin/TasksVarslerTab').then((m) => ({ default: m.TasksVarslerTab })),
    ),
  },
  {
    id: 'statistikk',
    label: 'Statistikk',
    icon: BarChart2,
    capabilities: ['statistics'],
    searchKeywords: ['statistikk', 'kpi', 'completion'],
    component: lazy(() =>
      import('../admin/TasksStatistikkTab').then((m) => ({ default: m.TasksStatistikkTab })),
    ),
  },
]

registerSettingsScope({
  scopeId: 'tasks',
  label: 'Oppgaver',
  group: 'module',
  order: 20,
  icon: CheckSquare,
  // Kanban amber per CLAUDE.md "Accent palette".
  accent: '#c2410c',
  // Mirrors TASKS_NAV_PERMS in `AticsShell.tsx:400` — broad, view-only
  // roles can navigate. Page-level RLS keeps writes scoped.
  permAny: ['module.view.tasks', 'module.view.dashboard'],
  sections,
})
