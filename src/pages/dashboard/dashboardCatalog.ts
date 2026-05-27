// dashboardCatalog — katalog over alle 19 dashboards som /dashboard
// hosting. Hvert dashboard har en gruppe (Tid / Flyt / Mål /
// Risiko / Roller / Forhåndsvis / Meta / Cadence) + en kort tagline
// brukt i navigasjonen.

import type { ComponentType } from 'react'
import {
  Activity,
  AlertOctagon,
  CalendarClock,
  CalendarDays,
  Compass,
  FileSpreadsheet,
  GanttChartSquare,
  Gauge,
  GitBranch,
  Goal,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Network,
  Repeat,
  Scale,
  ScanSearch,
  ScrollText,
  ShieldAlert,
  LayoutGrid as Trello,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export type DashboardGroup =
  | 'tid'
  | 'flyt'
  | 'maal'
  | 'risiko'
  | 'roller'
  | 'forhandsvis'
  | 'cadence'
  | 'meta'

export type DashboardDef = {
  /** Stabil ID brukt i ?dashboard=... URL-paramen. */
  id: string
  /** Gruppe — driver tab/seksjons-inndelingen i hub-en. */
  group: DashboardGroup
  /** Display-navn (vises i sidebar + hub-tab). */
  label: string
  /** Kort beskrivelse — vises som tooltip og under hovedtittel. */
  description: string
  /** Lucide-ikon. */
  icon: LucideIcon
  /** Metode-merkelapp (CPM/FLOW/SCRUM/OKR/RAID/PMBOK osv.). */
  method: string
  /** Komponent som rendrer dashboardet. Lazy-importert. */
  Component: ComponentType
}

export const DASHBOARD_GROUPS: { id: DashboardGroup; label: string; description: string; Icon: LucideIcon }[] = [
  { id: 'cadence', label: 'Cadence', description: 'Innholdet du satte opp i veiviseren', Icon: CalendarClock },
  { id: 'tid', label: 'Tidsbasert', description: 'Gantt, fase, kritisk linje', Icon: GanttChartSquare },
  { id: 'flyt', label: 'Flyt', description: 'Kanban, verdistrøm, kapasitet', Icon: Workflow },
  { id: 'maal', label: 'Mål & iterasjon', description: 'OKR, sprinter, burndown', Icon: Goal },
  { id: 'risiko', label: 'Risiko & styring', description: 'RAID, eskalering, godkjenninger, revisjon', Icon: ShieldAlert },
  { id: 'roller', label: 'Roller', description: 'RACI og delegering', Icon: ListChecks },
  { id: 'forhandsvis', label: 'Forhåndsvis', description: 'Kalender og kommende oppgaver', Icon: LayoutDashboard },
  { id: 'meta', label: 'Meta', description: 'Metode-sammenligning, styringsmodell', Icon: Compass },
]

// Komponentene er definert i widgets/*.tsx. Vi importerer dem fra
// dashboardWidgets.ts som re-eksporterer alle slik at vi får én
// stabil import-bane og kan lazy-load.
import * as W from './dashboardWidgets'

export const DASHBOARDS: DashboardDef[] = [
  // ── Cadence (innstillinger fra veiviseren) ────────────────────────────────
  {
    id: 'timeline',
    group: 'cadence',
    label: 'Tidslinje-bygger',
    description: 'Årshjul med svømmebaner per HMS-kategori. Foreslått kadens basert på loven.',
    icon: CalendarClock,
    method: 'Cadence',
    Component: W.TimelineWidget,
  },
  {
    id: 'tasktemplate',
    group: 'cadence',
    label: 'Oppgavemal',
    description: 'Detaljvisning av én oppgavemal — frekvens, tildeling, fallback, påminnelser.',
    icon: FileSpreadsheet,
    method: 'Cadence',
    Component: W.TaskTemplateDetailWidget,
  },
  {
    id: 'delegation',
    group: 'cadence',
    label: 'Delegeringsregler',
    description: 'Hvordan oppgaver flyttes ved fravær, rollebytte, eller overbelastning.',
    icon: GitBranch,
    method: 'Cadence',
    Component: W.DelegationRulesWidget,
  },
  {
    id: 'governance',
    group: 'cadence',
    label: 'Styringsmodell',
    description: 'Styringsfilosofi, modenhetstrapp, og bransjeposisjon.',
    icon: Compass,
    method: 'Cadence',
    Component: W.GovernanceModelWidget,
  },
  // ── Tid (CPM/Gantt/Stage-gate) ────────────────────────────────────────────
  {
    id: 'gantt',
    group: 'tid',
    label: 'Gantt / fossefall',
    description: 'Tidslinje med faser, milepæler, og avhengigheter.',
    icon: GanttChartSquare,
    method: 'CPM',
    Component: W.GanttWidget,
  },
  {
    id: 'critical-path',
    group: 'tid',
    label: 'Kritisk linje (PERT)',
    description: 'Network diagram — hvor er det null slakk?',
    icon: Network,
    method: 'CPM',
    Component: W.CriticalPathWidget,
  },
  {
    id: 'stage-gate',
    group: 'tid',
    label: 'Fase & port',
    description: 'Stage-gate-modell med go/no-go-porter mellom fasene.',
    icon: ScanSearch,
    method: 'PMBOK',
    Component: W.StageGateWidget,
  },
  // ── Flyt ──────────────────────────────────────────────────────────────────
  {
    id: 'kanban',
    group: 'flyt',
    label: 'Kanban-tavle',
    description: 'Hver oppgave et kort. Kolonner per status. WIP-grenser.',
    icon: Kanban,
    method: 'FLOW',
    Component: W.KanbanWidget,
  },
  {
    id: 'lean-vsm',
    group: 'flyt',
    label: 'Lean / verdistrøm',
    description: 'Value Stream Mapping — hvor forsvinner tiden?',
    icon: Repeat,
    method: 'VSM',
    Component: W.LeanVsmWidget,
  },
  {
    id: 'capacity',
    group: 'flyt',
    label: 'Kapasitet',
    description: 'Hvem har for mye? Hvem har slakk? Gjennomstrømning.',
    icon: Gauge,
    method: 'FLOW',
    Component: W.CapacityWidget,
  },
  // ── Mål / iterasjon ───────────────────────────────────────────────────────
  {
    id: 'sprint',
    group: 'maal',
    label: 'Sprint & burndown',
    description: '2-ukers sprinter, commit, daily, retrospektiv.',
    icon: Activity,
    method: 'SCRUM',
    Component: W.SprintBurndownWidget,
  },
  {
    id: 'okr',
    group: 'maal',
    label: 'OKR / målbord',
    description: 'Objektiver + nøkkelresultater — kobling til strategi.',
    icon: Goal,
    method: 'OKR',
    Component: W.OkrWidget,
  },
  // ── Risiko & styring ──────────────────────────────────────────────────────
  {
    id: 'raid',
    group: 'risiko',
    label: 'RAID & risikomatrise',
    description: 'Risks · Assumptions · Issues · Decisions. PMO-loggen.',
    icon: AlertOctagon,
    method: 'RAID',
    Component: W.RaidWidget,
  },
  {
    id: 'approvals',
    group: 'risiko',
    label: 'Godkjenningskjeder',
    description: 'Signaturkjeder per kontroll. Hvem signerer hva, når.',
    icon: ScrollText,
    method: 'Cadence',
    Component: W.ApprovalChainsWidget,
  },
  {
    id: 'escalations',
    group: 'risiko',
    label: 'Eskaleringsstige',
    description: 'Når noe blir forsinket. Fra mykt varsel til AMU-agenda.',
    icon: AlertOctagon,
    method: 'Cadence',
    Component: W.EscalationLadderWidget,
  },
  {
    id: 'audit',
    group: 'risiko',
    label: 'Revisjonsspor',
    description: 'Uforanderlig logg av alt som har skjedd. SHA-signert.',
    icon: ScrollText,
    method: 'Cadence',
    Component: W.AuditStreamWidget,
  },
  // ── Roller ────────────────────────────────────────────────────────────────
  {
    id: 'raci',
    group: 'roller',
    label: 'Rollematrise (RACI)',
    description: 'Hvem gjør hva på tvers av alle oppgavemaler.',
    icon: Scale,
    method: 'Cadence',
    Component: W.RaciMatrixWidget,
  },
  // ── Forhåndsvis ───────────────────────────────────────────────────────────
  {
    id: 'preview',
    group: 'forhandsvis',
    label: 'Forhåndsvis',
    description: 'Kalender med kommende oppgaver. Hva blir generert?',
    icon: CalendarDays,
    method: 'Cadence',
    Component: W.PreviewCalendarWidget,
  },
  // ── Meta ──────────────────────────────────────────────────────────────────
  {
    id: 'method-comparison',
    group: 'meta',
    label: 'Metode-sammenligning',
    description: 'Hvilken visning passer hvilken situasjon.',
    icon: Trello,
    method: 'Meta',
    Component: W.MethodComparisonWidget,
  },
]

export function getDashboard(id: string): DashboardDef | undefined {
  return DASHBOARDS.find((d) => d.id === id)
}

export function dashboardsForGroup(group: DashboardGroup): DashboardDef[] {
  return DASHBOARDS.filter((d) => d.group === group)
}

// Brukt i mindre kort i hub-en for "se alle dashboards".
export const ALL_DASHBOARD_IDS = DASHBOARDS.map((d) => d.id)
