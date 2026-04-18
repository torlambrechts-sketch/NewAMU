import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, FileText, History, Loader2, PenLine, ShieldAlert } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { HubMenu1Bar, type HubMenu1Item } from '../../src/components/layout/HubMenu1Bar'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { useRos } from './useRos'
import { RosScopeTab }    from './RosScopeTab'
import { RosHazardsTab }  from './RosHazardsTab'
import { RosMeasuresTab } from './RosMeasuresTab'
import { RosSignaturesTab } from './RosSignaturesTab'
import { ROS_STATUS_LABEL, ROS_STATUS_COLOR, riskScore, ROS_TYPE_LABEL } from './types'

type Tab = 'scope' | 'hazards' | 'measures' | 'signatures' | 'history'

export function RosAnalysisPage({ supabase }: { supabase: SupabaseClient | null }) {
  const { rosId } = useParams<{ rosId: string }>()
  const navigate = useNavigate()
  const ros = useRos({ supabase })
  const [activeTab, setActiveTab] = useState<Tab>('scope')

  useEffect(() => {
    if (!rosId) return
    void ros.loadDetail(rosId)
  }, [rosId, ros.loadDetail])

  const analysis    = useMemo(() => ros.analyses.find((a) => a.id === rosId) ?? null, [ros.analyses, rosId])
  const hazards     = useMemo(() => (rosId ? ros.hazardsByRos[rosId] ?? [] : []), [ros.hazardsByRos, rosId])
  const measures    = useMemo(() => (rosId ? ros.measuresByRos[rosId] ?? [] : []), [ros.measuresByRos, rosId])
  const sigs        = useMemo(() => (rosId ? ros.signatures[rosId] ?? [] : []), [ros.signatures, rosId])

  const critCount = hazards.filter((h) => {
    const s = riskScore(h.residual_probability, h.residual_consequence)
    return s != null && s >= 15
  }).length

  const openMeasures = measures.filter((m) => m.status === 'open' || m.status === 'in_progress').length

  const menuItems = useMemo<HubMenu1Item[]>(() => [
    { key: 'scope',      label: 'Omfang',    icon: FileText,    active: activeTab === 'scope',      onClick: () => setActiveTab('scope') },
    { key: 'hazards',    label: 'Farekilder', icon: ShieldAlert, active: activeTab === 'hazards',   onClick: () => setActiveTab('hazards'),
      badgeCount: critCount > 0 ? critCount : undefined, badgeVariant: 'danger' },
    { key: 'measures',   label: 'Tiltak',    icon: ClipboardList, active: activeTab === 'measures', onClick: () => setActiveTab('measures'),
      badgeCount: openMeasures > 0 ? openMeasures : undefined },
    { key: 'signatures', label: 'Signaturer', icon: PenLine,    active: activeTab === 'signatures', onClick: () => setActiveTab('signatures') },
    { key: 'history',    label: 'Historikk', icon: History,     active: activeTab === 'history',    onClick: () => setActiveTab('history') },
  ], [activeTab, critCount, openMeasures])

  if (!rosId) return <div className="p-8 text-sm text-neutral-500">Mangler analyse-ID.</div>

  if (!analysis && ros.loading) return (
    <div className="flex min-h-screen items-center justify-center gap-3 bg-[#F9F7F2]">
      <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" />
      <p className="text-sm text-neutral-600">Laster analyse…</p>
    </div>
  )

  if (!analysis) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F7F2]">
      <p className="font-semibold text-neutral-900">Analyse ikke funnet</p>
      <button type="button" onClick={() => navigate('/ros')}
        className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50">
        ← Tilbake til ROS-analyser
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-[#F9F7F2]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-4 md:px-8">
          <WorkplacePageHeading1
            breadcrumb={[
              { label: 'HMS' },
              { label: 'ROS-analyser', to: '/ros' },
              { label: analysis.title },
            ]}
            title={analysis.title}
            description={
              <p className="max-w-4xl text-xs leading-relaxed text-neutral-600">
                {ROS_TYPE_LABEL[analysis.ros_type]} · v{analysis.version}
                {analysis.assessor_name ? ` · Ansvarlig: ${analysis.assessor_name}` : ''}
                {analysis.assessed_at ? ` · ${new Date(analysis.assessed_at).toLocaleDateString('nb-NO')}` : ''}
                {' · '}{hazards.length} farekilder · {measures.length} tiltak
              </p>
            }
            headerActions={
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ROS_STATUS_COLOR[analysis.status]}`}>
                {ROS_STATUS_LABEL[analysis.status]}
              </span>
            }
            menu={<HubMenu1Bar ariaLabel="ROS-seksjoner" items={menuItems} />}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        {ros.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {ros.error}
          </div>
        )}

        <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
          {activeTab === 'scope'      && <RosScopeTab      analysis={analysis} ros={ros} />}
          {activeTab === 'hazards'    && <RosHazardsTab    analysis={analysis} hazards={hazards} measures={measures} ros={ros} />}
          {activeTab === 'measures'   && <RosMeasuresTab   analysis={analysis} hazards={hazards} measures={measures} ros={ros} />}
          {activeTab === 'signatures' && <RosSignaturesTab analysis={analysis} hazards={hazards} measures={measures} signatures={sigs} ros={ros} />}
          {activeTab === 'history'    && (
            <div className="px-5 py-5 text-sm text-neutral-400">
              Historikk — koble til HseAuditLogViewer med recordId=rosId og tableName="ros_analyses".
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
