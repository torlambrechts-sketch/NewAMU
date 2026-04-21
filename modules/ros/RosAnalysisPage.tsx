import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, FileText, History, PenLine, ShieldAlert } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ModuleLegalBanner } from '../../src/components/module/ModuleLegalBanner'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { Tabs } from '../../src/components/ui/Tabs'
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

  if (!rosId) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'ROS-analyser', to: '/ros' }]}
        title="ROS-analyse"
        notFound={{ title: 'Mangler analyse-ID', onBack: () => navigate('/ros') }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!analysis && ros.loading) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'ROS-analyser', to: '/ros' }]}
        title="Laster analyse…"
        loading
        loadingLabel="Laster analyse…"
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!analysis) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'ROS-analyser', to: '/ros' }]}
        title="Analyse ikke funnet"
        notFound={{
          title: 'Analyse ikke funnet',
          backLabel: 'Tilbake til ROS-analyser',
          onBack: () => navigate('/ros'),
        }}
      >
        {null}
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
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
      tabs={<Tabs items={tabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as Tab)} />}
    >
      <ModuleLegalBanner
        collapsible
        title="ROS-analyser"
        intro={
          <p>
            Risiko- og sårbarhetsanalyser kartlegger farer og vurderer risiko på tvers av AML,
            Brann- og eksplosjonsvernloven (BVL), El-tilsynsloven (ETL), Forurensningsloven
            (FL) og Produktkontrolloven (PKL).
          </p>
        }
        references={[
          {
            code: 'IK-forskriften § 5 nr. 6',
            text: (
              <>
                Virksomheten skal kartlegge farer og problemer, vurdere risiko og utarbeide
                tilhørende planer og tiltak for å redusere risikoforholdene.
              </>
            ),
          },
          {
            code: 'AML § 2-1 og § 6-2',
            text: (
              <>
                Ansvarlig leder (arbeidsgiveransvar, AML § 2-1) og verneombud (AML § 6-2) må
                signere analysen før den godkjennes og låses.
              </>
            ),
          },
          {
            code: 'Arkivplikt',
            text: (
              <>
                Signerte analyser arkiveres i henhold til Internkontrollforskriften. Minimum
                ti års oppbevaringsplikt for HMS-dokumentasjon.
              </>
            ),
          },
        ]}
      />

      {ros.error ? <WarningBox>{ros.error}</WarningBox> : null}

      {activeTab === 'scope' && (
        <ModuleSectionCard>
          <RosScopeTab key={`${analysis.id}-${analysis.updated_at}`} analysis={analysis} ros={ros} />
        </ModuleSectionCard>
      )}
      {activeTab === 'hazards' && (
        <RosHazardsTab analysis={analysis} hazards={hazards} measures={measures} ros={ros} />
      )}
      {activeTab === 'measures' && (
        <RosMeasuresTab analysis={analysis} hazards={hazards} measures={measures} ros={ros} />
      )}
      {activeTab === 'signatures' && (
        <ModuleSectionCard>
          <RosSignaturesTab analysis={analysis} hazards={hazards} measures={measures} signatures={sigs} ros={ros} />
        </ModuleSectionCard>
      )}
      {activeTab === 'history' && (
        <ModuleSectionCard>
          <HseAuditLogViewer supabase={supabase} recordId={analysis.id} tableName="ros_analyses" />
        </ModuleSectionCard>
      )}
    </ModulePageShell>
  )
}
