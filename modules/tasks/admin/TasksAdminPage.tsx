// TasksAdminPage — settings for the Oppgaver module.
// Tabs: Maler (activate/pin), Kategorier (CRUD + reorder), SLA & Innstillinger,
//       Varsler (notification triggers). Roller deferred to Phase 6.

import { useState } from 'react'
import { FolderOpen, CheckSquare, Clock, Bell, Users } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { Tabs } from '../../../src/components/ui/Tabs'
import { Badge } from '../../../src/components/ui/Badge'
import { TasksMalerTab } from './TasksMalerTab'
import { TasksKategorierTab } from './TasksKategorierTab'
import { TasksSLATab } from './TasksSLATab'
import { TasksVarslerTab } from './TasksVarslerTab'

const TABS = [
  { id: 'maler', label: 'Maler', icon: CheckSquare },
  { id: 'kategorier', label: 'Kategorier', icon: FolderOpen },
  { id: 'sla', label: 'SLA & Innstillinger', icon: Clock },
  { id: 'varsler', label: 'Varsler', icon: Bell },
  { id: 'roller', label: 'Roller', icon: Users, disabled: true },
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
          items={TABS.map((t) => ({
            id: t.id,
            label: (
              <span className="flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
                {t.disabled && (
                  <Badge variant="neutral" className="text-[9px]">Fase 6</Badge>
                )}
              </span>
            ),
            disabled: t.disabled,
          }))}
          activeId={activeTab}
          onChange={setActiveTab}
          overflow="scroll"
        />
      }
    >
      {activeTab === 'maler' && <TasksMalerTab />}
      {activeTab === 'kategorier' && <TasksKategorierTab />}
      {activeTab === 'sla' && <TasksSLATab />}
      {activeTab === 'varsler' && <TasksVarslerTab />}
      {activeTab === 'roller' && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-neutral-500">
          <p className="text-sm font-medium text-neutral-700">Roller — implementeres i fase 6</p>
        </div>
      )}
    </ModulePageShell>
  )
}
