// "Alle undersøkelser" — flat table view (category-architecture §T7).

import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ModuleAlleListPage } from '../../src/components/module/ModuleAlleListPage'
import { Badge } from '../../src/components/ui/Badge'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useSurvey } from './useSurvey'
import { useSurveyOrgTemplates } from './useSurveyOrgTemplates'
import { useSurveyNav } from './useSurveyNav'
import type { SurveyRow } from './types'

const STATUS_VARIANT: Record<string, 'draft' | 'active' | 'signed' | 'neutral'> = {
  draft: 'draft',
  active: 'active',
  closed: 'signed',
  archived: 'neutral',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  closed: 'Lukket',
  archived: 'Arkivert',
}

export function SurveyAllePage() {
  const { supabase } = useOrgSetupContext()
  const survey = useSurvey({ supabase })
  const surveyOrgTemplates = useSurveyOrgTemplates({ supabase })
  const nav = useSurveyNav()

  useEffect(() => {
    void survey.loadSurveys()
    void survey.loadTemplateCatalog()
  }, [survey])

  const categoryByCatalogId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const t of surveyOrgTemplates.templates) m.set(t.catalogId, t.categoryId)
    return m
  }, [surveyOrgTemplates.templates])

  const categoryNameById = useMemo(
    () => new Map(nav.categories.map((c) => [c.id, c.name])),
    [nav.categories],
  )
  const categoryRegulationById = useMemo(
    () => new Map(nav.categories.map((c) => [c.id, c.regulationId])),
    [nav.categories],
  )

  return (
    <ModuleAlleListPage<SurveyRow>
      title="Alle undersøkelser"
      description="Hver undersøkelse organisasjonen har sendt — sortert etter kategori, søkbar og filtrerbar på regelverk."
      breadcrumb={[{ label: 'Undersøkelser', to: '/survey' }, { label: 'Alle' }]}
      headerActions={
        <Link
          to="/survey"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Link>
      }
      rows={survey.surveys}
      columns={[
        {
          key: 'title',
          label: 'Tittel',
          render: (r) => (
            <Link
              to={`/survey/${r.id}`}
              className="font-medium text-[#7c3aed] underline-offset-2 hover:underline"
            >
              {r.title}
            </Link>
          ),
        },
        {
          key: 'pack',
          label: 'Pakke',
          render: (r) => <span className="text-xs text-neutral-600">{r.pack}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => (
            <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'}>
              {STATUS_LABEL[r.status] ?? r.status}
            </Badge>
          ),
        },
        {
          key: 'response_count',
          label: 'Svar',
          align: 'right',
          render: (r) => (
            <span className="tabular-nums text-neutral-700">{r.response_count}</span>
          ),
        },
        {
          key: 'published_at',
          label: 'Publisert',
          render: (r) => (
            <span className="text-xs tabular-nums text-neutral-600">
              {r.published_at ? new Date(r.published_at).toLocaleDateString('nb-NO') : '—'}
            </span>
          ),
        },
      ]}
      getCategoryId={(r) =>
        r.catalog_id ? (categoryByCatalogId.get(r.catalog_id) ?? null) : null
      }
      categoryNameById={categoryNameById}
      getRegulationId={(r) => {
        if (!r.catalog_id) return null
        const catId = categoryByCatalogId.get(r.catalog_id) ?? null
        return catId ? (categoryRegulationById.get(catId) ?? null) : null
      }}
      searchableText={(r) => [r.title, r.pack, r.description ?? ''].join(' ')}
      chipFilters={[
        {
          kind: 'enum',
          id: 'status',
          label: 'Status',
          options: [
            { id: 'draft', label: 'Kladd' },
            { id: 'active', label: 'Aktiv' },
            { id: 'closed', label: 'Lukket' },
            { id: 'archived', label: 'Arkivert' },
          ],
          accessor: (r) => r.status,
        },
        {
          kind: 'enum',
          id: 'pack',
          label: 'Pakke',
          options: [...new Set(survey.surveys.map((s) => s.pack))].map((p) => ({
            id: p,
            label: p,
          })),
          accessor: (r) => r.pack,
        },
        {
          kind: 'date_range',
          id: 'published',
          label: 'Publisert',
          accessor: (r) => r.published_at ?? null,
        },
      ]}
    />
  )
}
