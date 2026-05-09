// TasksAdminPage — settings for the Oppgaver module.
// Tabs: Maler (activate/pin), Kategorier (CRUD + reorder), SLA & Innstillinger.
// Varsler and Roller come in Phase 3.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, CheckSquare, Clock, Bell, Users } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { Tabs } from '../../../src/components/ui/Tabs'
import { Badge } from '../../../src/components/ui/Badge'
import { TasksMalerTab } from './TasksMalerTab'
import { TasksKategorierTab } from './TasksKategorierTab'
import { TasksSLATab } from './TasksSLATab'

const TABS = [
  { id: 'maler', label: 'Maler', icon: CheckSquare },
  { id: 'kategorier', label: 'Kategorier', icon: FolderOpen },
  { id: 'sla', label: 'SLA & Innstillinger', icon: Clock },
  { id: 'varsler', label: 'Varsler', icon: Bell, disabled: true },
  { id: 'roller', label: 'Roller', icon: Users, disabled: true },
]

export function TasksAdminPage() {
  const navigate = useNavigate()
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
                  <Badge variant="neutral" className="text-[9px]">Fase 3</Badge>
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
      {(activeTab === 'varsler' || activeTab === 'roller') && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-neutral-500">
          <p className="text-sm font-medium text-neutral-700">
            {activeTab === 'varsler' ? 'Varsler' : 'Roller'} — implementeres i fase 3
          </p>
        </div>
      )}
    </ModulePageShell>
  )
}
