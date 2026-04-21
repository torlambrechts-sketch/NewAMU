import type { ReactNode } from 'react'
import { ChecklistExecutionTab } from '../../../src/components/checklist/ChecklistExecutionTab'
import type { ChecklistExecutionTabProps } from '../../../src/components/checklist/types'

export type InspectionChecklistTableProps = {
  items: ChecklistExecutionTabProps['items']
  responses: ChecklistExecutionTabProps['responses']
  readOnly?: boolean
  onSaveResponse: ChecklistExecutionTabProps['onSaveResponse']
  activationBanner?: ReactNode
  onReportIssue?: ChecklistExecutionTabProps['onReportIssue']
  tableHeaderActions?: ReactNode
}

/**
 * Inspection-facing wrapper around the shared checklist execution table.
 * Styling (thead, row hover, stacked checkpoint typography) lives in {@link ChecklistExecutionTab}.
 */
export function InspectionChecklistTable(props: InspectionChecklistTableProps) {
  return <ChecklistExecutionTab {...props} />
}
