# Step 5 — Page Shell

**Replace** `modules/amu/AmuPage.tsx` entirely.

After saving, **delete** these files (they are replaced by the new tab components in Steps 6–11):
- `modules/amu/AmuDetailView.tsx`
- `modules/amu/AmuAgendaPlanningTable.tsx`
- `modules/amu/AmuParticipantsTable.tsx`
- `modules/amu/AmuMeetingRoomTab.tsx`
- `modules/amu/schema.ts`

Depends on: Step 4 (useAmu must exist).

---

## `modules/amu/AmuPage.tsx`

Copy the shell from `Claude/NewAUM/04_UI_VIEWS.md` top section verbatim, then fill in the tab routing.

```tsx
import { useState } from 'react'
import { ModulePageShell, ModuleSectionCard } from '../../src/components/module'
import { Tabs, ComplianceBanner, WarningBox, Button } from '../../src/components/ui'
import { useAmu } from './useAmu'
import { OverviewTab }      from './tabs/OverviewTab'
import { MembersTab }       from './tabs/MembersTab'
import { ScheduleTab }      from './tabs/ScheduleTab'
import { MeetingRoomTab }   from './tabs/MeetingRoomTab'
import { CriticalTab }      from './tabs/CriticalTab'
import { AnnualReportTab }  from './tabs/AnnualReportTab'

const TABS = [
  { id: 'overview',    label: 'Oversikt' },
  { id: 'members',     label: 'Medlemmer' },
  { id: 'schedule',    label: 'Møteplan' },
  { id: 'meetingroom', label: 'Møterom' },
  { id: 'critical',    label: 'Kritiske saker' },
  { id: 'report',      label: 'Årsrapport' },
] as const

type TabId = typeof TABS[number]['id']

export function AmuPage() {
  const amu = useAmu()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Badge counts derived from live data
  const tabs = TABS.map(t => ({
    ...t,
    badgeCount:
      t.id === 'members'     ? amu.members.length                     :
      t.id === 'schedule'    ? amu.meetings.filter(m =>
        m.status === 'scheduled' || m.status === 'draft').length       :
      t.id === 'critical'    ? amu.criticalQueue.length                :
      undefined,
  }))

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Medvirkning' }, { label: 'Arbeidsmiljøutvalg' }]}
      title="Arbeidsmiljøutvalg"
      description="Partssammensatt utvalg som behandler virksomhetens HMS-arbeid"
      headerActions={<>
        <Button variant="secondary" onClick={() => amu.draftAnnualReport(new Date().getFullYear())}>
          Eksporter årsrapport
        </Button>
        {amu.canManage && (
          <Button variant="primary" onClick={() => setActiveTab('schedule')}>
            Nytt møte
          </Button>
        )}
      </>}
      tabs={<Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} />}
      loading={amu.loading}
    >
      <ComplianceBanner refs={['AML § 7-1', '§ 7-2', '§ 7-3', 'IK-forskriften § 5']}>
        Lovpålagt utvalg for virksomheter med 50 eller flere ansatte.
      </ComplianceBanner>

      {amu.error && <WarningBox>{amu.error}</WarningBox>}

      {activeTab === 'overview'    && <OverviewTab amu={amu} />}
      {activeTab === 'members'     && <MembersTab amu={amu} />}
      {activeTab === 'schedule'    && <ScheduleTab amu={amu} />}
      {activeTab === 'meetingroom' && <MeetingRoomTab amu={amu} />}
      {activeTab === 'critical'    && <CriticalTab amu={amu} />}
      {activeTab === 'report'      && <AnnualReportTab amu={amu} />}
    </ModulePageShell>
  )
}
```

### Props type shared across all tabs

Create `modules/amu/tabs/types.ts`:

```ts
import type { useAmu } from '../useAmu'
export type AmuHook = ReturnType<typeof useAmu>
```

All tab components receive `{ amu: AmuHook }` as their single prop.

---

## Commit

```
feat(amu): page shell with 6-tab routing
```
