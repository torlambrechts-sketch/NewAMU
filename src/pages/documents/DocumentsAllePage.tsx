// "Alle dokumenter" — flat table view (category-architecture §T7).

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ModuleAlleListPage } from '../../components/module/ModuleAlleListPage'
import { Badge } from '../../components/ui/Badge'
import { useDocuments } from '../../hooks/useDocuments'
import type { WikiPage } from '../../types/documents'

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

export function DocumentsAllePage() {
  const docs = useDocuments()

  const categoryNameById = useMemo(
    () => new Map(docs.spaces.map((s) => [s.id, s.title])),
    [docs.spaces],
  )
  const spaceRegulationById = useMemo(
    () => new Map(docs.spaces.map((s) => [s.id, s.regulationId ?? null])),
    [docs.spaces],
  )

  return (
    <ModuleAlleListPage<WikiPage>
      title="Alle dokumenter"
      description="Hver wiki-side organisasjonen har — sortert etter plass, søkbar og filtrerbar på regelverk."
      breadcrumb={[{ label: 'Dokumenter', to: '/documents' }, { label: 'Alle' }]}
      headerActions={
        <Link
          to="/documents"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Link>
      }
      rows={docs.pages}
      columns={[
        {
          key: 'title',
          label: 'Tittel',
          render: (r) => (
            <Link
              to={`/documents/page/${r.id}`}
              className="font-medium text-[#0f766e] underline-offset-2 hover:underline"
            >
              {r.title}
            </Link>
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
          key: 'next_revision',
          label: 'Neste revisjon',
          render: (r) => (
            <span className="text-xs tabular-nums text-neutral-600">
              {r.nextRevisionDueAt
                ? new Date(r.nextRevisionDueAt).toLocaleDateString('nb-NO')
                : '—'}
            </span>
          ),
        },
        {
          key: 'updated_at',
          label: 'Oppdatert',
          render: (r) => (
            <span className="text-xs tabular-nums text-neutral-600">
              {new Date(r.updatedAt).toLocaleDateString('nb-NO')}
            </span>
          ),
        },
      ]}
      getCategoryId={(r) => r.spaceId}
      categoryNameById={categoryNameById}
      getRegulationId={(r) => spaceRegulationById.get(r.spaceId) ?? null}
      searchableText={(r) => [r.title, r.summary ?? '', ...(r.legalRefs ?? [])].join(' ')}
    />
  )
}
