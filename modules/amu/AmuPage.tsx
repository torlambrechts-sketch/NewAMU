import { useState, type ReactNode } from 'react'
import { ModulePageShell } from '../../src/components/module'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { Tabs } from '../../src/components/ui/Tabs'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { useAmu } from './useAmu'
import { AnnualReportTab } from './tabs/AnnualReportTab'
import { CriticalTab } from './tabs/CriticalTab'
import { MeetingRoomTab } from './tabs/MeetingRoomTab'
import { MembersTab } from './tabs/MembersTab'
import { OverviewTab } from './tabs/OverviewTab'
import { ScheduleTab } from './tabs/ScheduleTab'

const TABS = [
  { id: 'overview', label: 'Oversikt' },
  { id: 'members', label: 'Medlemmer' },
  { id: 'schedule', label: 'Møteplan' },
  { id: 'meetingroom', label: 'Møterom' },
  { id: 'critical', label: 'Kritiske saker' },
  { id: 'report', label: 'Årsrapport' },
] as const

type TabId = (typeof TABS)[number]['id']

export function AmuPage({
  tabs: hubRootTabs,
  hideAdminNav: _hideAdminNav = false,
}: {
  /** Ytre faner (f.eks. Møter / Innstillinger) fra `AmuHubPage`. */
  tabs?: ReactNode
  hideAdminNav?: boolean
} = {}) {
  const amu = useAmu()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const moduleTabItems = TABS.map((t) => ({
    ...t,
    badgeCount:
      t.id === 'members'
        ? amu.members.length
        : t.id === 'schedule'
          ? amu.meetings.filter((m) => m.status === 'scheduled' || m.status === 'draft').length
          : t.id === 'critical'
            ? amu.criticalQueue.length
            : undefined,
    badgeVariant: t.id === 'critical' && amu.criticalQueue.length > 0 ? ('danger' as const) : undefined,
  }))

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Medvirkning' }, { label: 'Arbeidsmiljøutvalg' }]}
      title="Arbeidsmiljøutvalg"
      description="Partssammensatt utvalg som behandler virksomhetens HMS-arbeid"
      headerActions={
        <>
          <Button
            variant="secondary"
            type="button"
            onClick={() => void amu.draftAnnualReport(new Date().getFullYear())}
          >
            Eksporter årsrapport
          </Button>
          {amu.canManage ? (
            <Button variant="primary" type="button" onClick={() => setActiveTab('schedule')}>
              Nytt møte
            </Button>
          ) : null}
        </>
      }
      tabs={
        hubRootTabs ? (
          <div className="flex flex-col gap-2">
            {hubRootTabs}
            <Tabs items={moduleTabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
          </div>
        ) : (
          <Tabs items={moduleTabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
        )
      }
      loading={amu.loading}
    >
      <ComplianceBanner title="Regelverk" className="rounded-md">
        Lovpålagt utvalg for virksomheter med 50 eller flere ansatte. Referanser: AML § 7-1, § 7-2, § 7-3,
        IK-forskriften § 5.
      </ComplianceBanner>

      {amu.error ? <WarningBox>{amu.error}</WarningBox> : null}

      {activeTab === 'overview' ? <OverviewTab amu={amu} onOpenReport={() => setActiveTab('report')} /> : null}
      {activeTab === 'members' ? <MembersTab amu={amu} /> : null}
      {activeTab === 'schedule' ? <ScheduleTab amu={amu} /> : null}
      {activeTab === 'meetingroom' ? <MeetingRoomTab amu={amu} /> : null}
      {activeTab === 'critical' ? <CriticalTab amu={amu} /> : null}
      {activeTab === 'report' ? <AnnualReportTab amu={amu} /> : null}
    </ModulePageShell>
  )
}
