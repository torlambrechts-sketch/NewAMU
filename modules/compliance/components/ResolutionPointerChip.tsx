// ResolutionPointerChip — renders one ChecklistItemResolution as a clickable chip
// that deep-links to the existing artefact (document, checklist template, register,
// learning course, etc.) that resolves the requirement.

import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText, ListChecks, BookOpen, Database, Users, Workflow, HelpCircle } from 'lucide-react'
import type { ChecklistItemResolution, ChecklistItemResolutionKind } from '../types'

const KIND_LABEL: Record<ChecklistItemResolutionKind, string> = {
  checklist_template: 'Sjekkliste',
  document: 'Dokument',
  register: 'Register',
  survey: 'Undersøkelse',
  learning: 'Kurs',
  meeting: 'Møte',
  workflow: 'Workflow',
  manual: 'Manuelt',
}

const KIND_ROUTE_PREFIX: Record<ChecklistItemResolutionKind, (ref: string) => string> = {
  checklist_template: (ref) => `/compliance/checklists?template=${encodeURIComponent(ref)}`,
  document: (ref) => `/documents/templates/${encodeURIComponent(ref)}`,
  register: (ref) => `/registre?type=${encodeURIComponent(ref)}`,
  survey: (ref) => `/survey?template=${encodeURIComponent(ref)}`,
  learning: (ref) => `/learning/courses/${encodeURIComponent(ref)}`,
  meeting: (ref) => `/meetings/templates/${encodeURIComponent(ref)}`,
  workflow: (ref) => `/admin/workflows/${encodeURIComponent(ref)}`,
  manual: () => '#',
}

function iconFor(kind: ChecklistItemResolutionKind) {
  switch (kind) {
    case 'checklist_template': return ListChecks
    case 'document': return FileText
    case 'register': return Database
    case 'survey': return Users
    case 'learning': return BookOpen
    case 'meeting': return Users
    case 'workflow': return Workflow
    case 'manual':
    default: return HelpCircle
  }
}

export function ResolutionPointerChip({ resolution }: { resolution: ChecklistItemResolution }) {
  const Icon = iconFor(resolution.kind)
  const label = resolution.label ?? KIND_LABEL[resolution.kind]
  const href = resolution.route ?? (resolution.ref ? KIND_ROUTE_PREFIX[resolution.kind](resolution.ref) : '#')
  const isExternal = href.startsWith('http')
  const isManual = resolution.kind === 'manual' || href === '#'

  const inner = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {!isManual && <ArrowUpRight className="h-3 w-3 shrink-0 opacity-60" />}
    </>
  )

  const className =
    'inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-colors max-w-[18rem]'

  if (isManual) {
    return <span className={className} title={resolution.label}>{inner}</span>
  }
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} title={label}>
        {inner}
      </a>
    )
  }
  return (
    <Link to={href} className={className} title={label}>
      {inner}
    </Link>
  )
}
