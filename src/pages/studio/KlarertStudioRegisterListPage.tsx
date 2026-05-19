// Studio register-type (catalogue) list page.
// Shows system types (read-only, "Kopier") and org-authored types ("Rediger").
// Groups by system vs. org for easy scanning.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StudioListSkeleton } from '../../components/studio/StudioListSkeleton'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type RegisterTypeRow = {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  metadata_schema: { fields?: unknown[] } | null
  is_active: boolean
  is_system: boolean
  position: number
  created_at: string
}

function fieldCount(row: RegisterTypeRow): number {
  return row.metadata_schema?.fields?.length ?? 0
}

export function KlarertStudioRegisterListPage() {
  const { supabase, organization } = useOrgSetupContext()
  const navigate = useNavigate()
  const [rows, setRows] = useState<RegisterTypeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    setLoading(true)

    const systemQ = supabase
      .from('register_types')
      .select('*')
      .eq('is_system', true)
      .is('organization_id', null)
      .order('position', { ascending: true })

    const orgQ = supabase
      .from('register_types')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })

    void Promise.all([systemQ, orgQ]).then(([sysRes, orgRes]) => {
      const all: RegisterTypeRow[] = [
        ...((sysRes.data ?? []) as RegisterTypeRow[]),
        ...((orgRes.data ?? []) as RegisterTypeRow[]),
      ]
      setRows(all)
      setLoading(false)
    })
  }, [supabase, organization?.id])

  const systemRows = rows.filter((r) => r.is_system && r.organization_id == null)
  const orgRows = rows.filter((r) => r.organization_id != null)

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Registertyper</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bygg og rediger registertyper (kataloger) med tilpassede feltskjemaer.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/studio/register/new')}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Ny registertype
        </Button>
      </div>

      {loading ? (
        <div className="space-y-8">
          <StudioListSkeleton rows={3} showHeader />
          <StudioListSkeleton rows={4} showHeader />
        </div>
      ) : (
        <>
          {/* Org-authored types */}
          {orgRows.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                Dine registertyper
              </h2>
              <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                {orgRows.map((row) => (
                  <TypeRow
                    key={row.id}
                    row={row}
                    onEdit={() => navigate(`/studio/register/${row.id}`)}
                    onCopy={() => navigate(`/studio/register/new?from=${row.id}`)}
                    canEdit
                  />
                ))}
              </div>
            </section>
          )}

          {orgRows.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-neutral-500">
                Du har ingen egne registertyper ennå.
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                Klikk «Ny registertype» eller kopier en systemtype nedenfor.
              </p>
            </div>
          )}

          {/* System types */}
          {systemRows.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                Systemtyper
              </h2>
              <p className="text-xs text-neutral-400">
                Disse kan ikke redigeres direkte — kopier dem for å lage din versjon.
              </p>
              <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm">
                {systemRows.map((row) => (
                  <TypeRow
                    key={row.id}
                    row={row}
                    onEdit={() => navigate(`/studio/register/${row.id}`)}
                    onCopy={() => navigate(`/studio/register/new?from=${row.id}`)}
                    canEdit={false}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function TypeRow({
  row,
  onEdit,
  onCopy,
  canEdit,
}: {
  row: RegisterTypeRow
  onEdit: () => void
  onCopy: () => void
  canEdit: boolean
}) {
  const count = fieldCount(row)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-800">{row.name}</p>
        {row.description && (
          <p className="mt-0.5 truncate text-xs text-neutral-400">{row.description}</p>
        )}
        <p className="mt-0.5 text-xs text-neutral-400">
          {count} {count === 1 ? 'felt' : 'felt'}
          {!row.is_active && (
            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
              Inaktiv
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          title="Kopier registertype"
        >
          <Copy className="h-3.5 w-3.5" />
          Kopier
        </button>
        <Button
          variant={canEdit ? 'secondary' : 'secondary'}
          size="sm"
          onClick={onEdit}
          className="gap-1"
        >
          {canEdit ? (
            <>
              <Pencil className="h-3.5 w-3.5" />
              Rediger
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              Vis
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
