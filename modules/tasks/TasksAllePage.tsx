// "Alle oppgaver" — flat table view (category-architecture §T7).
// Tasks group by source-type (the de-facto Cat 2 for tasks per the
// playbook's capability map); regulation derives from sourceType via
// regulationForSource.

import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ModuleAlleListPage } from '../../src/components/module/ModuleAlleListPage'
import { Badge } from '../../src/components/ui/Badge'
import { useTasks } from '../../src/hooks/useTasks'
import { regulationForSource } from '../../src/lib/regulations/regulationForSource'
import { SOURCE_OPTIONS } from './dashboards/useTasksDatasets'
import type { Task } from '../../src/types/task'

const STATUS_VARIANT: Record<string, 'draft' | 'active' | 'signed' | 'neutral'> = {
  todo: 'draft',
  in_progress: 'active',
  done: 'signed',
}
const STATUS_LABEL: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'Pågående',
  done: 'Fullført',
}

const SOURCE_LABEL = new Map(SOURCE_OPTIONS.map((o) => [o.id, o.label]))

export function TasksAllePage() {
  const tasksApi = useTasks()

  return (
    <ModuleAlleListPage<Task>
      title="Alle oppgaver"
      description="Hver oppgave i organisasjonen — sortert etter kilde, søkbar og filtrerbar på regelverk."
      breadcrumb={[{ label: 'Oppgaver', to: '/tasks/management' }, { label: 'Alle' }]}
      headerActions={
        <Link
          to="/tasks/management"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Link>
      }
      rows={tasksApi.tasks}
      columns={[
        {
          key: 'title',
          label: 'Tittel',
          render: (r) => <span className="font-medium text-[#c2410c]">{r.title}</span>,
        },
        {
          key: 'source',
          label: 'Kilde',
          render: (r) => (
            <span className="text-xs text-neutral-600">
              {SOURCE_LABEL.get(r.sourceType) ?? r.sourceType}
            </span>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => (
            <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'}>
              {STATUS_LABEL[r.status] ?? r.status}
            </Badge>
          ),
        },
        {
          key: 'assignee',
          label: 'Ansvarlig',
          render: (r) => <span className="text-xs text-neutral-600">{r.assignee || '—'}</span>,
        },
        {
          key: 'due',
          label: 'Forfall',
          render: (r) => (
            <span className="text-xs tabular-nums text-neutral-600">
              {r.dueDate ? new Date(r.dueDate).toLocaleDateString('nb-NO') : '—'}
            </span>
          ),
        },
      ]}
      getCategoryId={(r) => r.sourceType}
      categoryNameById={SOURCE_LABEL}
      getRegulationId={(r) => regulationForSource(r.sourceType)}
      searchableText={(r) => [r.title, r.assignee ?? '', r.description ?? ''].join(' ')}
    />
  )
}
