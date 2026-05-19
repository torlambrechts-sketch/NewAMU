// Thin wrapper that mounts the shared StepListEditorShell with a workflow
// adapter. The adapter (workflowAdapter.tsx) holds all workflow-specific
// logic; this component glues the shell to useWorkflows / useOrgSetupContext
// so existing callers (WorkflowBuilderPage) don't have to know about the
// adapter pattern.

import { useMemo, useRef } from 'react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { StepListEditorShell } from '../../templates/editor/StepListEditorShell'
import type { EditorMode } from '../../templates/editor/types'
import { createWorkflowAdapter } from './workflowAdapter'

export type WorkflowEditorShellProps = {
  open: boolean
  ruleId: string | null
  mode: EditorMode
  onClose: () => void
  onChangeMode: (next: EditorMode) => void
  /** Optional jump-to advanced canvas editor (for XOR / advanced rules). */
  onOpenAdvanced?: (ruleId: string) => void
}

export function WorkflowEditorShell({
  open,
  ruleId,
  mode,
  onClose,
  onChangeMode,
  onOpenAdvanced,
}: WorkflowEditorShellProps) {
  const { supabase, organization } = useOrgSetupContext()
  const { canCompose } = useWorkflows()

  // Latest-callback refs so adapter identity stays stable across parent
  // renders. Without this, every render of the parent (e.g. setEditor(...))
  // would create a new adapter and re-hydrate the draft.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onOpenAdvancedRef = useRef(onOpenAdvanced)
  onOpenAdvancedRef.current = onOpenAdvanced

  const adapter = useMemo(
    () =>
      createWorkflowAdapter({
        supabase,
        orgId: organization?.id ?? null,
        canEdit: canCompose,
        onOpenAdvanced: (id) => {
          onCloseRef.current()
          onOpenAdvancedRef.current?.(id)
        },
      }),
    [supabase, organization?.id, canCompose],
  )

  return (
    <StepListEditorShell
      adapter={adapter}
      open={open}
      rowId={ruleId}
      mode={mode}
      onClose={onClose}
      onChangeMode={onChangeMode}
    />
  )
}
