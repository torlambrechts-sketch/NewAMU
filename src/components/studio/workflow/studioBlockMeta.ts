// Block kind metadata for the Klarert Studio workflow editor.
// Mirrors WF_STEP_META from the design prototype (wfEditorSeed.js) and maps
// the WorkflowFlowStep structure from workflowFlowTypes.ts to display kinds.

export type StudioBlockKind =
  | 'trigger'
  | 'condition'
  | 'branch'
  | 'wait'
  | 'email'
  | 'teams'
  | 'sms'
  | 'notif'
  | 'task'
  | 'project'
  | 'assign'
  | 'ros'
  | 'amu'
  | 'webhook'
  | 'log'
  | 'approval'
  | 'parallel'

export type StudioBlockGroup =
  | 'Start'
  | 'Logikk'
  | 'Varsling'
  | 'Tiltak'
  | 'HMS'
  | 'Integrasjon'

export type StudioBlockMeta = {
  label: string
  icon: string
  group: StudioBlockGroup
  accent: string
  tint: string
  border: string
}

export const STUDIO_BLOCK_META: Record<StudioBlockKind, StudioBlockMeta> = {
  trigger:  { label: 'Utløser',            icon: 'Zap',           group: 'Start',       accent: '#6d28d9', tint: '#f5f3ff', border: '#ddd6fe' },
  condition:{ label: 'Betingelse',         icon: 'GitFork',       group: 'Logikk',      accent: '#a16207', tint: '#fefce8', border: '#fde68a' },
  branch:   { label: 'Forgren (Hvis/Da)',  icon: 'Split',         group: 'Logikk',      accent: '#a16207', tint: '#fefce8', border: '#fde68a' },
  wait:     { label: 'Vent',               icon: 'Hourglass',     group: 'Logikk',      accent: '#a16207', tint: '#fefce8', border: '#fde68a' },
  email:    { label: 'Send e-post',        icon: 'Mail',          group: 'Varsling',    accent: '#1d4ed8', tint: '#eff6ff', border: '#bfdbfe' },
  teams:    { label: 'Teams-melding',      icon: 'MessageSquare', group: 'Varsling',    accent: '#1d4ed8', tint: '#eff6ff', border: '#bfdbfe' },
  sms:      { label: 'SMS',               icon: 'Smartphone',    group: 'Varsling',    accent: '#1d4ed8', tint: '#eff6ff', border: '#bfdbfe' },
  notif:    { label: 'Push-varsel',        icon: 'Bell',          group: 'Varsling',    accent: '#1d4ed8', tint: '#eff6ff', border: '#bfdbfe' },
  task:     { label: 'Opprett oppgave',    icon: 'CheckSquare',   group: 'Tiltak',      accent: '#166534', tint: '#f0fdf4', border: '#bbf7d0' },
  project:  { label: 'Tiltaksprosjekt',   icon: 'FolderPlus',    group: 'Tiltak',      accent: '#166534', tint: '#f0fdf4', border: '#bbf7d0' },
  assign:   { label: 'Tildel ansvarlig',  icon: 'UserCheck',     group: 'Tiltak',      accent: '#166534', tint: '#f0fdf4', border: '#bbf7d0' },
  ros:      { label: 'ROS-utkast',        icon: 'ShieldAlert',   group: 'HMS',         accent: '#854d0e', tint: '#fefce8', border: '#fde68a' },
  amu:      { label: 'AMU-saksliste',     icon: 'Users',         group: 'HMS',         accent: '#5b21b6', tint: '#f5f3ff', border: '#ddd6fe' },
  webhook:  { label: 'Webhook',           icon: 'Plug',          group: 'Integrasjon', accent: '#525252', tint: '#fafafa', border: '#e5e5e5' },
  log:      { label: 'Kun logg',          icon: 'FileText',      group: 'Integrasjon', accent: '#525252', tint: '#fafafa', border: '#e5e5e5' },
  approval: { label: 'Be om godkjenning', icon: 'CheckCircle2',  group: 'Tiltak',      accent: '#166534', tint: '#f0fdf4', border: '#bbf7d0' },
  parallel: { label: 'Parallelt',         icon: 'Split',         group: 'Logikk',      accent: '#a16207', tint: '#fefce8', border: '#fde68a' },
}

/** Kinds shown in the simple palette */
export const SIMPLE_KINDS: StudioBlockKind[] = ['email', 'task', 'assign', 'wait', 'condition', 'ros']

/** All orderable kinds (palette advanced mode) */
export const ALL_PALETTE_KINDS: StudioBlockKind[] = [
  'condition', 'branch', 'wait',
  'email', 'teams', 'sms', 'notif',
  'task', 'project', 'assign',
  'ros', 'amu',
  'webhook',
]

/** Map action type string → StudioBlockKind */
export function actionTypeToKind(actionType: string): StudioBlockKind {
  switch (actionType) {
    case 'send_email':            return 'email'
    case 'create_task':
    case 'create_task_item':      return 'task'
    case 'send_notification':     return 'notif'
    case 'call_webhook':          return 'webhook'
    case 'log_only':              return 'log'
    case 'wait_until':
    case 'wait_delay':            return 'wait'
    case 'request_approval':      return 'approval'
    case 'escalate':              return 'assign'
    case 'parallel':              return 'parallel'
    case 'create_ros_draft':      return 'ros'
    case 'add_amu_agenda_item':   return 'amu'
    default:                      return 'task'
  }
}

/** A canvas block built from flowDoc data */
export type CanvasBlock = {
  id: string
  stepIndex: number   // index in linearSteps (not counting the synthetic trigger block)
  kind: StudioBlockKind
  label: string
  summary: string
  enabled: boolean
  /** The raw linearStep for mutation */
  isTrigger?: boolean
}
