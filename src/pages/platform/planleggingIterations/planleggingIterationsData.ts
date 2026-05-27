// Shared fixture data for the /platform-admin/planlegging-iterations
// design explorations. Real /planlegging reads from usePlanningOkr +
// usePlanningTasks; these iterations are static UI references so the
// platform-admin surface can showcase layout options without auth or
// org context.

import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Compass,
  Eye,
  Flag,
  GraduationCap,
  KanbanSquare,
  LifeBuoy,
  ListChecks,
  Pause,
  Play,
  Repeat,
  ShieldCheck,
  Target,
  TriangleAlert,
  Users,
  Wand2,
} from 'lucide-react'

export type FixtureHealth = 'on_track' | 'at_risk' | 'off_track'
export type FixtureStatus = 'backlog' | 'planlagt' | 'pågår' | 'gjennomgang' | 'fullført'
export type FixturePriority = 'lav' | 'middels' | 'høy' | 'kritisk'

export const FIXTURE_HEALTH: Record<
  FixtureHealth,
  { label: string; dot: string; soft: string; text: string }
> = {
  on_track: { label: 'På spor', dot: '#2f7757', soft: '#dff0e3', text: '#1f5a3c' },
  at_risk: { label: 'Risiko', dot: '#c98a2b', soft: '#fcefd6', text: '#7a4d11' },
  off_track: { label: 'Ute av kurs', dot: '#b3382a', soft: '#f9d9d5', text: '#7a1f15' },
}

export type FixtureKeyResult = {
  id: string
  title: string
  current: number
  target: number
  unit: string
  invert?: boolean
  owner: string
  ownerInit: string
  health: FixtureHealth
  /** Linked task / cadence count. */
  linkedTasks: number
}

export type FixtureObjective = {
  id: string
  title: string
  description: string
  owner: string
  ownerInit: string
  horizon: string
  health: FixtureHealth
  keyResults: FixtureKeyResult[]
  category: 'governance' | 'hms' | 'kompetanse' | 'medvirkning' | 'beredskap'
}

export const FIXTURE_OBJECTIVES: FixtureObjective[] = [
  {
    id: 'obj-1',
    title: 'Levere et trygt og inkluderende arbeidsmiljø i hele organisasjonen',
    description:
      'Synlig psykologisk trygghet, dokumentert medvirkning fra verneombud, og hendelser fanget og lukket på <14 dager.',
    owner: 'Marte Olsen',
    ownerInit: 'MO',
    horizon: '2026 H1',
    health: 'on_track',
    category: 'hms',
    keyResults: [
      {
        id: 'kr-1-1',
        title: 'Medarbeiderindeks (psykologisk trygghet)',
        current: 74,
        target: 80,
        unit: 'poeng',
        owner: 'Marte Olsen',
        ownerInit: 'MO',
        health: 'on_track',
        linkedTasks: 6,
      },
      {
        id: 'kr-1-2',
        title: 'Gjennomsnittlig lukketid for avvik',
        current: 18,
        target: 14,
        unit: 'dager',
        invert: true,
        owner: 'Lars Berg',
        ownerInit: 'LB',
        health: 'at_risk',
        linkedTasks: 9,
      },
      {
        id: 'kr-1-3',
        title: 'AMU-saker behandlet med dokumentert vedtak',
        current: 11,
        target: 16,
        unit: 'saker',
        owner: 'Hovedverneombud',
        ownerInit: 'HV',
        health: 'on_track',
        linkedTasks: 4,
      },
    ],
  },
  {
    id: 'obj-2',
    title: 'Bygge kompetanse som matcher regulatoriske krav',
    description:
      'Alle nye ledere fullfører HMS-grunnkurs innen 90 dager; årlig oppfriskning for HVO og verneombud.',
    owner: 'Inger Sand',
    ownerInit: 'IS',
    horizon: '2026 H1',
    health: 'at_risk',
    category: 'kompetanse',
    keyResults: [
      {
        id: 'kr-2-1',
        title: 'Andel ledere med fullført HMS-grunnkurs',
        current: 62,
        target: 100,
        unit: '%',
        owner: 'Inger Sand',
        ownerInit: 'IS',
        health: 'at_risk',
        linkedTasks: 5,
      },
      {
        id: 'kr-2-2',
        title: 'Verneombud med oppdatert 40-timers kurs',
        current: 4,
        target: 6,
        unit: 'personer',
        owner: 'HR',
        ownerInit: 'HR',
        health: 'on_track',
        linkedTasks: 3,
      },
    ],
  },
  {
    id: 'obj-3',
    title: 'Holde virksomhets-risikoen lav og kjent',
    description:
      'Topp-10 risikoer eier-tildelt, gjennomgått hvert kvartal, og kritiske tiltak verifisert i bevisjournal.',
    owner: 'Andreas Vik',
    ownerInit: 'AV',
    horizon: '2026',
    health: 'off_track',
    category: 'beredskap',
    keyResults: [
      {
        id: 'kr-3-1',
        title: 'Kritiske risikoer med verifisert tiltak',
        current: 3,
        target: 8,
        unit: 'av topp-10',
        owner: 'Andreas Vik',
        ownerInit: 'AV',
        health: 'off_track',
        linkedTasks: 7,
      },
      {
        id: 'kr-3-2',
        title: 'Beredskapsøvelser gjennomført i år',
        current: 1,
        target: 3,
        unit: 'øvelser',
        owner: 'Beredskapsleder',
        ownerInit: 'BL',
        health: 'at_risk',
        linkedTasks: 2,
      },
    ],
  },
]

