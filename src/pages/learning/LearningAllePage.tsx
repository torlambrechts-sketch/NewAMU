// "Alle kurs" — flat table view (category-architecture §T7).

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ModuleAlleListPage } from '../../components/module/ModuleAlleListPage'
import { Badge } from '../../components/ui/Badge'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useLearning } from '../../hooks/useLearning'
import { useLearningCategories } from '../../hooks/useLearningCategories'
import type { Course } from '../../types/learning'

const STATUS_VARIANT: Record<string, 'draft' | 'active' | 'signed' | 'neutral'> = {
  draft: 'draft',
  published: 'active',
  archived: 'neutral',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladd',
  published: 'Publisert',
  archived: 'Arkivert',
}

export function LearningAllePage() {
  const { supabase } = useOrgSetupContext()
  const learning = useLearning()
  const cats = useLearningCategories({ supabase })

  const categoryNameById = useMemo(
    () => new Map(cats.categories.map((c) => [c.id, c.name])),
    [cats.categories],
  )
  const categoryRegulationById = useMemo(
    () => new Map(cats.categories.map((c) => [c.id, c.regulation_id ?? null])),
    [cats.categories],
  )

  return (
    <ModuleAlleListPage<Course>
      title="Alle kurs"
      description="Hvert kurs — sortert etter kategori, søkbart og filtrerbart på regelverk."
      breadcrumb={[{ label: 'Læring', to: '/learning' }, { label: 'Alle' }]}
      moduleSlug="learning"
      headerActions={
        <Link
          to="/learning"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Link>
      }
      rows={learning.courses}
      columns={[
        {
          key: 'title',
          label: 'Kurs',
          render: (r) => (
            <Link
              to={`/learning/courses/${r.id}`}
              className="font-medium text-[#0e7490] underline-offset-2 hover:underline"
            >
              {r.title}
            </Link>
          ),
        },
        {
          key: 'modules',
          label: 'Moduler',
          align: 'right',
          render: (r) => (
            <span className="tabular-nums text-neutral-700">{r.modules.length}</span>
          ),
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
          key: 'recert',
          label: 'Resert. (mnd)',
          render: (r) => (
            <span className="text-xs tabular-nums text-neutral-600">
              {r.recertificationMonths ?? '—'}
            </span>
          ),
        },
      ]}
      getCategoryId={(r) => r.categoryId ?? null}
      categoryNameById={categoryNameById}
      getRegulationId={(r) => (r.categoryId ? (categoryRegulationById.get(r.categoryId) ?? null) : null)}
      searchableText={(r) => [r.title, r.description, ...r.tags].join(' ')}
      chipFilters={[
        {
          kind: 'enum',
          id: 'status',
          label: 'Status',
          options: [
            { id: 'draft', label: 'Kladd' },
            { id: 'published', label: 'Publisert' },
            { id: 'archived', label: 'Arkivert' },
          ],
          accessor: (r) => r.status,
        },
        {
          kind: 'enum',
          id: 'category',
          label: 'Kategori',
          options: cats.categories.map((c) => ({ id: c.id, label: c.name })),
          accessor: (r) => r.categoryId ?? null,
        },
        {
          kind: 'date_range',
          id: 'updated',
          label: 'Sist endret',
          accessor: (r) => r.updatedAt,
        },
      ]}
    />
  )
}
