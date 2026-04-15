import { DataTable, ModuleDetailView, ModuleListView } from '../template'
import type { RegisteredModuleComponentProps } from './registry'

export function InspectionModuleView({ config }: RegisteredModuleComponentProps) {
  const parsed = config as {
    summary: Array<{ label: string; value: string; count: number }>
    rounds: Array<{ id: string; location: string; frequency: string; owner: string; status: string }>
  }

  return (
    <ModuleDetailView
      summary={
        <div className="grid gap-2 sm:grid-cols-3">
          {parsed.summary.map((item) => (
            <div key={item.value} className="rounded-lg border border-neutral-200 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{item.count}</p>
            </div>
          ))}
        </div>
      }
      content={
        <ModuleListView
          list={
            <DataTable
              columns={[
                { key: 'id', header: 'Round ID' },
                { key: 'location', header: 'Location' },
                { key: 'frequency', header: 'Frequency' },
                { key: 'owner', header: 'Owner' },
                { key: 'status', header: 'Status' },
              ]}
              rows={parsed.rounds}
              getRowKey={(row) => row.id}
              emptyLabel="No inspection rounds configured."
            />
          }
        />
      }
      sidebar={
        <div className="space-y-2 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">Workflow integration</p>
          <p>Critical findings automatically trigger the Phase 1 workflow engine.</p>
        </div>
      }
    />
  )
}

export function WorkflowModuleView({ config }: RegisteredModuleComponentProps) {
  const parsed = config as {
    rules: Array<{ id: string; trigger: string; action: string; module: string; status: 'active' | 'inactive' }>
  }

  return (
    <ModuleListView
      toolbar={
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-900">Event-driven rules</p>
          <p className="text-xs text-neutral-600">
            Rules are database records and can be turned on/off without redeploying frontend code.
          </p>
        </div>
      }
      list={
        <DataTable
          columns={[
            { key: 'id', header: 'Rule ID' },
            { key: 'trigger', header: 'Trigger event' },
            { key: 'action', header: 'Action' },
            { key: 'module', header: 'Module' },
            { key: 'status', header: 'Status' },
          ]}
          rows={parsed.rules}
          getRowKey={(row) => row.id}
          emptyLabel="No workflow rules configured."
        />
      }
    />
  )
}

export function TasksModuleView({ config }: RegisteredModuleComponentProps) {
  const parsed = config as {
    queueName: string
    tasks: Array<{ id: string; title: string; assignee: string; due_date: string; status: string }>
  }

  return (
    <ModuleListView
      toolbar={<p className="text-sm font-medium text-neutral-900">{parsed.queueName}</p>}
      list={
        <DataTable
          columns={[
            { key: 'id', header: 'Task ID' },
            { key: 'title', header: 'Title' },
            { key: 'assignee', header: 'Assignee' },
            { key: 'due_date', header: 'Due date' },
            { key: 'status', header: 'Status' },
          ]}
          rows={parsed.tasks}
          getRowKey={(row) => row.id}
          emptyLabel="No tasks queued."
        />
      }
    />
  )
}
