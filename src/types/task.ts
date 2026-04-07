import type { Level1SystemSignatureMeta } from './level1Signature'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type TaskModule =
  | 'general'
  | 'council'
  | 'members'
  | 'org_health'
  | 'hse'
  | 'hrm'
  | 'learning'

export type TaskSourceType =
  | 'manual'
  | 'council_meeting'
  | 'council_compliance'
  | 'representatives'
  | 'survey'
  | 'hse_safety_round'
  | 'hse_inspection'
  /** Konkret avvik under HMS-inspeksjon */
  | 'hse_inspection_finding'
  | 'hse_incident'
  | 'nav_report'
  | 'labor_metric'
  | 'learning_course'
  /** Opprettet automatisk ved låst ROS når rad har tiltak, ansvarlig og frist */
  | 'ros_measure'
  /** Opprettet fra årsgjennomgang (handlingsplan) */
  | 'annual_review_action'

export type DigitalSignature = {
  signerName: string
  signedAt: string
  /** Level 1 system signature (SHA-256 + auth.uid audit) */
  level1?: Level1SystemSignatureMeta
}

export type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  /** Ansvarlig utfører (visningsnavn) */
  assignee: string
  /** Kobling til ansattliste når valgt i skjema */
  assigneeEmployeeId?: string
  /** Rolle / ansvar (f.eks. verneombud, leder) */
  ownerRole: string
  /** Leder / godkjenner (kobling til ansatt) */
  leaderEmployeeId?: string
  /** Denormalisert navn for visning uten org-data */
  leaderName?: string
  dueDate: string
  createdAt: string
  module: TaskModule
  sourceType: TaskSourceType
  sourceId?: string
  sourceLabel?: string
  requiresManagementSignOff: boolean
  /** Fullføring bekreftet av ansvarlig (digital signatur — navn + tid) */
  assigneeSignature?: DigitalSignature
  /** Ledelses godkjenning når påkrevd */
  managementSignature?: DigitalSignature
}
