/**
 * Brukerdefinerte prosesser (medvirkning, ROS, tiltak m.m.) — maler, ikke juridisk fullverdig AMU/BHT.
 */

export type WorkflowCategory =
  | 'medvirkning'
  | 'ros_risiko'
  | 'tiltak_oppfolging'
  | 'varsling'
  | 'annet'

export type WorkflowStepLinkType =
  | 'none'
  | 'tasks'
  | 'internal_control'
  | 'org_health'
  | 'documents'
  | 'members'
  | 'council'
  | 'hse'

export type WorkflowStep = {
  id: string
  order: number
  title: string
  description: string
  /** Forslag til rolle (VO, AMU, leder …) */
  roleHint?: string
  /** Anbefalt frist: dager etter start av kjøring (kun veiledning) */
  suggestedDueDays?: number
  linkType: WorkflowStepLinkType
  /** Relativ sti, f.eks. /internal-control?tab=ros */
  linkPath?: string
}

export type WorkflowDefinition = {
  id: string
  title: string
  description: string
  category: WorkflowCategory
  /** Mal fra preset eller 'custom' */
  presetId?: string
  steps: WorkflowStep[]
  createdAt: string
  updatedAt: string
}

export type WorkflowPreset = {
  id: string
  title: string
  description: string
  category: WorkflowCategory
  steps: Omit<WorkflowStep, 'id'>[]
}
