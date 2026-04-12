import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Ban,
  Bell,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  GitBranch,
  LayoutList,
  Megaphone,
  ShieldAlert,
  Stethoscope,
  UserCheck,
} from 'lucide-react'
import type { WorkflowCondition } from '../types/workflow'

/** Which org module payloads this preset applies to (not wiki_published). */
export type WorkflowInputPreset = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  /** Module keys from workflow source selector; '*' = any module */
  modules: readonly string[]
  condition: WorkflowCondition
}

export const WORKFLOW_INPUT_PRESETS: WorkflowInputPreset[] = [
  {
    id: 'always',
    label: 'Alltid',
    description: 'Kjør ved hver lagring i valgt kilde (ingen ekstra filter).',
    icon: LayoutList,
    modules: ['*'],
    condition: { match: 'always' },
  },
  // ─── HSE ───────────────────────────────────────────────────────────────
  {
    id: 'hse_incident_critical',
    label: 'Hendelse: kritisk',
    description: 'Når minst én hendelse i listen har alvor kritisk.',
    icon: AlertTriangle,
    modules: ['hse'],
    condition: { match: 'array_any', path: 'incidents', where: { severity: 'critical' } },
  },
  {
    id: 'hse_incident_high',
    label: 'Hendelse: høy alvor',
    description: 'Når minst én hendelse har høy alvorlighetsgrad.',
    icon: FileWarning,
    modules: ['hse'],
    condition: { match: 'array_any', path: 'incidents', where: { severity: 'high' } },
  },
  {
    id: 'hse_incident_open',
    label: 'Hendelse: nylig rapportert',
    description: 'Når en hendelse har status «rapportert».',
    icon: ClipboardList,
    modules: ['hse'],
    condition: { match: 'array_any', path: 'incidents', where: { status: 'reported' } },
  },
  {
    id: 'hse_sja_awaiting',
    label: 'SJA: venter deltakere',
    description: 'Når en SJA venter signatur fra deltakere.',
    icon: ClipboardCheck,
    modules: ['hse'],
    condition: { match: 'array_any', path: 'sjaAnalyses', where: { status: 'awaiting_participants' } },
  },
  {
    id: 'hse_sja_approved',
    label: 'SJA: godkjent',
    description: 'Når en SJA er godkjent.',
    icon: UserCheck,
    modules: ['hse'],
    condition: { match: 'array_any', path: 'sjaAnalyses', where: { status: 'approved' } },
  },
  {
    id: 'hse_round_pending_vo',
    label: 'Vernerunde: venter verneombud',
    description: 'Når en vernerunde venter signatur fra verneombud.',
    icon: Stethoscope,
    modules: ['hse'],
    condition: { match: 'array_any', path: 'safetyRounds', where: { status: 'pending_verneombud' } },
  },
  {
    id: 'hse_inspection_open',
    label: 'Inspeksjon: åpen',
    description: 'Når en inspeksjon ikke er lukket.',
    icon: ClipboardList,
    modules: ['hse'],
    condition: { match: 'array_any', path: 'inspections', where: { status: 'open' } },
  },
  // ─── Internkontroll (ROS / årsgjennomgang) ──────────────────────────────
  {
    id: 'ik_ros_locked',
    label: 'ROS: signert / låst',
    description: 'Når en ROS er fullt signert og låst.',
    icon: GitBranch,
    modules: ['internal_control'],
    condition: { match: 'array_any', path: 'rosAssessments', where: { locked: true } },
  },
  {
    id: 'ik_annual_pending',
    label: 'Årsgjennomgang: venter VO',
    description: 'Når årsgjennomgang venter signatur fra verneombud.',
    icon: ClipboardCheck,
    modules: ['internal_control'],
    condition: { match: 'array_any', path: 'annualReviews', where: { status: 'pending_safety_rep' } },
  },
  // ─── Oppgaver ───────────────────────────────────────────────────────────
  {
    id: 'tasks_done',
    label: 'Oppgave fullført',
    description: 'Når en oppgave i listen settes til «ferdig».',
    icon: UserCheck,
    modules: ['tasks'],
    condition: { match: 'array_any', path: 'tasks', where: { status: 'done' } },
  },
  {
    id: 'tasks_todo',
    label: 'Ny oppgave (å gjøre)',
    description: 'Når en oppgave har status «å gjøre».',
    icon: LayoutList,
    modules: ['tasks'],
    condition: { match: 'array_any', path: 'tasks', where: { status: 'todo' } },
  },
  // ─── Organisasjonshelse ─────────────────────────────────────────────────
  {
    id: 'org_health_survey_closed',
    label: 'Undersøkelse avsluttet',
    description: 'Når en undersøkelse er lukket (for oppfølging / rapport).',
    icon: ClipboardCheck,
    modules: ['org_health'],
    condition: { match: 'array_any', path: 'surveys', where: { status: 'closed' } },
  },
  {
    id: 'org_health_aml_report',
    label: 'Anonym AML-rapport',
    description: 'Når en anonym AML-kategori er registrert (metadata i payload).',
    icon: ShieldAlert,
    modules: ['workplace_reporting'],
    condition: { match: 'array_any', path: 'anonymousAmlReports', where: {} },
  },
  {
    id: 'org_health_aml_whistleblow',
    label: 'Anonym varsling (AML)',
    description: 'Kategori «varsling» i anonym kanal.',
    icon: Ban,
    modules: ['workplace_reporting'],
    condition: { match: 'array_any', path: 'anonymousAmlReports', where: { kind: 'whistleblowing' } },
  },
  {
    id: 'org_health_aml_urgent',
    label: 'Anonym rapport: høy hast',
    description: 'Når bruker har valgt høy hastegrad.',
    icon: AlertTriangle,
    modules: ['workplace_reporting'],
    condition: { match: 'array_any', path: 'anonymousAmlReports', where: { urgency: 'high' } },
  },
  // ─── Arbeidsplassrapportering (saker) ───────────────────────────────────
  {
    id: 'wr_case_new',
    label: 'Ny arbeidsplass-sak',
    description: 'Når en ny sak er registrert (alle kategorier).',
    icon: Megaphone,
    modules: ['workplace_reporting'],
    condition: { match: 'array_any', path: 'cases', where: {} },
  },
  {
    id: 'wr_case_confidential',
    label: 'Sak merket konfidensiell',
    description: 'Når en sak er flagget som konfidensiell.',
    icon: Bell,
    modules: ['workplace_reporting'],
    condition: { match: 'array_any', path: 'cases', where: { confidential: true } },
  },
  {
    id: 'wr_case_ethics',
    label: 'Sak: etikk / varsling',
    description: 'Kategori etikk eller policybrudd.',
    icon: ShieldAlert,
    modules: ['workplace_reporting'],
    condition: { match: 'array_any', path: 'cases', where: { category: 'ethics' } },
  },
  // ─── Wiki ────────────────────────────────────────────────────────────────
  {
    id: 'wiki_any_publish',
    label: 'Side publisert',
    description: 'Ved publisering av wiki-side (velg kilde «Wiki»).',
    icon: ClipboardList,
    modules: ['wiki_published'],
    condition: { match: 'always' },
  },
]

export function presetsForSourceModule(sourceModule: string): WorkflowInputPreset[] {
  return WORKFLOW_INPUT_PRESETS.filter(
    (p) => p.modules[0] === '*' || p.modules.includes(sourceModule),
  )
}
