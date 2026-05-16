// Bridge that lets the cross-module /admin/templates page open the
// per-module compliance editor inline (instead of navigating to
// /admin/settings/compliance/maler). Wraps PackProvider so
// `useActivePack` resolves, then uses `useChecklistModule` to find
// the template by id and hands it to `TemplateEditorPanel` — the same
// slide-over admins see when they edit from the Compliance settings.

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { PackProvider } from '../../context/PackContext'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useChecklistModule } from '../../../modules/compliance/useChecklistModule'
import { TemplateEditorPanel } from '../../../modules/compliance/admin/TemplateEditorPanel'

type Props = {
  /** Existing template id, or `null` for create mode. */
  templateId: string | null
  onClose: () => void
  onSaved: () => void
}

export function ComplianceTemplateEditorBridge({ templateId, onClose, onSaved }: Props) {
  return (
    <PackProvider>
      <Inner templateId={templateId} onClose={onClose} onSaved={onSaved} />
    </PackProvider>
  )
}

function Inner({ templateId, onClose, onSaved }: Props) {
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const { load } = cl

  // Load every pack's templates so we can resolve `templateId` regardless
  // of which pack is active in PackProvider's URL state.
  useEffect(() => {
    if (templateId === null) return
    void load({})
  }, [load, templateId])

  // Create mode: render immediately.
  if (templateId === null) {
    return (
      <TemplateEditorPanel
        mode="create"
        template={null}
        onClose={onClose}
        onSaved={onSaved}
      />
    )
  }

  const template = cl.templates.find((t) => t.id === templateId)

  if (!template) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
        <div className="rounded-md bg-white p-6 shadow-lg">
          <Loader2 className="size-6 animate-spin text-[#1a3d32]" aria-hidden />
        </div>
      </div>
    )
  }

  return (
    <TemplateEditorPanel
      mode="edit"
      template={template}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}
