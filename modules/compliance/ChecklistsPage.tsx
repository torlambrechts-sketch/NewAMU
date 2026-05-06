// ChecklistsPage — list view for compliance checklist executions, scoped
// to the active regulation pack and (optionally) one template.
//
// When ?template=<slug> is present in the URL the page narrows to that
// template — title, banner and create-CTA reflect the template, and only
// executions of that template are listed. Without ?template=, the page
// shows the pack-level overview.
//
// The pack switcher itself lives in the global top bar
// (ShellCompliancePackSwitcher) so it is visible across compliance pages
// at the same elevation as the org switcher.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus, Settings } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleLegalBanner } from '../../src/components/module/ModuleLegalBanner'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { useActivePack } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import { ComplianceCreateForm } from './ComplianceCreateForm'
import type { ComplianceExecutionRow } from './types'

const STATUS_LABEL: Record<ComplianceExecutionRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}

function statusBadgeVariant(
  status: ComplianceExecutionRow['status'],
): 'draft' | 'active' | 'signed' {
  if (status === 'signed') return 'signed'
  if (status === 'active') return 'active'
  return 'draft'
}

function formatDate(input: string | null) {
  if (!input) return '—'
  try {
    return new Date(input).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return input
  }
}

export function ChecklistsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templateSlugParam = searchParams.get('template')

  const pack = useActivePack()
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const { load } = cl
  const [createOpen, setCreateOpen] = useState(false)

  // Reload when the active pack changes — KPIs + list are pack-scoped server-side.
  useEffect(() => {
    void load({ pack: pack.slug })
  }, [load, pack.slug])

  const packTemplates = useMemo(
    () => cl.templates.filter((t) => t.pack === pack.slug && t.is_active),
    [cl.templates, pack.slug],
  )

  // Resolve the optional ?template= filter to one of the pack's active templates.
  const focusedTemplate = useMemo(() => {
    if (!templateSlugParam) return null
    return packTemplates.find((t) => t.slug === templateSlugParam) ?? null
  }, [packTemplates, templateSlugParam])

  const visibleExecutions = useMemo(() => {
    const packScoped = cl.executions.filter((e) => e.pack === pack.slug)
    if (!focusedTemplate) return packScoped
    return packScoped.filter((e) => e.template_id === focusedTemplate.id)
  }, [cl.executions, pack.slug, focusedTemplate])

  // Templates passed to the create form are constrained to the focused
  // template when present (so the slide panel preselects it), otherwise
  // any pack-active template.
  const formTemplates = focusedTemplate ? [focusedTemplate] : packTemplates

  const pageTitle = focusedTemplate ? focusedTemplate.name : pack.pluralLabel
  const pageDescription = focusedTemplate
    ? (focusedTemplate.description ?? pack.description)
    : pack.description
  const ctaLabel = focusedTemplate
    ? `Ny ${focusedTemplate.name.toLowerCase()}`
    : pack.ctaLabel

  return (
    <ModulePageShell
      breadcrumb={
        focusedTemplate
          ? [
              { label: 'HMS' },
              { label: pack.pluralLabel, to: '/compliance/checklists' },
              { label: focusedTemplate.name },
            ]
          : [{ label: 'HMS' }, { label: pack.pluralLabel }]
      }
      title={pageTitle}
      description={pageDescription}
      headerActions={
        <div className="flex items-center gap-2">
          <Link
            to="/compliance/checklists/admin"
            aria-label="Innstillinger"
            className="inline-flex items-center border border-neutral-300 bg-white px-3 py-2 text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <Settings className="h-4 w-4" aria-hidden />
          </Link>
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
            disabled={formTemplates.length === 0}
          >
            {ctaLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

        {!focusedTemplate ? (
          <ModuleLegalBanner
            title={pack.shortName}
            intro={<p>{pack.description}</p>}
            references={pack.legalReferences.map((r) => ({
              code: r.code,
              text: r.text,
            }))}
          />
        ) : null}

        <LayoutScoreStatRow
          items={[
            {
              big: String(cl.aggregates.openCount),
              title: pack.kpiLabels.open,
              sub: 'Under behandling',
            },
            {
              big: String(cl.aggregates.criticalFindings),
              title: pack.kpiLabels.critical,
              sub: 'Krever oppfølging',
            },
            {
              big: String(cl.aggregates.ytdCompleted),
              title: pack.kpiLabels.ytd,
              sub: 'Signert i år',
            },
          ]}
        />

        <LayoutTable1PostingsShell
          wrap
          title={pageTitle}
          description={`Alle ${pageTitle.toLowerCase()} — sortert etter siste aktivitet.`}
          toolbar={null}
          footer={<span className="text-neutral-500">{visibleExecutions.length} poster</span>}
        >
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
                  <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                </tr>
              </thead>
              <tbody>
                {visibleExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="py-12 text-center">
                        <p className="text-sm text-neutral-500">
                          Ingen {pageTitle.toLowerCase()} ennå.
                        </p>
                        <div className="mt-3 inline-flex">
                          <Button
                            variant="primary"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => setCreateOpen(true)}
                            disabled={formTemplates.length === 0}
                          >
                            {ctaLabel}
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleExecutions.map((row) => (
                    <tr
                      key={row.id}
                      className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                      onClick={() => navigate(`/compliance/checklists/${row.id}`)}
                    >
                      <td className="px-5 py-3 font-medium text-neutral-900">{row.title}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-neutral-600">
                        {formatDate(row.scheduled_for)}
                      </td>
                      <td className="w-8 px-3 py-3 text-neutral-300">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </LayoutTable1PostingsShell>
      </div>

      <ComplianceCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        templates={formTemplates}
        assignableUsers={cl.assignableUsers}
        onCreate={async (payload) => {
          const id = await cl.createExecution(payload)
          if (id) {
            setCreateOpen(false)
            navigate(`/compliance/checklists/${id}`)
          }
        }}
      />
    </ModulePageShell>
  )
}
