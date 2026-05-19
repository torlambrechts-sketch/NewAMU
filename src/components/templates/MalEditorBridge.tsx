// Bridge between AdminTemplatesPage (Maler) and the shared
// StepListEditorShell. Picks the right per-source adapter based on
// `source`, then mounts the shell. Adding a new source = importing
// its adapter factory and adding a switch case.

import { useMemo, useRef } from 'react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { StepListEditorShell } from './editor/StepListEditorShell'
import type { EditorMode, TemplateEditorAdapter } from './editor/types'
import { createMeetingsAdapter } from './adapters/meetingsAdapter'
import type { AdminTemplateSource } from '../../hooks/useAdminTemplates'

export type MalEditorBridgeProps = {
  open: boolean
  source: AdminTemplateSource | null
  rowId: string | null
  mode: EditorMode
  canEdit: boolean
  onClose: () => void
  onChangeMode: (next: EditorMode) => void
}

export function MalEditorBridge({
  open,
  source,
  rowId,
  mode,
  canEdit,
  onClose,
  onChangeMode,
}: MalEditorBridgeProps) {
  const { supabase } = useOrgSetupContext()

  const canEditRef = useRef(canEdit)
  canEditRef.current = canEdit

  const adapter: TemplateEditorAdapter<unknown> | null = useMemo(() => {
    if (!source) return null
    switch (source) {
      case 'meetings':
        return createMeetingsAdapter({ supabase, canEdit }) as TemplateEditorAdapter<unknown>
      default:
        return null
    }
    // We intentionally don't include `canEdit` in the dep list — the
    // hydrate result freezes canEdit at hydration time and shell pulls
    // the current value via the closure-stable adapter object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, supabase])

  if (!open || !source || !rowId) return null
  if (!adapter) {
    // Source has no adapter yet — caller should fall back to the legacy
    // editor in this case. Render nothing so we don't block the page.
    return null
  }
  return (
    <StepListEditorShell
      adapter={adapter}
      open={open}
      rowId={rowId}
      mode={mode}
      onClose={onClose}
      onChangeMode={onChangeMode}
    />
  )
}
