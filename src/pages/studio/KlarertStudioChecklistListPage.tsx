// Studio checklist template list — merges system templates and org-owned
// templates. System templates show "Kopier"; org templates show "Rediger".
// Groups by compliance pack for easy scanning.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { ComplianceTemplateRow } from '../../../modules/compliance/types'

type TemplateRow = ComplianceTemplateRow & { isSystem: boolean; studio_blocks?: unknown }

const PACK_LABELS: Record<string, string> = {
  'aml-amu': 'AML / AMU',
  'iso-45001': 'ISO 45001',
  'iso-9001': 'ISO 9001',
  'iso-14001': 'ISO 14001',
  'iso-27001': 'ISO 27001',
}

const REVIEW_STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-500',
  reviewed: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  reviewed: 'Gjennomgått',
  approved: 'Godkjent',
}

function itemCount(row: ComplianceTemplateRow): number {
  if (row.definition == null || typeof row.definition !== 'object') return 0
  const def = row.definition as { items?: unknown[] }
  return def.items?.length ?? 0
}

export function KlarertStudioChecklistListPage() {
  const { supabase, organization } = useOrgSetupContext()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    setLoading(true)

    const systemQ = supabase
      .from('compliance_checklist_templates')
      .select('*')
      .eq('is_system', true)
      .eq('is_active', true)
      .is('organization_id', null)
      .order('name')

    const orgQ = supabase
      .from('compliance_checklist_templates')
      .select('*')
      .eq('organization_id', organization.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    void Promise.all([systemQ, orgQ]).then(([sysRes, orgRes]) => {
      const toRows = (rows: unknown[], isSystem: boolean): TemplateRow[] =>
        (rows ?? []).map((r) => ({ ...(r as ComplianceTemplateRow), isSystem }))

      setTemplates([
        ...toRows(sysRes.data ?? [], true),
        ...toRows(orgRes.data ?? [], false),
      ])
      setLoading(false)
    })
  }, [supabase, organization?.id])

  const grouped = templates.reduce<Record<string, TemplateRow[]>>((acc, t) => {
    const key = PACK_LABELS[t.pack] ?? t.pack
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
              <h1 className="text-2xl font-bold text-neutral-900">Sjekklister</h1>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/studio/checklist/new')}
            className="gap-1.5 bg-[#1a3d32] hover:bg-[#1a3d32]/90"
          >
            <Plus className="h-4 w-4" />
            Ny sjekkliste
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 py-20 text-center">
            <p className="text-sm font-medium text-neutral-500">Ingen maler ennå</p>
            <p className="mt-1 text-xs text-neutral-400">
              Klikk «Ny sjekkliste» for å komme i gang.
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
                        onClick={() => navigate(`/studio/checklist/${t.id}`)}
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
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${REVIEW_STATUS_CLASSES[t.review_status] ?? REVIEW_STATUS_CLASSES.draft}`}
                            >
                              {REVIEW_STATUS_LABELS[t.review_status] ?? t.review_status}
                            </span>
                          )}
                          {!t.isSystem && t.is_active && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Aktiv
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-neutral-400">
                            {t.description}
                          </p>
                        )}
                      </button>

                      {/* Right: item count + actions */}
                      <div className="ml-4 flex shrink-0 items-center gap-3">
                        <span className="text-xs text-neutral-400">
                          {itemCount(t)} sjekkpunkter
                        </span>

                        <button
                          type="button"
                          onClick={() => navigate(`/studio/checklist/new?from=${t.id}`)}
                          className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
                          title="Kopier mal"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Kopier
                        </button>

                        {!t.isSystem && (
                          <button
                            type="button"
                            onClick={() => navigate(`/studio/checklist/${t.id}`)}
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
