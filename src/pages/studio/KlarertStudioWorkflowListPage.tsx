// Studio workflow template list page.
// Two sections:
//   1. System catalog (workflow_rule_catalog, is_published=true) — fork only
//   2. Org templates (workflow_rules, is_template=true) — edit + delete
//
// Org users with workflows.compose or is_org_admin may create and edit templates.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowUpCircle, Copy, Loader2, Pencil, Plus, Shield, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StudioListSkeleton } from '../../components/studio/StudioListSkeleton'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { WorkflowRuleCatalogRow, WorkflowRuleRow } from '../../../src/types/workflow'

const MODULE_LABELS: Record<string, string> = {
  inspection: 'HMS-inspeksjon',
  ros: 'Risikovurdering',
  action_plan: 'Handlingsplan',
  internkontroll: 'Internkontroll',
  vernerunder: 'Vernerunde',
  meetings: 'Møter',
  survey: 'Spørreundersøkelse',
  documents: 'Dokumenter',
  compliance_checklist: 'Sjekkliste',
  tasks: 'Oppgaver',
  learning: 'Læring',
  registers: 'Register',
}

export function KlarertStudioWorkflowListPage() {
  const { supabase, organization } = useOrgSetupContext()
  const navigate = useNavigate()

  const [catalog, setCatalog] = useState<WorkflowRuleCatalogRow[]>([])
  const [orgTemplates, setOrgTemplates] = useState<WorkflowRuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    setLoading(true)

    const catalogQ = supabase
      .from('workflow_rule_catalog')
      .select('*')
      .eq('is_published', true)
      .order('source_module')
      .order('created_at', { ascending: false })

    const orgQ = supabase
      .from('workflow_rules')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('is_template', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    void Promise.all([catalogQ, orgQ]).then(([catRes, orgRes]) => {
      setCatalog((catRes.data ?? []) as WorkflowRuleCatalogRow[])
      setOrgTemplates((orgRes.data ?? []) as WorkflowRuleRow[])
      setLoading(false)
    })
  }, [supabase, organization?.id])

  async function handleDelete(id: string) {
    if (!supabase || !organization?.id) return
    if (!confirm('Slett denne malen? Dette kan ikke angres.')) return
    setDeletingId(id)
    await supabase
      .from('workflow_rules')
      .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .eq('is_template', true)
    const deleted = orgTemplates.find((r) => r.id === id)
    setOrgTemplates((prev) => prev.filter((r) => r.id !== id))
    setDeletingId(null)
    toast.success(deleted ? `«${deleted.name}» ble slettet` : 'Mal slettet')
  }

  // Detect org templates whose source catalog entry has a newer version.
  // Keyed by catalog_slug → current catalog_version.
  const catalogVersionBySlug = Object.fromEntries(
    catalog.map((r) => [r.slug, r.catalog_version]),
  )
  const staleTemplateIds = new Set(
    orgTemplates
      .filter(
        (r) =>
          r.catalog_slug &&
          r.catalog_version !== undefined &&
          (catalogVersionBySlug[r.catalog_slug] ?? 0) > r.catalog_version,
      )
      .map((r) => r.id),
  )

  // Group catalog by source_module
  const catalogByModule = catalog.reduce<Record<string, WorkflowRuleCatalogRow[]>>((acc, r) => {
    const key = MODULE_LABELS[r.source_module] ?? r.source_module
    ;(acc[key] ??= []).push(r)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Arbeidsflyt-maler</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bygg og administrer automatiseringsmaler som andre kan installere i
            Arbeidsflyt-modulen.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/studio/workflow/new')}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Ny mal
        </Button>
      </div>

      {loading ? (
        <div className="space-y-8">
          <StudioListSkeleton rows={3} showHeader />
          <StudioListSkeleton rows={5} showHeader />
        </div>
      ) : (
        <>
          {/* Org templates */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Dine maler
            </h2>
            {orgTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center">
                <p className="text-sm font-medium text-neutral-500">Ingen egne maler ennå.</p>
                <p className="mt-1 text-sm text-neutral-400">
                  Klikk «Ny mal» eller kopier en systemmal nedenfor.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                {orgTemplates.map((row) => (
                  <OrgTemplateRow
                    key={row.id}
                    row={row}
                    deleting={deletingId === row.id}
                    updateAvailable={staleTemplateIds.has(row.id)}
                    onEdit={() => navigate(`/studio/workflow/${row.id}`)}
                    onCopy={() => navigate(`/studio/workflow/new?from=${row.id}`)}
                    onDelete={() => handleDelete(row.id)}
                    onUpdate={() => {
                      const catEntry = catalog.find((c) => c.slug === row.catalog_slug)
                      if (catEntry) navigate(`/studio/workflow/new?from=${catEntry.id}`)
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* System catalog */}
          {Object.keys(catalogByModule).length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  Systemkatalog
                </h2>
                <p className="mt-1 text-xs text-neutral-400">
                  System-maler kan ikke redigeres direkte — kopier dem for å lage din versjon.
                </p>
              </div>
              {Object.entries(catalogByModule).map(([moduleLabel, rows]) => (
                <div key={moduleLabel} className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-neutral-500">{moduleLabel}</h3>
                  <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm">
                    {rows.map((row) => (
                      <CatalogRow
                        key={row.id}
                        row={row}
                        onCopy={() => navigate(`/studio/workflow/new?from=${row.id}`)}
                        onView={() => navigate(`/studio/workflow/${row.id}`)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function OrgTemplateRow({
  row,
  deleting,
  updateAvailable,
  onEdit,
  onCopy,
  onDelete,
  onUpdate,
}: {
  row: WorkflowRuleRow
  deleting: boolean
  updateAvailable: boolean
  onEdit: () => void
  onCopy: () => void
  onDelete: () => void
  onUpdate: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-neutral-800">{row.name}</p>
          {updateAvailable && (
            <span
              title="Systemkatalogen har en ny versjon — kopier for å hente oppdateringen"
              className="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
            >
              <ArrowUpCircle className="h-3 w-3" />
              Oppdatering tilgjengelig
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-400">
          {MODULE_LABELS[row.source_module] ?? row.source_module}
          {row.trigger_event_name && (
            <span className="ml-1 text-neutral-300">· {row.trigger_event_name}</span>
          )}
          {!row.is_active && (
            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
              Utkast
            </span>
          )}
          {(row.law_refs?.length ?? 0) > 0 && (
            <span className="ml-2 text-emerald-600">{row.law_refs!.join(' · ')}</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {updateAvailable && (
          <button
            type="button"
            onClick={onUpdate}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
            title="Lag en kopi fra den nyeste systemversjonen"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Oppdater
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          <Copy className="h-3.5 w-3.5" />
          Kopier
        </button>
        <Button variant="secondary" size="sm" onClick={onEdit} className="gap-1">
          <Pencil className="h-3.5 w-3.5" />
          Rediger
        </Button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded p-1.5 text-neutral-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
          aria-label="Slett mal"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

function CatalogRow({
  row,
  onCopy,
  onView,
}: {
  row: WorkflowRuleCatalogRow
  onCopy: () => void
  onView: () => void
}) {
  const name = row.name_i18n?.nb ?? row.slug
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-neutral-700">{name}</p>
          {row.contains_gov_action && (
            <span
              title="Inneholder myndighetsrapportering"
              className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600"
            >
              <Shield className="inline h-2.5 w-2.5" /> Gov
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-400">
          {MODULE_LABELS[row.source_module] ?? row.source_module}
          {row.trigger_event_name && (
            <span className="ml-1 text-neutral-300">· {row.trigger_event_name}</span>
          )}
          {row.law_refs.length > 0 && (
            <span className="ml-2 text-emerald-600">{row.law_refs.join(' · ')}</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          <Copy className="h-3.5 w-3.5" />
          Kopier
        </button>
        <Button variant="secondary" size="sm" onClick={onView} className="gap-1">
          Vis
        </Button>
      </div>
    </div>
  )
}