export type FixtureTask = {
  id: string
  title: string
  status: FixtureStatus
  priority: FixturePriority
  owner: string
  ownerInit: string
  due: string
  okr: string | null
  recurring: boolean
  lawRef?: string
  /** Days until/since due. Negative = overdue. */
  daysToDue: number
}

export const FIXTURE_TASKS: FixtureTask[] = [
  {
    id: 'tsk-1',
    title: 'AMU-møte Q2 – send saksliste 7 dager før',
    status: 'planlagt',
    priority: 'høy',
    owner: 'Hovedverneombud',
    ownerInit: 'HV',
    due: '15. jun',
    okr: 'AMU-saker',
    recurring: true,
    lawRef: 'AML § 7-2',
    daysToDue: 8,
  },
  {
    id: 'tsk-2',
    title: 'Gjennomgang av topp-10 risikoer',
    status: 'pågår',
    priority: 'kritisk',
    owner: 'Andreas Vik',
    ownerInit: 'AV',
    due: '02. jun',
    okr: 'Risiko',
    recurring: true,
    lawRef: 'IK-f § 5 nr. 6',
    daysToDue: -3,
  },
  {
    id: 'tsk-3',
    title: 'HMS-grunnkurs for tre nye ledere',
    status: 'pågår',
    priority: 'middels',
    owner: 'Inger Sand',
    ownerInit: 'IS',
    due: '21. jun',
    okr: 'Kompetanse',
    recurring: false,
    lawRef: 'AML § 3-5',
    daysToDue: 14,
  },
  {
    id: 'tsk-4',
    title: 'Brann- og evakueringsøvelse',
    status: 'planlagt',
    priority: 'høy',
    owner: 'Beredskapsleder',
    ownerInit: 'BL',
    due: '30. aug',
    okr: 'Beredskap',
    recurring: true,
    lawRef: 'Brann § 11',
    daysToDue: 84,
  },
  {
    id: 'tsk-5',
    title: 'Verifiser tiltak: skliesikring sone B',
    status: 'gjennomgang',
    priority: 'høy',
    owner: 'Lars Berg',
    ownerInit: 'LB',
    due: '11. jun',
    okr: 'Avvik',
    recurring: false,
    lawRef: 'AML § 4-1',
    daysToDue: 4,
  },
  {
    id: 'tsk-6',
    title: 'Vernerunde — produksjonshall',
    status: 'backlog',
    priority: 'middels',
    owner: 'Verneombud B',
    ownerInit: 'VB',
    due: '03. jul',
    okr: null,
    recurring: true,
    lawRef: 'IK-f § 5 nr. 6',
    daysToDue: 26,
  },
  {
    id: 'tsk-7',
    title: 'Pulsmåling Q2 — utsending',
    status: 'planlagt',
    priority: 'middels',
    owner: 'Marte Olsen',
    ownerInit: 'MO',
    due: '18. jun',
    okr: 'Medarbeider',
    recurring: true,
    lawRef: 'AML § 4-3',
    daysToDue: 11,
  },
  {
    id: 'tsk-8',
    title: 'Årshjul: ledelsens gjennomgang',
    status: 'backlog',
    priority: 'kritisk',
    owner: 'Daglig leder',
    ownerInit: 'DL',
    due: '15. nov',
    okr: 'Governance',
    recurring: true,
    lawRef: 'ISO 45001 9.3',
    daysToDue: 168,
  },
  {
    id: 'tsk-9',
    title: 'Lukke avvik: ergonomi-rapport mai',
    status: 'fullført',
    priority: 'middels',
    owner: 'Lars Berg',
    ownerInit: 'LB',
    due: '24. mai',
    okr: 'Avvik',
    recurring: false,
    lawRef: 'AML § 4-4',
    daysToDue: -3,
  },
  {
    id: 'tsk-10',
    title: '40-timers kurs verneombud (vår)',
    status: 'pågår',
    priority: 'høy',
    owner: 'HR',
    ownerInit: 'HR',
    due: '20. jun',
    okr: 'Kompetanse',
    recurring: false,
    lawRef: 'AML § 6-5',
    daysToDue: 13,
  },
]

