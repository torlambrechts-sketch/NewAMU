import type { LucideIcon } from 'lucide-react'
import { Briefcase, Laptop, Network, Plus, Scale, ShieldCheck, User } from 'lucide-react'
import type { WorkplaceCaseCategory } from '../types/workplaceReportingCase'

export type WorkplaceCaseCategoryDef = {
  id: WorkplaceCaseCategory
  labelNb: string
  labelEn: string
  shortHint: string
  icon: LucideIcon
}

/** Visual categories aligned with common whistleblowing / concern UX (Norwegian UI). */
export const WORKPLACE_CASE_CATEGORIES: readonly WorkplaceCaseCategoryDef[] = [
  {
    id: 'work_environment',
    labelNb: 'Arbeidsmiljø',
    labelEn: 'Work environment',
    shortHint: 'Fysiske forhold, støy, belysning, ergonomi …',
    icon: Laptop,
  },
  {
    id: 'coworkers',
    labelNb: 'Kolleger',
    labelEn: 'My coworkers',
    shortHint: 'Samarbeid, konflikter, trakassering mellom kolleger …',
    icon: User,
  },
  {
    id: 'health_safety',
    labelNb: 'Helse og sikkerhet',
    labelEn: 'Health and safety',
    shortHint: 'HMS, farlige forhold, nestenulykker, verneutstyr …',
    icon: ShieldCheck,
  },
  {
    id: 'management',
    labelNb: 'Ledelse',
    labelEn: 'Management',
    shortHint: 'Beslutninger, oppfølging, ressurser, kommunikasjon fra ledelse …',
    icon: Network,
  },
  {
    id: 'ethics',
    labelNb: 'Etikk',
    labelEn: 'Ethics',
    shortHint: 'Interessekonflikter, korrupsjon, juks, etiske dilemmaer …',
    icon: Scale,
  },
  {
    id: 'policy_violation',
    labelNb: 'Brudd på retningslinjer',
    labelEn: 'Policy violation',
    shortHint: 'Interne regler, rutiner, GDPR, sikkerhetsrutiner …',
    icon: Briefcase,
  },
  {
    id: 'other',
    labelNb: 'Noe annet',
    labelEn: 'Something else',
    shortHint: 'Annet som ikke passer i kategoriene over …',
    icon: Plus,
  },
]

export function categoryDef(id: WorkplaceCaseCategory): WorkplaceCaseCategoryDef | undefined {
  return WORKPLACE_CASE_CATEGORIES.find((c) => c.id === id)
}
