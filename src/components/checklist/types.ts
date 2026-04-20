import type { ReactNode } from 'react'

export type ChecklistFieldType = 'yes_no_na' | 'text' | 'number' | 'photo' | 'signature'

export type ChecklistItem = {
  key: string
  label: string
  required?: boolean
  fieldType?: ChecklistFieldType
  category?: string
  categoryLabel?: string
  categoryLawRef?: string
  helpText?: string
  lawRef?: string
}

export type ChecklistResponse = {
  key: string
  value: string
  notes: string | null
  status: 'pending' | 'completed'
}

export type ChecklistExecutionTabProps = {
  items: ChecklistItem[]
  responses: ChecklistResponse[]
  readOnly?: boolean
  onSaveResponse: (key: string, value: string, notes: string | null) => Promise<void>
  activationBanner?: ReactNode
  onReportIssue?: (itemKey: string, itemLabel: string) => void
  /** Primary actions (e.g. shortcuts) in table shell header — right-aligned */
  tableHeaderActions?: ReactNode
}
