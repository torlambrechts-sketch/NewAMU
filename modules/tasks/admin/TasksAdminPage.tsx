// TasksAdminPage — settings for the Oppgaver module.
// Tabs: Maler, Kategorier, Pakker, Krav, SLA & Innstillinger,
//       Varsler, Statistikk. Roller deferred to Phase 6.

import { useState } from 'react'
import { BarChart2, Bell, CheckSquare, Clock, FolderOpen, Layers, ShieldCheck, Users } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { Tabs, type TabItem } from '../../../src/components/ui/Tabs'
import { TasksMalerTab } from './TasksMalerTab'
import { TasksKategorierTab } from './TasksKategorierTab'
import { TasksPakkerTab } from './TasksPakkerTab'
import { TasksKravTab } from './TasksKravTab'
import { TasksSLATab } from './TasksSLATab'
import { TasksVarslerTab } from './TasksVarslerTab'
import { TasksStatistikkTab } from './TasksStatistikkTab'

const TABS: TabItem[] = [
  { id: 'maler',      label: 'Maler',              icon: CheckSquare },
  { id: 'kategorier', label: 'Kategorier',          icon: FolderOpen  },
  { id: 'pakker',     label: 'Pakker',              icon: Layers      },
  { id: 'krav',       label: 'Krav',                icon: ShieldCheck },
  { id: 'sla',        label: 'SLA & Innstillinger', icon: Clock       },
  { id: 'varsler',    label: 'Varsler',             icon: Bell        },
  { id: 'statistikk', label: 'Statistikk',          icon: BarChart2   },
  { id: 'roller',     label: 'Roller',              icon: Users, disabled: true },
]

export function TasksAdminPage() {
  const [activeTab, setActiveTab] = useState('maler')

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Oppgaver', to: '/tasks/management' },
        { label: 'Innstillinger' },
      ]}
      title="Innstillinger — Oppgaver"
      description="Administrer maler, kategorier, SLA-frister og compliance-regler for oppgavemodulen."
      tabs={
        <Tabs
          items={TABS}
          activeId={activeTab}
          onChange={setActiveTab}
          overflow="scroll"
        />
      }
    >
      {activeTab === 'maler' && <TasksMalerTab />}
      {activeTab === 'kategorier' && <TasksKategorierTab />}
      {activeTab === 'pakker' && <TasksPakkerTab />}
      {activeTab === 'krav' && <TasksKravTab />}
      {activeTab === 'sla' && <TasksSLATab />}
      {activeTab === 'varsler' && <TasksVarslerTab />}
      {activeTab === 'statistikk' && <TasksStatistikkTab />}
      {activeTab === 'roller' && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-neutral-500">
          <p className="text-sm font-medium text-neutral-700">Roller — implementeres i fase 6</p>
        </div>
      )}
    </ModulePageShell>
  )
}
