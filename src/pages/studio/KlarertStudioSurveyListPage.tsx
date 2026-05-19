// Studio survey template list — merges system templates (is_system=true,
// organization_id IS NULL) and org-owned templates into one view.
// System templates show a "Kopier" action; org templates show "Rediger".
// Groups by pack/category for easy scanning.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StudioListSkeleton } from '../../components/studio/StudioListSkeleton'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import {
  CatalogRowForListSchema,
  type SurveyTemplateCatalogRow,
} from '../../../modules/survey/surveyTemplateCatalogTypes'

type TemplateRow = SurveyTemplateCatalogRow & { isSystem: boolean }

const PACK_LABELS: Record<string, string> = {
  engagement: 'Engasjement',
  safety: 'HMS / Sikkerhet',
  onboarding: 'Onboarding',
  pulse: 'Puls',
  exit: 'Exit',
  custom: 'Egendefinert',
}

export function KlarertStudioSurveyListPage() {
  const { supabase, organization } = useOrgSetupContext()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    setLoading(true)

    const systemQ = supabase
      .from('survey_template_catalog')
      .select('*')
      .eq('is_system', true)
      .eq('is_active', true)
      .is('organization_id', null)
      .order('name')

    const orgQ = supabase
      .from('survey_template_catalog')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })

    void Promise.all([systemQ, orgQ]).then(([sysRes, orgRes]) => {
      const parse = (rows: unknown[], isSystem: boolean): TemplateRow[] =>
        (rows ?? []).flatMap((row) => {
          const p = CatalogRowForListSchema.safeParse(row)
          return p.success ? [{ ...p.data, isSystem }] : []
        })

      setTemplates([
        ...parse(sysRes.data ?? [], true),
        ...parse(orgRes.data ?? [], false),
      ])
      setLoading(false)
    })
  }, [supabase, organization?.id])

  // Group by pack label
  const grouped = templates.reduce<Record<string, TemplateRow[]>>((acc, t) => {
    const key = PACK_LABELS[t.pack ?? 'custom'] ?? t.pack ?? 'Annet'
    ;(acc[key] ??= []).push(t)
    return acc
  }, {})

  const groups = Object.entries(grouped)

  return (
    <div className="min-h-full bg-[#f5f4f0]">
      <div className="mx-auto max-w-[1400px] px-6 py-10">
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

        {/* Content */}
        {loading ? (
          <StudioListSkeleton rows={4} showHeader={false} />
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 py-20 text-center">
            <p className="text-sm font-medium text-neutral-500">Ingen maler ennå</p>
            <p className="mt-1 text-xs text-neutral-400">
              Klikk «Ny undersøkelse» for å komme i gang.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(([groupLabel, rows]) => (
              <section key={groupLabel}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  {groupLabel}
                </h2>
                <div className="space-y-2">
                  {rows.map((t) => (
                    <div
                      key={t.id}
                      className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:border-neutral-300 hover:shadow"
                    >
                      {/* Left: name + meta */}
                      <button
                        type="button"
                        onClick={() => navigate(`/studio/survey/${t.id}`)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-neutral-900">{t.name}</p>
                          {t.isSystem ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                              System
                            </span>
                          ) : (
                            <span
                              className={[
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                t.is_active
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700',
                              ].join(' ')}
                            >
                              {t.is_active ? 'Aktiv' : 'Utkast'}
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-neutral-400">
                            {t.description}
                          </p>
                        )}
                      </button>

                      {/* Right: question count + actions */}
                      <div className="ml-4 flex shrink-0 items-center gap-3">
                        <span className="text-xs text-neutral-400">
                          {t.body.questions.length} spørsmål
                        </span>

                        {/* Copy is available for all templates */}
                        <button
                          type="button"
                          onClick={() => navigate(`/studio/survey/new?from=${t.id}`)}
                          className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
                          title="Kopier mal"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Kopier
                        </button>

                        {/* Edit only for org templates */}
                        {!t.isSystem && (
                          <button
                            type="button"
                            onClick={() => navigate(`/studio/survey/${t.id}`)}
                            className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
                            title="Rediger mal"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Rediger
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
