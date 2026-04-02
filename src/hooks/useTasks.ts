import { useCallback, useEffect, useState } from 'react'
import type { DigitalSignature, Task, TaskModule, TaskSourceType, TaskStatus } from '../types/task'

const STORAGE_KEY_V2 = 'atics-tasks-v2'
const LEGACY_KEY = 'atics-tasks-v1'

export type TaskAuditEntry = {
  id: string
  at: string
  action: string
  taskId: string
  message: string
}

type TaskStore = {
  tasks: Task[]
  auditLog: TaskAuditEntry[]
}

function auditEntry(taskId: string, action: string, message: string): TaskAuditEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    taskId,
    message,
  }
}

const defaultModule: TaskModule = 'general'
const defaultSource: TaskSourceType = 'manual'

const ALL_MODULES: TaskModule[] = [
  'general',
  'council',
  'members',
  'org_health',
  'hse',
  'hrm',
  'learning',
]
const ALL_SOURCES: TaskSourceType[] = [
  'manual',
  'council_meeting',
  'council_compliance',
  'representatives',
  'survey',
  'workflow_step',
  'hse_safety_round',
  'hse_inspection',
  'hse_incident',
  'nav_report',
  'labor_metric',
  'learning_course',
]

function migrateLegacyTask(raw: Record<string, unknown>): Task {
  const mod = raw.module as TaskModule
  const src = raw.sourceType as TaskSourceType
  return {
    id: String(raw.id),
    title: String(raw.title ?? 'Task'),
    description: String(raw.description ?? ''),
    status: (raw.status as TaskStatus) ?? 'todo',
    assignee: String(raw.assignee ?? 'Unassigned'),
    ownerRole: String(raw.ownerRole ?? 'Ansvarlig'),
    dueDate: String(raw.dueDate ?? '—'),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    module: ALL_MODULES.includes(mod) ? mod : defaultModule,
    sourceType: ALL_SOURCES.includes(src) ? src : defaultSource,
    sourceId: raw.sourceId ? String(raw.sourceId) : undefined,
    sourceLabel: raw.sourceLabel ? String(raw.sourceLabel) : undefined,
    requiresManagementSignOff: Boolean(raw.requiresManagementSignOff),
    assigneeSignature: raw.assigneeSignature as DigitalSignature | undefined,
    managementSignature: raw.managementSignature as DigitalSignature | undefined,
  }
}

const seedTasks: Task[] = [
  {
    id: '1',
    title: 'Review Q1 hiring pipeline',
    description: 'Consolidate feedback from department leads.',
    status: 'in_progress',
    assignee: 'Jane Cooper',
    ownerRole: 'Prosjektleder',
    dueDate: '2026-04-15',
    createdAt: new Date().toISOString(),
    module: 'general',
    sourceType: 'manual',
    requiresManagementSignOff: false,
  },
  {
    id: '2',
    title: 'Update onboarding checklist',
    description: 'Sync with HR policy changes.',
    status: 'todo',
    assignee: 'Jenny Wilson',
    ownerRole: 'HR',
    dueDate: '2026-04-20',
    createdAt: new Date().toISOString(),
    module: 'general',
    sourceType: 'manual',
    requiresManagementSignOff: true,
  },
  {
    id: '3',
    title: 'Publish department metrics',
    description: 'Export and share weekly stats.',
    status: 'done',
    assignee: 'Ronald Richards',
    ownerRole: 'Analytiker',
    dueDate: '2026-03-28',
    createdAt: new Date().toISOString(),
    module: 'general',
    sourceType: 'manual',
    requiresManagementSignOff: false,
  },
]

