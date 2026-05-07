// SurveyVendorsPage — vendor-by-vendor survey status dashboard. Lists all
// vendors with at least one survey invitation alongside completion stats
// and a drill-in panel showing the underlying surveys.
//
// Route: /survey/leverandorer (mounted in App.tsx).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, ExternalLink } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { ModulePageShell, ModuleSectionCard } from '../components/module'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { WarningBox } from '../components/ui/AlertBox'
import { Tabs, type TabItem } from '../components/ui/Tabs'
import { SlidePanel } from '../components/layout/SlidePanel'
import { LayoutTable1PostingsShell } from '../components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../components/layout/layoutTable1PostingsKit'
import {
  useVendorSurveyStatus,
  type VendorSurveyStat,
} from '../../modules/survey/useVendorSurveyStatus'
import { VENDOR_STATUS_LABEL } from '../../modules/survey/types'

type Filter = 'active' | 'all'

const FILTER_TABS: TabItem[] = [
  { id: 'active', label: 'Aktive' },
  { id: 'all', label: 'Alle' },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

export function SurveyVendorsPage() {
  const { supabase } = useOrgSetupContext()
  const navigate = useNavigate()
  const { stats, error, loading } = useVendorSurveyStatus({ supabase })
  const [filter, setFilter] = useState<Filter>('active')
  const [drilldown, setDrilldown] = useState<VendorSurveyStat | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return stats
    return stats.filter((s) => s.vendor.is_active && s.vendor.status === 'active')
  }, [stats, filter])

  const totals = useMemo(() => {
    let invitations = 0
    let completed = 0
    for (const s of filtered) {
      invitations += s.totalInvitations
      completed += s.completedInvitations
    }
    return {
      vendors: filtered.length,
      invitations,
      completed,
      pct: invitations > 0 ? Math.round((completed / invitations) * 100) : 0,
    }
  }, [filtered])

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Undersøkelser', to: '/survey' },
        { label: 'Leverandører' },
      ]}
      title="Leverandørstatus"
      description="Per-leverandør-oversikt over hvor mange undersøkelser som er sendt og hvor mange som er fullført."
      headerActions={
        <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey')}>
          <ArrowLeft className="h-4 w-4" /> Tilbake
        </Button>
      }
    >
      <div className="space-y-6">
        {error ? <WarningBox>{error}</WarningBox> : null}

        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#1a3d32]" aria-hidden />
              <div>
                <p className="text-sm font-medium text-neutral-800">Sammendrag</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {totals.vendors} {totals.vendors === 1 ? 'leverandør' : 'leverandører'} ·
                  {' '}
                  {totals.completed} av {totals.invitations} invitasjoner fullført
                  {totals.invitations > 0 ? ` (${totals.pct}%)` : ''}
                </p>
              </div>
            </div>
            <Tabs items={FILTER_TABS} activeId={filter} onChange={(id) => setFilter(id as Filter)} />
          </div>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5 md:p-6">
          <LayoutTable1PostingsShell
            wrap={false}
            title="Leverandører"
            description={`${filtered.length} ${filtered.length === 1 ? 'rad' : 'rader'}`}
            toolbar={null}
          >
            {loading && filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">Laster…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                Ingen leverandører har mottatt undersøkelser ennå. Opprett en
                leverandør under Innstillinger → Leverandører og send en
                undersøkelse fra leverandørpakken.
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Leverandør</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Fullført</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Fremdrift</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Sist aktivitet</th>
                      <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Detaljer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.vendor.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <span className="font-medium text-neutral-900">{s.vendor.display_name}</span>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <Badge variant={s.vendor.status === 'active' ? 'success' : 'neutral'}>
                            {VENDOR_STATUS_LABEL[s.vendor.status]}
                          </Badge>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <span className="font-medium text-neutral-800">
                            {s.completedInvitations}
                          </span>
                          <span className="text-neutral-500"> av {s.totalInvitations}</span>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-32 overflow-hidden rounded-full bg-neutral-100"
                              role="progressbar"
                              aria-valuenow={s.completionPct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="h-full rounded-full bg-[#1a3d32]"
                                style={{ width: `${s.completionPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-neutral-600">{s.completionPct}%</span>
                          </div>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>{formatDate(s.lastActivityAt)}</td>
                        <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right`}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDrilldown(s)}
                          >
                            Se undersøkelser
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LayoutTable1PostingsShell>
        </ModuleSectionCard>
      </div>

      <SlidePanel
        open={drilldown !== null}
        onClose={() => setDrilldown(null)}
        title={drilldown ? `Undersøkelser — ${drilldown.vendor.display_name}` : 'Undersøkelser'}
        titleId="vendor-drilldown"
        footer={
          <div className="flex w-full justify-end">
            <Button type="button" variant="secondary" onClick={() => setDrilldown(null)}>
              Lukk
            </Button>
          </div>
        }
      >
        {drilldown ? (
          drilldown.surveys.length === 0 ? (
            <p className="text-sm text-neutral-500">Ingen undersøkelser registrert.</p>
          ) : (
            <ul className="space-y-2">
              {drilldown.surveys.map((s) => (
                <li
                  key={s.invitationId}
                  className="rounded-md border border-neutral-200/80 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{s.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Oppdatert {formatDate(s.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Badge variant={s.invitationStatus === 'completed' ? 'success' : 'warning'}>
                        {s.invitationStatus === 'completed' ? 'Fullført' : 'Avventer'}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDrilldown(null)
                          navigate(`/survey/${s.surveyId}`)
                        }}
                        aria-label="Åpne undersøkelse"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </SlidePanel>
    </ModulePageShell>
  )
}