export type FixtureCadence = {
  id: string
  title: string
  category: 'governance' | 'hms' | 'risiko' | 'kompetanse' | 'medvirkning' | 'beredskap' | 'medarbeidere'
  icon: LucideIcon
  freq: 'ukentlig' | 'månedlig' | 'kvartalsvis' | 'halvårlig' | 'årlig'
  lawRefs: string[]
  owner: string
  enabled: boolean
  recommended: boolean
}

export const FIXTURE_CADENCES: FixtureCadence[] = [
  {
    id: 'cad-1',
    title: 'AMU-møte',
    category: 'governance',
    icon: Users,
    freq: 'kvartalsvis',
    lawRefs: ['AML § 7-2'],
    owner: 'Hovedverneombud',
    enabled: true,
    recommended: true,
  },
  {
    id: 'cad-2',
    title: 'Ledelsens gjennomgang',
    category: 'governance',
    icon: Compass,
    freq: 'årlig',
    lawRefs: ['ISO 45001 9.3'],
    owner: 'Daglig leder',
    enabled: true,
    recommended: true,
  },
  {
    id: 'cad-3',
    title: 'Vernerunde',
    category: 'hms',
    icon: ShieldCheck,
    freq: 'kvartalsvis',
    lawRefs: ['IK-f § 5 nr. 6'],
    owner: 'Verneombud',
    enabled: true,
    recommended: true,
  },
  {
    id: 'cad-4',
    title: 'Risikogjennomgang topp-10',
    category: 'risiko',
    icon: TriangleAlert,
    freq: 'kvartalsvis',
    lawRefs: ['IK-f § 5 nr. 6'],
    owner: 'HMS-leder',
    enabled: true,
    recommended: true,
  },
  {
    id: 'cad-5',
    title: 'HMS-grunnkurs nye ledere',
    category: 'kompetanse',
    icon: GraduationCap,
    freq: 'halvårlig',
    lawRefs: ['AML § 3-5'],
    owner: 'HR-leder',
    enabled: true,
    recommended: false,
  },
  {
    id: 'cad-6',
    title: 'Pulsmåling',
    category: 'medarbeidere',
    icon: ListChecks,
    freq: 'kvartalsvis',
    lawRefs: ['AML § 4-3'],
    owner: 'HR-leder',
    enabled: false,
    recommended: false,
  },
  {
    id: 'cad-7',
    title: 'Brann- og evakueringsøvelse',
    category: 'beredskap',
    icon: LifeBuoy,
    freq: 'årlig',
    lawRefs: ['Brann § 11'],
    owner: 'Beredskapsleder',
    enabled: true,
    recommended: true,
  },
  {
    id: 'cad-8',
    title: 'Medvirkningsmøte verneombud',
    category: 'medvirkning',
    icon: Eye,
    freq: 'månedlig',
    lawRefs: ['AML § 6-2'],
    owner: 'Verneombud',
    enabled: false,
    recommended: false,
  },
]

