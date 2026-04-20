import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, FileText, History, Loader2, PenLine, ShieldAlert } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { Tabs } from '../../src/components/ui/Tabs'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'
import type { BadgeVariant } from '../../src/components/ui/Badge'
import { useRos } from './useRos'
import { RosScopeTab } from './RosScopeTab'
import { RosHazardsTab } from './RosHazardsTab'
import { RosMeasuresTab } from './RosMeasuresTab'
import { RosSignaturesTab } from './RosSignaturesTab'
import { ROS_STATUS_LABEL, riskScore, ROS_TYPE_LABEL } from './types'
import type { RosStatus } from './types'
import { HseAuditLogViewer } from '../../src/components/hse/HseAuditLogViewer'

type Tab = 'scope' | 'hazards' | 'measures' | 'signatures' | 'history'

function rosStatusBadgeVariant(status: RosStatus): BadgeVariant {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'in_review':
      return 'info'
    case 'approved':
      return 'success'
    case 'archived':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function RosAnalysisPage({ supabase }: { supabase: SupabaseClient | null }) {
  const { rosId } = useParams<{ rosId: string }>()
  const navigate = useNavigate()
  const ros = useRos({ supabase })
  const { loadDetail } = ros
  const [activeTab, setActiveTab] = useState<Tab>('scope')

  useEffect(() => {
    if (!rosId) return
    void loadDetail(rosId)
  }, [rosId, loadDetail])

  const analysis = useMemo(() => ros.analyses.find((a) => a.id === rosId) ?? null, [ros.analyses, rosId])
  const hazards = useMemo(() => (rosId ? ros.hazardsByRos[rosId] ?? [] : []), [ros.hazardsByRos, rosId])
  const measures = useMemo(() => (rosId ? ros.measuresByRos[rosId] ?? [] : []), [ros.measuresByRos, rosId])
  const sigs = useMemo(() => (rosId ? ros.signatures[rosId] ?? [] : []), [ros.signatures, rosId])

  const critCount = hazards.filter((h) => {
    const s = riskScore(h.residual_probability, h.residual_consequence)
    return s != null && s >= 15
  }).length

  const openMeasures = measures.filter((m) => m.status === 'open' || m.status === 'in_progress').length

  const tabItems = useMemo(
    () => [
      { id: 'scope', label: 'Omfang', icon: FileText },
      {
        id: 'hazards',
        label: 'Farekilder',
        icon: ShieldAlert,
        badgeCount: critCount > 0 ? critCount : undefined,
        badgeVariant: 'danger' as const,
      },
      {
        id: 'measures',
        label: 'Tiltak',
        icon: ClipboardList,
        badgeCount: openMeasures > 0 ? openMeasures : undefined,
      },
      { id: 'signatures', label: 'Signaturer', icon: PenLine },
      { id: 'history', label: 'Historikk', icon: History },
    ],
    [critCount, openMeasures],
  )

  if (!rosId) return <div className="p-8 text-sm text-neutral-500">Mangler analyse-ID.</div>

  if (!analysis && ros.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-[#F9F7F2]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" />
        <p className="text-sm text-neutral-600">Laster analyse…</p>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F7F2]">
        <p className="font-semibold text-neutral-900">Analyse ikke funnet</p>
        <Button variant="secondary" type="button" onClick={() => navigate('/ros')}>
          Tilbake til ROS-analyser
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <header className="bg-[#F9F7F2]">
        <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-4 md:px-8">
          <WorkplacePageHeading1
            breadcrumb={[{ label: 'HMS' }, { label: 'ROS-analyser', to: '/ros' }, { label: analysis.title }]}
            title={analysis.title}
            description={
              <p className="max-w-4xl text-xs leading-relaxed text-neutral-600">
                {ROS_TYPE_LABEL[analysis.ros_type]} · v{analysis.version}
                {analysis.assessor_name ? ` · Ansvarlig: ${analysis.assessor_name}` : ''}
                {analysis.assessed_at ? ` · ${new Date(analysis.assessed_at).toLocaleDateString('nb-NO')}` : ''}
                {' · '}
                {hazards.length} farekilder · {measures.length} tiltak
              </p>
            }
            headerActions={
              <Badge variant={rosStatusBadgeVariant(analysis.status)}>{ROS_STATUS_LABEL[analysis.status]}</Badge>
            }
            menu={<Tabs items={tabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as Tab)} />}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
        {ros.error ? <WarningBox>{ros.error}</WarningBox> : null}

        {activeTab === 'scope' && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <RosScopeTab key={`${analysis.id}-${analysis.updated_at}`} analysis={analysis} ros={ros} />
          </div>
        )}
        {activeTab === 'hazards' && (
          <RosHazardsTab analysis={analysis} hazards={hazards} measures={measures} ros={ros} />
        )}
        {activeTab === 'measures' && (
          <RosMeasuresTab analysis={analysis} hazards={hazards} measures={measures} ros={ros} />
        )}
        {activeTab === 'signatures' && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <RosSignaturesTab analysis={analysis} hazards={hazards} measures={measures} signatures={sigs} ros={ros} />
          </div>
        )}
        {activeTab === 'history' && (
          <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <HseAuditLogViewer supabase={supabase} recordId={analysis.id} tableName="ros_analyses" />
          </div>
        )}
      </div>
    </div>
  )
}
