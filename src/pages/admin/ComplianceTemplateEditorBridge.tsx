// Bridge that lets the cross-module /admin/templates page open the
// per-module compliance editor inline (instead of navigating to
// /admin/settings/compliance/maler). Three layers:
//
//   1. License guard: if the org has no compliance packs licensed,
//      render a modal-style warning instead of letting PackProvider
//      drop a positioned <div> into the document flow.
//   2. PackProvider: makes `useActivePack` resolve for the editor.
//   3. Pack sync + template lookup: when editing an existing template,
//      switch the active pack to the template's pack so categories
//      load correctly, then hand the template to TemplateEditorPanel —
//      the same slide-over admins see from /admin/settings/compliance.

import { useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
import { PackProvider } from '../../context/PackContext'
import { useLicensedPacks, useSetActivePack } from '../../context/packContextValue'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { usePacks } from '../../../modules/compliance/usePacks'
import { useChecklistModule } from '../../../modules/compliance/useChecklistModule'
import { TemplateEditorPanel } from '../../../modules/compliance/admin/TemplateEditorPanel'

type Props = {
  /** Existing template id, or `null` for create mode. */
  templateId: string | null
  onClose: () => void
  onSaved: () => void
}

export function ComplianceTemplateEditorBridge({ templateId, onClose, onSaved }: Props) {
  const { supabase } = useOrgSetupContext()
  const { loading, packs } = usePacks({ supabase })

  // Loader while we figure out license state. Same z-index as the
  // editor so the user never sees mismatched chrome.
  if (loading) {
    return <OverlayLoader />
  }

  if (packs.length === 0) {
    return <NoLicenseModal onClose={onClose} />
  }

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
  const setPackSlug = useSetActivePack()
  const licensedPacks = useLicensedPacks()

  // Load every pack's templates so we can resolve `templateId` regardless
  // of which pack is active in PackProvider's URL state.
  useEffect(() => {
    if (templateId === null) return
    void load({})
  }, [load, templateId])

  // Auto-switch active pack to the template's pack on edit. Categories
  // and pack-bundled requirements come from PackProvider — if the URL
  // pack doesn't match, the editor would show the wrong category list.
  const template = templateId === null ? null : cl.templates.find((t) => t.id === templateId)
  useEffect(() => {
    if (!template) return
    if (!licensedPacks.some((p) => p.slug === template.pack)) return
    setPackSlug(template.pack)
  }, [template, licensedPacks, setPackSlug])

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

  if (!template) {
    return <OverlayLoader />
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

function OverlayLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
      <div className="rounded-md bg-white p-6 shadow-lg">
        <Loader2 className="size-6 animate-spin text-[#1a3d32]" aria-hidden />
      </div>
    </div>
  )
}

function NoLicenseModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-neutral-900">Ingen sjekkliste-pakker</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-neutral-700">
          Organisasjonen har ikke aktivert noen compliance-pakker (AML eller ISO 45001). Pakker
          aktiveres av en plattform-administrator før sjekkliste-maler kan opprettes.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