export const STATUS_META: Record<FixtureStatus, { label: string; chip: string; ring: string; icon: LucideIcon }> = {
  backlog: { label: 'Backlog', chip: 'bg-neutral-100 text-neutral-700', ring: 'ring-neutral-200', icon: ClipboardList },
  planlagt: { label: 'Planlagt', chip: 'bg-sky-50 text-sky-800', ring: 'ring-sky-200', icon: Calendar },
  'pågår': { label: 'Pågår', chip: 'bg-indigo-50 text-indigo-800', ring: 'ring-indigo-200', icon: Play },
  gjennomgang: { label: 'Gjennomgang', chip: 'bg-amber-50 text-amber-900', ring: 'ring-amber-200', icon: Eye },
  'fullført': { label: 'Fullført', chip: 'bg-emerald-50 text-emerald-900', ring: 'ring-emerald-200', icon: CheckCircle2 },
}

export const PRIORITY_META: Record<FixturePriority, { label: string; chip: string }> = {
  lav: { label: 'Lav', chip: 'bg-neutral-100 text-neutral-700' },
  middels: { label: 'Middels', chip: 'bg-amber-50 text-amber-900' },
  'høy': { label: 'Høy', chip: 'bg-orange-50 text-orange-900' },
  kritisk: { label: 'Kritisk', chip: 'bg-red-50 text-red-900' },
}

export const CADENCE_CATEGORY_META: Record<
  FixtureCadence['category'],
  { label: string; color: string }
> = {
  governance: { label: 'Styring & ledelse', color: '#1a3d32' },
  hms: { label: 'HMS-kontroller', color: '#2f7757' },
  risiko: { label: 'Risiko', color: '#c98a2b' },
  kompetanse: { label: 'Kompetanse', color: '#6366F1' },
  medvirkning: { label: 'Medvirkning', color: '#0EA5E9' },
  beredskap: { label: 'Beredskap', color: '#b3382a' },
  medarbeidere: { label: 'Medarbeidere', color: '#16A34A' },
}

export const FREQ_LABEL: Record<FixtureCadence['freq'], string> = {
  ukentlig: 'Ukentlig',
  'månedlig': 'Månedlig',
  kvartalsvis: 'Kvartalsvis',
  'halvårlig': 'Halvårlig',
  'årlig': 'Årlig',
}

/** Computed summary for KPI rows. */
export function computeFixtureSummary() {
  const objs = FIXTURE_OBJECTIVES
  const tasks = FIXTURE_TASKS
  const krs = objs.flatMap((o) => o.keyResults)

  const overall = krs.reduce((acc, k) => {
    const ratio = k.invert
      ? Math.max(0, Math.min(1, k.target / Math.max(k.current, 0.01)))
      : Math.min(1, k.current / Math.max(k.target, 0.01))
    return acc + ratio
  }, 0)

  return {
    objectivesOnTrack: objs.filter((o) => o.health === 'on_track').length,
    objectivesAtRisk: objs.filter((o) => o.health === 'at_risk').length,
    objectivesOffTrack: objs.filter((o) => o.health === 'off_track').length,
    objectiveTotal: objs.length,
    krTotal: krs.length,
    krProgress: krs.length === 0 ? 0 : overall / krs.length,
    openTasks: tasks.filter((t) => t.status !== 'fullført').length,
    overdueTasks: tasks.filter((t) => t.status !== 'fullført' && t.daysToDue < 0).length,
    recurringTasks: tasks.filter((t) => t.recurring).length,
    completedThisMonth: tasks.filter((t) => t.status === 'fullført').length,
    activeCadences: FIXTURE_CADENCES.filter((c) => c.enabled).length,
    catalogCadences: FIXTURE_CADENCES.length,
  }
}

/** Section icons reused across iterations. */
export const PLAN_SECTION_ICONS = {
  strategi: Target,
  kadens: Wand2,
  oversikt: KanbanSquare,
  flag: Flag,
  pause: Pause,
  repeat: Repeat,
  alert: AlertCircle,
}
