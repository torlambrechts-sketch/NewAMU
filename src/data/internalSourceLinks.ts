/** Preset internal routes in atics — categorized for document linking. */

export type InternalSourceCategory =
  | 'Arbeidsmiljø og samarbeid'
  | 'HMS og sikkerhet'
  | 'Organisasjon og helse'
  | 'Internkontroll og risiko'
  | 'Oppfølging'

export type InternalSourcePreset = {
  label: string
  path: string
  category: InternalSourceCategory
  description?: string
}

export const INTERNAL_SOURCE_PRESETS: InternalSourcePreset[] = [
  {
    category: 'Arbeidsmiljø og samarbeid',
    label: 'Council — oversikt',
    path: '/council?tab=overview',
    description: 'Arbeidsmiljøråd',
  },
  {
    category: 'Arbeidsmiljø og samarbeid',
    label: 'Members — AMU og valg',
    path: '/members?tab=board',
  },
  {
    category: 'Organisasjon og helse',
    label: 'Org health — oversikt',
    path: '/org-health?tab=overview',
  },
  {
    category: 'Organisasjon og helse',
    label: 'Anonym rapportering',
    path: '/org-health?tab=reporting',
  },
  {
    category: 'HMS og sikkerhet',
    label: 'HSE — vernerunder',
    path: '/hse?tab=rounds',
  },
  {
    category: 'HMS og sikkerhet',
    label: 'HSE — hendelser',
    path: '/hse?tab=incidents',
  },
  {
    category: 'Internkontroll og risiko',
    label: 'Internkontroll — oversikt',
    path: '/internal-control?tab=overview',
  },
  {
    category: 'Internkontroll og risiko',
    label: 'Internkontroll — varslingssaker',
    path: '/internal-control?tab=whistle',
  },
  {
    category: 'Internkontroll og risiko',
    label: 'Internkontroll — ROS',
    path: '/internal-control?tab=ros',
  },
  {
    category: 'Internkontroll og risiko',
    label: 'Internkontroll — årsgjennomgang',
    path: '/internal-control?tab=annual',
  },
  {
    category: 'Oppfølging',
    label: 'Oppgaver',
    path: '/tasks',
  },
  {
    category: 'Oppfølging',
    label: 'Læring — kurs',
    path: '/learning/courses',
  },
  {
    category: 'Oppfølging',
    label: 'Dokumentsenter',
    path: '/documents',
  },
  {
    category: 'Oppfølging',
    label: 'Prosessbygger',
    path: '/workflows',
  },
]
