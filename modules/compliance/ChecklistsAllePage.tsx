// "Alle sjekklister" — flat table view of every compliance checklist
// execution this org has, sorted by category and narrowable via the
// cross-module regulation filter (category-architecture §T7).

import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ModuleAlleListPage } from '../../src/components/module/ModuleAlleListPage'
import { Badge } from '../../src/components/ui/Badge'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import { useComplianceNav } from './useComplianceNav'
import type { ComplianceExecutionRow } from './types'

const STATUS_VARIANT: Record<string, 'draft' | 'active' | 'signed' | 'neutral'> = {
  draft: 'draft',
  active: 'active',
  signed: 'signed',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}

export function ChecklistsAllePage() {
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const nav = useComplianceNav()

  useEffect(() => {
    void cl.load()
  }, [cl])

  const templateById = useMemo(() => {
    return new Map(cl.templates.map((t) => [t.id, t]))
  }, [cl.templates])

  const categoryNameById = useMemo(
    () => new Map(nav.categories.map((c) => [c.id, c.name])),
    [nav.categories],
  )
  const categoryRegulationById = useMemo(
    () => new Map(nav.categories.map((c) => [c.id, c.regulationId])),
    [nav.categories],
  )

  return (
    <ModuleAlleListPage<ComplianceExecutionRow>
      title="Alle sjekklister"
      description="Hver kjøring av en sjekklistemal — sortert etter kategori, søkbar og filtrerbar på regelverk."
      breadcrumb={[
        { label: 'Sjekklister', to: '/compliance/checklists' },
        { label: 'Alle' },
      ]}
      headerActions={
        <Link
          to="/compliance/checklists"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Link>
      }
      rows={cl.executions}
      columns={[
        {
          key: 'title',
          label: 'Tittel',
          render: (r) => (
            <Link
              to={`/compliance/checklists/${r.id}`}
              className="font-medium text-[#1a3d32] underline-offset-2 hover:underline"
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
          key: 'created_at',
          label: 'Opprettet',
          render: (r) => (
            <span className="text-xs tabular-nums text-neutral-600">
              {new Date(r.created_at).toLocaleDateString('nb-NO')}
            </span>
          ),
        },
      ]}
      getCategoryId={(r) => templateById.get(r.template_id)?.category_id ?? null}
      categoryNameById={categoryNameById}
      getRegulationId={(r) => {
        const catId = templateById.get(r.template_id)?.category_id ?? null
        return catId ? (categoryRegulationById.get(catId) ?? null) : null
      }}
      searchableText={(r) =>
        [r.title, r.pack, templateById.get(r.template_id)?.name].filter(Boolean).join(' ')
      }
    />
  )
}
