// Bridge that opens the survey metadata editor (category + metadata
// schema) inline on /admin/templates. Mirrors the compliance pattern
// but the inline editing scope is narrower: survey's full question
// editor lives at /survey/templates/org/:templateId and is a routed
// page, not a slide-over. The view drawer therefore offers a
// «Åpne i full editor» CTA for deeper edits.

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useSurveyOrgTemplates } from '../../../modules/survey/useSurveyOrgTemplates'
import { useSurveyCategories } from '../../../modules/survey/useSurveyCategories'
import { SurveyTemplateMetadataEditorPanel } from '../../../modules/survey/admin/SurveyTemplateMetadataEditorPanel'

type Props = {
  /** Existing template override id, or `null` (create-mode not supported
   *  for survey today — the catalog row needs to exist first). */
  templateId: string | null
  onClose: () => void
  onSaved: () => void
}

export function SurveyTemplateEditorBridge({ templateId, onClose, onSaved }: Props) {
  const { supabase } = useOrgSetupContext()
  const orgTemplates = useSurveyOrgTemplates({ supabase })
  const surveyCategories = useSurveyCategories({ supabase })

  // Templates auto-load on hook mount (organizationId driven). No
  // explicit load call needed.
  useEffect(() => {
    /* refresh side-effect handled by hook; effect kept for symmetry */
  }, [templateId])

  if (templateId === null) {
    // Survey doesn't support create-from-blank inside the metadata
    // editor — the catalog row is the source of truth. Show a notice.
    return <NoCreateModal onClose={onClose} />
  }

  if (orgTemplates.loading) {
    return <OverlayLoader />
  }

  const template = orgTemplates.templates.find((t) => t.overrideId === templateId)
  if (!template) {
    return <OverlayLoader />
  }

  const handleSaveCategory = async (overrideId: string, categoryId: string | null) => {
    await orgTemplates.setCategoryId(overrideId, categoryId)
    onSaved()
  }
  const handleSaveMetadata = async (
    overrideId: string,
    fields: Parameters<typeof orgTemplates.setMetadataSchema>[1]['fields'],
  ) => {
    await orgTemplates.setMetadataSchema(overrideId, { fields })
    onSaved()
  }

  return (
    <SurveyTemplateMetadataEditorPanel
      open
      template={template}
      categories={surveyCategories.categories.filter((c) => c.pack === template.pack)}
      onClose={onClose}
      onSaveCategory={handleSaveCategory}
      onSaveMetadataSchema={handleSaveMetadata}
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

function NoCreateModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-neutral-900">Undersøkelses-mal</h3>
        <p className="mt-3 text-sm text-neutral-700">
          Nye undersøkelses-maler opprettes fra katalogen. Bla i tilgjengelige maler under
          Undersøkelser-modulen og klikk «Aktiver» på den du vil tilpasse — så vises den her med
          en override du kan redigere.
        </p>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </div>
  )
}
