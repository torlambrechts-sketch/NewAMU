// useTasks — compatibility stub.
//
// The legacy jsonb-based task store has been retired. This stub preserves
// the hook's public interface so cross-module consumers (HseModule,
// CouncilModule, InternalControlModule, etc.) continue to compile while
// each is migrated to write directly to task_items in later phases.
//
// All mutations are no-ops that return a stub Task value. No data is
// read from or written to org_module_payloads. auditLog is always [].

import { useCallback } from 'react'
import type { Task, TaskStatus } from '../types/task'

export type AddTaskInput = Omit<Task, 'id' | 'createdAt'> & Partial<Pick<Task, 'id' | 'createdAt'>>

export function useTasks() {
  const tasks: Task[] = []
  const auditLog: never[] = []

  const addTask = useCallback((partial: AddTaskInput): Task => {
    return {
      id: crypto.randomUUID(),
      title: partial.title ?? '',
      description: partial.description ?? '',
      status: partial.status ?? 'todo',
      assignee: partial.assignee ?? '',
      ownerRole: partial.ownerRole ?? 'Ansvarlig',
      dueDate: partial.dueDate ?? '',
      createdAt: new Date().toISOString(),
      module: partial.module ?? 'general',
      sourceType: partial.sourceType ?? 'manual',
      requiresManagementSignOff: partial.requiresManagementSignOff ?? false,
      ...partial,
    } as Task
  }, [])

  const updateTask = useCallback((_id: string, _patch: Partial<Task>) => {
    // no-op — migrate caller to useTaskItems
  }, [])

  const deleteTask = useCallback((_id: string) => {
    // no-op
  }, [])

  const setStatus = useCallback((_id: string, _status: TaskStatus) => {
    // no-op
  }, [])

  const signAsAssignee = useCallback(async (_id: string): Promise<boolean> => {
    return false
  }, [])

  const signManagement = useCallback(async (_id: string): Promise<boolean> => {
    return false
  }, [])

  const resetDemo = useCallback(async () => {
    // no-op
  }, [])

  return {
    tasks,
    auditLog,
    loading: false,
    error: null,
    backend: 'supabase' as const,
    addTask,
    updateTask,
    deleteTask,
    setStatus,
    signAsAssignee,
    signManagement,
    resetDemo,
  }
}
