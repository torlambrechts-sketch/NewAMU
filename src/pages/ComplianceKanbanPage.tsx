import { ComplianceModuleChrome } from '../components/compliance/ComplianceModuleChrome'
import { ComplianceKanbanBoard } from '../components/compliance/ComplianceKanbanBoard'
import { useComplianceWorkItems } from '../components/compliance/useComplianceWorkItems'
import { buildComplianceHubItems } from '../components/compliance/complianceHubMenu'
import { ModuleLegalBanner } from '../components/module'

const LEGAL = [
  {
    code: 'IK-forskriften § 5 nr. 6',
    text: 'Systematisk overvåkning og gjennomgang av internkontrollen — tiltak skal prioriteres, fordeles og følges opp.',
  },
  {
    code: 'AML § 3-1 (2)(c)',
    text: 'Kartlegge farer og problemer og på denne bakgrunn vurdere risikoforholdene i virksomheten, utarbeide planer og iverksette tiltak.',
  },
]

export function ComplianceKanbanPage() {
  const { items, counts, loading } = useComplianceWorkItems()
  const hub = buildComplianceHubItems('kanban')

  return (
    <ComplianceModuleChrome
      breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Samsvar', to: '/compliance' }, { label: 'Kanban' }]}
      title="Samsvar — Kanban"
      description={
        <>
          Samlet arbeidskø: tiltak, ROS, inspeksjoner, SJA, årsgjennomgang og HR-saker. Status og prioritet
          synkroniseres med kildemodulen.
        </>
      }
      hubAriaLabel="Samsvar — moduler"
      hubItems={hub}
      contentCard={false}
    >
      <ModuleLegalBanner
        title="Samsvar — kanban"
        intro="Kanban-tavlen samler arbeidskravene fra hele samsvarsporteføljen i én status-styrt visning."
        references={LEGAL}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryStat label="Åpne" value={counts.open} />
        <SummaryStat label="Pågår" value={counts.in_progress} />
        <SummaryStat label="Venter signatur" value={counts.awaiting_signature} />
        <SummaryStat label="Forfalt" value={counts.overdue} tone="danger" />
        <SummaryStat label="Lukket" value={counts.completed} tone="muted" />
      </div>

      <div className="mt-6">
        {loading && counts.total === 0 ? (
          <p className="text-sm text-neutral-500">Laster…</p>
        ) : (
          <ComplianceKanbanBoard items={items} />
        )}
      </div>
    </ComplianceModuleChrome>
  )
}

function SummaryStat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'danger' | 'muted'
}) {
  const valueClass =
    tone === 'danger' ? 'text-red-700' : tone === 'muted' ? 'text-neutral-500' : 'text-neutral-900'
  return (
    <div className="rounded-lg border border-neutral-200/80 bg-white px-4 py-3">
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  )
}
