// ChecklistsPage — list view for compliance checklist executions, scoped to
// the active regulation pack. Title, description, KPIs, action button and
// the visible table all change when the user toggles the PackSwitcher in
// the page header. Underlying data layer is unchanged.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
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
import { PackSwitcher } from './components/PackSwitcher'
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
  const pack = useActivePack()
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const { load } = cl
  const [createOpen, setCreateOpen] = useState(false)

  // Reload when the active pack changes — KPIs + list are pack-scoped server-side.
  useEffect(() => {
    void load({ pack: pack.slug })
  }, [load, pack.slug])

  const packExecutions = useMemo(
    () => cl.executions.filter((e) => e.pack === pack.slug),
    [cl.executions, pack.slug],
  )

  const packTemplates = useMemo(
    () => cl.templates.filter((t) => t.pack === pack.slug && t.is_active),
    [cl.templates, pack.slug],
  )

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: pack.pluralLabel }]}
      title={pack.pluralLabel}
      description={pack.description}
      headerActions={
        <div className="flex items-center gap-2">
          <PackSwitcher />
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
            disabled={packTemplates.length === 0}
          >
            {pack.ctaLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

        <ModuleLegalBanner
          title={pack.shortName}
          intro={<p>{pack.description}</p>}
          references={pack.legalReferences.map((r) => ({ code: r.code, text: r.text }))}
        />

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
          title={pack.pluralLabel}
          description={`Alle ${pack.pluralLabel.toLowerCase()} — sortert etter siste aktivitet.`}
          toolbar={null}
          footer={<span className="text-neutral-500">{packExecutions.length} poster</span>}
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
                {packExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="py-12 text-center">
                        <p className="text-sm text-neutral-500">
                          Ingen {pack.pluralLabel.toLowerCase()} ennå.
                        </p>
                        <div className="mt-3 inline-flex">
                          <Button
                            variant="primary"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => setCreateOpen(true)}
                            disabled={packTemplates.length === 0}
                          >
                            {pack.ctaLabel}
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  packExecutions.map((row) => (
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
        templates={packTemplates}
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