function load(): TaskStore {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2)
    if (rawV2) {
      const p = JSON.parse(rawV2) as TaskStore
      if (p && Array.isArray(p.tasks)) {
        return {
          tasks: p.tasks.map((t) => migrateLegacyTask(t as unknown as Record<string, unknown>)),
          auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
        }
      }
    }
    const rawLegacy = localStorage.getItem(LEGACY_KEY)
    if (rawLegacy) {
      const arr = JSON.parse(rawLegacy) as unknown[]
      if (Array.isArray(arr) && arr.length) {
        const tasks = arr.map((t) => migrateLegacyTask(t as Record<string, unknown>))
        const store: TaskStore = {
          tasks,
          auditLog: [auditEntry('system', 'migrate', 'Oppgave migrert fra v1 til v2 med modul og signaturfelt.')],
        }
        save(store)
        return store
      }
    }
    return { tasks: seedTasks, auditLog: [] }
  } catch {
    return { tasks: seedTasks, auditLog: [] }
  }
}

function save(store: TaskStore) {
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store))
}

export type AddTaskInput = Omit<Task, 'id' | 'createdAt'> & Partial<Pick<Task, 'id' | 'createdAt'>>

export function useTasks() {
  const [store, setStore] = useState<TaskStore>(() => load())

  useEffect(() => {
    save(store)
  }, [store])

  const tasks = store.tasks
  const auditLog = store.auditLog

  const appendAudit = useCallback((taskId: string, action: string, message: string) => {
    setStore((s) => ({
      ...s,
      auditLog: [...s.auditLog, auditEntry(taskId, action, message)],
    }))
  }, [])

  const addTask = useCallback(
    (partial: AddTaskInput) => {
      const t: Task = {
        title: partial.title.trim(),
        description: partial.description?.trim() ?? '',
        status: partial.status ?? 'todo',
        assignee: partial.assignee?.trim() || 'Unassigned',
        ownerRole: partial.ownerRole?.trim() || 'Ansvarlig',
        dueDate: partial.dueDate?.trim() || '—',
        module: partial.module ?? defaultModule,
        sourceType: partial.sourceType ?? defaultSource,
        sourceId: partial.sourceId,
        sourceLabel: partial.sourceLabel,
        requiresManagementSignOff: partial.requiresManagementSignOff ?? false,
        assigneeSignature: partial.assigneeSignature,
        managementSignature: partial.managementSignature,
        id: partial.id ?? crypto.randomUUID(),
        createdAt: partial.createdAt ?? new Date().toISOString(),
      }
      setStore((s) => ({
        ...s,
        tasks: [t, ...s.tasks],
        auditLog: [...s.auditLog, auditEntry(t.id, 'task_created', `Oppgave opprettet: «${t.title}»`)],
      }))
      return t
    },
    [],
  )

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      setStore((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }))
      appendAudit(id, 'task_updated', 'Oppgave oppdatert')
    },
    [appendAudit],
  )

  const deleteTask = useCallback((id: string) => {
    setStore((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id),
      auditLog: [...s.auditLog, auditEntry(id, 'task_deleted', 'Oppgave slettet')],
    }))
  }, [])

  const setStatus = useCallback(
    (id: string, status: TaskStatus) => {
      updateTask(id, { status })
    },
    [updateTask],
  )

  const signAsAssignee = useCallback(
    (id: string, signerName: string) => {
      const name = signerName.trim()
      if (!name) return false
      const sig: DigitalSignature = { signerName: name, signedAt: new Date().toISOString() }
      setStore((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, assigneeSignature: sig } : t)),
        auditLog: [...s.auditLog, auditEntry(id, 'sign_assignee', `Signert av ansvarlig: ${name}`)],
      }))
      return true
    },
    [],
  )

  const signManagement = useCallback(
    (id: string, signerName: string) => {
      const name = signerName.trim()
      if (!name) return false
      const sig: DigitalSignature = { signerName: name, signedAt: new Date().toISOString() }
      setStore((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, managementSignature: sig } : t)),
        auditLog: [...s.auditLog, auditEntry(id, 'sign_management', `Ledelsessignatur: ${name}`)],
      }))
      return true
    },
    [],
  )

  return {
    tasks,
    auditLog,
    addTask,
    updateTask,
    deleteTask,
    setStatus,
    signAsAssignee,
    signManagement,
  }
}
