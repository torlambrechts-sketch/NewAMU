// Static configuration shared by /admin/templates components. Pulled
// out of AdminTemplatesPage so the page file stays focused on
// orchestration. Adding a new template-bearing module = updating
// the four SOURCE_* maps here + appending a `union all` block to the
// v_admin_templates view.

import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Kanban,
  Megaphone,
  Workflow,
} from 'lucide-react'
import type {
  AdminTemplateRow,
  AdminTemplateSource,
  AdminTemplateStatus,
} from '../../hooks/useAdminTemplates'

export const SOURCE_KEYS: AdminTemplateSource[] = [
  'compliance',
  'survey',
  'documents',
  'learning',
  'registers',
  'tasks',
  'meetings',
  'alerts',
  'workflow',
]

export const STATUS_KEYS: AdminTemplateStatus[] = [
  'active',
  'inactive',
  'draft',
  'archived',
  'system',
]

export const STATUS_PILL: Record<AdminTemplateStatus, string> = {
  active: 'bg-emerald-100 text-emerald-950',
  inactive: 'bg-neutral-200 text-neutral-700',
  draft: 'bg-amber-100 text-amber-950',
  archived: 'bg-neutral-100 text-neutral-400 line-through',
  system: 'bg-sky-100 text-sky-950',
}

export const SOURCE_NEW_PATH: Record<AdminTemplateSource, string> = {
  compliance: '/admin/settings/compliance/maler',
  survey: '/admin/settings/survey/maler',
  documents: '/admin/settings/documents/maler',
  learning: '/learning/courses',
  registers: '/admin/settings/registers',
  tasks: '/admin/settings/tasks/maler',
  meetings: '/admin/settings/meetings/maler',
  alerts: '/alerts/admin',
  workflow: '/workflow?tab=library',
}

export const SOURCE_DESCRIPTION: Record<AdminTemplateSource, string> = {
  compliance: 'Sjekkliste-maler — gjenbrukbare punktlister, pack-bundlede krav, skjema-felter.',
  survey: 'Undersøkelses-maler — QPSNordic/ARK, AMU, tiltak, pulse-spørringer.',
  documents: 'Dokument- og wiki-maler — prosedyrer, rutiner, retningslinjer.',
  learning: 'Kurs-maler — opplæringsmoduler, kvitteringer, kompetansebevis.',
  registers: 'Register-maler — utstyrs-, kjemikalie-, leverandørlister.',
  tasks: 'Oppgave-maler — risikovurdering, avvik, vernerunde, forbedring.',
  meetings: 'Møte-maler — AMU, ledelsens gjennomgang, vernerunde-møter.',
  alerts: 'Varslings-maler — whistleblowing, GDPR-brudd, HMS-hendelser.',
  workflow: 'Arbeidsflyt-maler — systemregler for automatisering (kun lesning).',
}

export const SOURCE_ICON: Record<AdminTemplateSource, typeof ClipboardList> = {
  compliance: ClipboardList,
  survey: Megaphone,
  documents: FileText,
  learning: GraduationCap,
  registers: Database,
  tasks: Kanban,
  meetings: CalendarDays,
  alerts: AlertTriangle,
  workflow: Workflow,
}

/** Sources that have an inline slide-over editor wired today
 *  (compliance + survey use full module editors via bridge components;
 *  the rest use LightweightTemplateEditor). */
export const INLINE_EDITABLE_SOURCES: ReadonlySet<AdminTemplateSource> = new Set([
  'compliance',
  'survey',
])

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export type DrawerState =
  | { kind: 'closed' }
  | { kind: 'new' }
  | { kind: 'view'; row: AdminTemplateRow }
  | { kind: 'compliance-edit'; templateId: string | null }
  | { kind: 'survey-edit'; templateId: string | null }
  | { kind: 'lightweight-edit'; row: AdminTemplateRow }
