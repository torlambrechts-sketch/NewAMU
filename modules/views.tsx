import { DataTable, ModuleListView } from '../template'
import type { RegisteredModuleComponentProps } from './registry'

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
