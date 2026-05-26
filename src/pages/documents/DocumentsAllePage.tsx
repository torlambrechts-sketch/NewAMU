// "Alle dokumenter" — flat table view (category-architecture §T7).

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react'
import { ModuleAlleListPage } from '../../components/module/ModuleAlleListPage'
import { ModuleHeroEmptyState } from '../../components/module/ModuleHeroEmptyState'
import { Badge } from '../../components/ui/Badge'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
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
  const { orgProfiles } = useOrgSetupContext()

  const categoryNameById = useMemo(
    () => new Map(docs.spaces.map((s) => [s.id, s.title])),
    [docs.spaces],
  )
  const spaceRegulationById = useMemo(
    () => new Map(docs.spaces.map((s) => [s.id, s.regulationId ?? null])),
    [docs.spaces],
  )
  // auth user_id → display name. wiki_pages.author_id references
  // auth.users.id which orgProfiles is also keyed on, so this is direct.
  const ownerNameByUserId = useMemo(
    () => new Map(orgProfiles.map((p) => [p.id, p.display_name || p.email || '—'])),
    [orgProfiles],
  )
  // Distinct owner ids actually present in the page set drive the chip's
  // option list, so admins only see owners they can pick.
  const ownerOptions = useMemo(() => {
    const present = new Set(docs.pages.map((p) => p.authorId).filter(Boolean) as string[])
    return [...present]
      .map((id) => ({ id, label: ownerNameByUserId.get(id) ?? '(ukjent)' }))
      .sort((a, b) => a.label.localeCompare(b.label, 'nb'))
  }, [docs.pages, ownerNameByUserId])

  return (
    <ModuleAlleListPage<WikiPage>
      title="Alle dokumenter"
      description="Hver wiki-side organisasjonen har — sortert etter plass, søkbar og filtrerbar på regelverk."
      breadcrumb={[{ label: 'Dokumenter', to: '/documents' }, { label: 'Alle' }]}
      moduleSlug="documents"
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
      firstRunState={
        <ModuleHeroEmptyState
          icon={FileText}
          title="Ingen dokumenter ennå"
          body="Bygg HMS-håndboken, rutinene og policyene fra maler. Hver mal er bundet til en hjemmel (AML, IK-f, ISO eller GDPR) slik at sporbarhet til regelverket blir riktig fra første lagring."
          primary={{ label: 'Velg en dokumentmal', to: '/documents' }}
          secondary={{ label: 'Se maloversikten', to: '/documents/templates' }}
          accent="#0f766e"
        />
      }
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
          key: 'owner',
          label: 'Eier',
          render: (r) => (
            <span className="text-xs text-neutral-700">
              {r.authorId ? (ownerNameByUserId.get(r.authorId) ?? '(ukjent)') : '—'}
            </span>
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
      renderMobileRow={(r) => (
        <Link
          to={`/documents/page/${r.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[#0f766e]">{r.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
              <span className="truncate">{categoryNameById.get(r.spaceId) ?? '—'}</span>
              {r.updatedAt ? (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{new Date(r.updatedAt).toLocaleDateString('nb-NO')}</span>
                </>
              ) : null}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'}>
            {STATUS_LABEL[r.status] ?? r.status}
          </Badge>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden />
        </Link>
      )}
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
          id: 'space',
          label: 'Plass',
          options: docs.spaces.map((s) => ({ id: s.id, label: s.title })),
          accessor: (r) => r.spaceId,
        },
        {
          kind: 'enum',
          id: 'owner',
          label: 'Eier',
          options: ownerOptions,
          accessor: (r) => r.authorId ?? null,
        },
        {
          kind: 'date_range',
          id: 'updated',
          label: 'Oppdatert',
          accessor: (r) => r.updatedAt,
        },
      ]}
    />
  )
}
