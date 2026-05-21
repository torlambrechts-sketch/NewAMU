// Shared types for the cross-module template-favourites feature.
// Mirrors the `template_favorites` table + `get_my_template_favorites` RPC.

export const TEMPLATE_KINDS = [
  'compliance',
  'survey',
  'document',
  'register',
  'learning',
  'task',
  'meeting',
] as const

export type TemplateKind = (typeof TEMPLATE_KINDS)[number]

export type FavoriteSource = 'user' | 'role_default'

/** One favourited template, with its display title resolved server-side. */
export type TemplateFavorite = {
  id: string
  templateKind: TemplateKind
  templateRef: string
  position: number
  source: FavoriteSource
  title: string
  /** False when the underlying template no longer exists (stale favourite). */
  resolved: boolean
}

/** Norwegian module labels — used to group the "Mine favoritter" page. */
export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  compliance: 'Sjekklister',
  survey: 'Undersøkelser',
  document: 'Dokumenter',
  register: 'Register',
  learning: 'Læring',
  task: 'Oppgaver',
  meeting: 'Møter',
}

/** Where each module's template surface lives — drives "åpne"-lenker. */
export const TEMPLATE_KIND_HOME: Record<TemplateKind, string> = {
  compliance: '/compliance/checklists',
  survey: '/survey',
  document: '/documents',
  register: '/registers',
  learning: '/learning',
  task: '/tasks/management',
  meeting: '/meetings',
}
