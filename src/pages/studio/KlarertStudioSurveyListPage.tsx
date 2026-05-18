// Studio survey template list — shows all survey_template_catalog rows
// for the org plus system templates, with "Ny undersøkelse" CTA.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { CatalogRowForListSchema, type SurveyTemplateCatalogRow } from '../../../modules/survey/surveyTemplateCatalogTypes'

export function KlarertStudioSurveyListPage() {
  const { supabase, organization } = useOrgSetupContext()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<SurveyTemplateCatalogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    void supabase
      .from('survey_template_catalog')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []).flatMap((row) => {
          const p = CatalogRowForListSchema.safeParse(row)
          return p.success ? [p.data] : []
        })
        setTemplates(rows)
        setLoading(false)
      })
  }, [supabase, organization?.id])

  return (
    <div className="min-h-full bg-[#f5f4f0]">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/studio')}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
              aria-label="Tilbake"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                KLARERT · STUDIO
              </p>
              <h1 className="text-2xl font-bold text-neutral-900">Spørreundersøkelser</h1>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/studio/survey/new')}
            className="gap-1.5 bg-[#1a3d32] hover:bg-[#1a3d32]/90"
          >
            <Plus className="h-4 w-4" />
            Ny undersøkelse
          </Button>
        </div>

        {/* Template list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 py-20 text-center">
            <p className="text-sm font-medium text-neutral-500">Ingen maler ennå</p>
            <p className="mt-1 text-xs text-neutral-400">
              Klikk «Ny undersøkelse» for å komme i gang.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/studio/survey/${t.id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-neutral-300 hover:shadow"
              >
                <div>
                  <p className="font-medium text-neutral-900">{t.name}</p>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-neutral-400">{t.description}</p>
                  )}
                </div>
                <span className="text-xs text-neutral-400">
                  {t.body.questions.length} spørsmål
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
