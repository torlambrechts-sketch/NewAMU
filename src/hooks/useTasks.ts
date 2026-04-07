import { useCallback, useEffect, useRef, useState } from 'react'
import type { DigitalSignature, Task, TaskModule, TaskSourceType, TaskStatus } from '../types/task'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  clearOrgModuleSnap,
  fetchOrgModulePayload,
  readOrgModuleSnap,
  upsertOrgModulePayload,
  writeOrgModuleSnap,
  type OrgModulePayloadKey,
} from '../lib/orgModulePayload'
import { useOrgSetupContext } from './useOrgSetupContext'
import { fetchClientIpBestEffort, hashDocumentPayload } from '../lib/level1Signature'
import { insertSystemSignatureEvent } from '../lib/recordSystemSignature'

const MODULE_KEY: OrgModulePayloadKey = 'tasks'
const STORAGE_KEY_V2 = 'atics-tasks-v2'
const LEGACY_KEY = 'atics-tasks-v1'
const PERSIST_DEBOUNCE_MS = 450

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
  'hse_safety_round',
  'hse_inspection',
  'hse_inspection_finding',
  'hse_incident',
  'nav_report',
  'labor_metric',
  'learning_course',
  'ros_measure',
  'annual_review_action',
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
    assigneeEmployeeId: raw.assigneeEmployeeId ? String(raw.assigneeEmployeeId) : undefined,
    ownerRole: String(raw.ownerRole ?? 'Ansvarlig'),
    leaderEmployeeId: raw.leaderEmployeeId ? String(raw.leaderEmployeeId) : undefined,
    leaderName: raw.leaderName ? String(raw.leaderName) : undefined,
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

function normalizeStore(p: TaskStore): TaskStore {
  return {
    tasks: Array.isArray(p.tasks) ? p.tasks.map((t) => migrateLegacyTask(t as unknown as Record<string, unknown>)) : [],
    auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
  }
}

function emptyRemote(): TaskStore {
  return { tasks: [], auditLog: [] }
}

function loadLocal(): TaskStore {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2)
    if (rawV2) {
      const p = JSON.parse(rawV2) as TaskStore
      if (p && Array.isArray(p.tasks)) {
        return normalizeStore(p)
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
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store))
        return store
      }
    }
    return { tasks: seedTasks, auditLog: [] }
  } catch {
    return { tasks: seedTasks, auditLog: [] }
  }
}

function saveLocal(store: TaskStore) {
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store))
}

export type AddTaskInput = Omit<Task, 'id' | 'createdAt'> & Partial<Pick<Task, 'id' | 'createdAt'>>

export function useTasks() {
  const { supabase, organization, user } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const useRemote = !!(supabase && orgId && userId)

  const initialRemote =
    useRemote && orgId && userId ? readOrgModuleSnap<TaskStore>(MODULE_KEY, orgId, userId) : null
  const [localStore, setLocalStore] = useState<TaskStore>(() => loadLocal())
  const [remoteStore, setRemoteStore] = useState<TaskStore>(() => initialRemote ?? emptyRemote())
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const store = useRemote ? remoteStore : localStore
  const setStore = useRemote ? setRemoteStore : setLocalStore

  const refreshTasks = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchOrgModulePayload<TaskStore>(supabase, orgId, MODULE_KEY)
      const next = payload ? normalizeStore(payload) : emptyRemote()
      setRemoteStore(next)
      writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearOrgModuleSnap(MODULE_KEY, orgId, userId)
      setRemoteStore(emptyRemote())
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      return
    }
    void refreshTasks()
  }, [useRemote, refreshTasks])

  useEffect(() => {
    if (!useRemote) {
      saveLocal(localStore)
    }
  }, [useRemote, localStore])

  useEffect(() => {
    if (!useRemote || !supabase || !orgId) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, remoteStore)
          if (userId) writeOrgModuleSnap(MODULE_KEY, orgId, userId, remoteStore)
        } catch (e) {
          setError(getSupabaseErrorMessage(e))
        }
      })()
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [useRemote, supabase, orgId, userId, remoteStore])

  const tasks = store.tasks
  const auditLog = store.auditLog

  const appendAudit = useCallback(
    (taskId: string, action: string, message: string) => {
      setStore((s) => ({
        ...s,
        auditLog: [...s.auditLog, auditEntry(taskId, action, message)],
      }))
    },
    [setStore],
  )

  const addTask = useCallback(
    (partial: AddTaskInput) => {
      const t: Task = {
        title: partial.title.trim(),
        description: partial.description?.trim() ?? '',
        status: partial.status ?? 'todo',
        assignee: partial.assignee?.trim() || 'Unassigned',
        assigneeEmployeeId: partial.assigneeEmployeeId,
        ownerRole: partial.ownerRole?.trim() || 'Ansvarlig',
        leaderEmployeeId: partial.leaderEmployeeId,
        leaderName: partial.leaderName?.trim(),
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
    [setStore],
  )

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      setStore((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }))
      appendAudit(id, 'task_updated', 'Oppgave oppdatert')
    },
    [appendAudit, setStore],
  )

  const deleteTask = useCallback(
    (id: string) => {
      setStore((s) => ({
        ...s,
        tasks: s.tasks.filter((t) => t.id !== id),
        auditLog: [...s.auditLog, auditEntry(id, 'task_deleted', 'Oppgave slettet')],
      }))
    },
    [setStore],
  )

  const setStatus = useCallback(
    (id: string, status: TaskStatus) => {
      updateTask(id, { status })
    },
    [updateTask],
  )

  function taskPayloadForLevel1(task: Task, kind: 'assignee' | 'management', signerName: string, signedAt: string) {
    const { assigneeSignature, managementSignature, ...rest } = task
    const assigneeSignatureNext =
      kind === 'assignee' ? { signerName, signedAt } : assigneeSignature ?? null
    const managementSignatureNext =
      kind === 'management' ? { signerName, signedAt } : managementSignature ?? null
    return { ...rest, assigneeSignature: assigneeSignatureNext, managementSignature: managementSignatureNext }
  }

  const signAsAssignee = useCallback(
    async (id: string, signerName: string) => {
      const name = signerName.trim()
      if (!name) return false
      setError(null)
      const task = store.tasks.find((t) => t.id === id)
      if (!task) return false
      const signedAt = new Date().toISOString()
      const payload = taskPayloadForLevel1(task, 'assignee', name, signedAt)
      const documentHashSha256 = await hashDocumentPayload(payload)
      let level1: DigitalSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const [clientIp] = await Promise.all([fetchClientIpBestEffort()])
        const ins = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'task',
          resourceId: id,
          action: 'task_sign_assignee',
          documentHashSha256,
          signerDisplayName: name,
          role: 'assignee',
          clientIp,
        })
        if ('error' in ins) {
          setError(ins.error)
          return false
        }
        level1 = ins.evidence
      }
      const sig: DigitalSignature = { signerName: name, signedAt, level1 }
      setStore((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, assigneeSignature: sig } : t)),
        auditLog: [...s.auditLog, auditEntry(id, 'sign_assignee', `Signert av ansvarlig: ${name}`)],
      }))
      return true
    },
    [setStore, setError, store.tasks, supabase, orgId, userId, useRemote],
  )

  const signManagement = useCallback(
    async (id: string, signerName: string) => {
      const name = signerName.trim()
      if (!name) return false
      setError(null)
      const task = store.tasks.find((t) => t.id === id)
      if (!task) return false
      const signedAt = new Date().toISOString()
      const payload = taskPayloadForLevel1(task, 'management', name, signedAt)
      const documentHashSha256 = await hashDocumentPayload(payload)
      let level1: DigitalSignature['level1'] | undefined
      if (useRemote && supabase && orgId && userId) {
        const clientIp = await fetchClientIpBestEffort()
        const ins = await insertSystemSignatureEvent(supabase, orgId, userId, {
          resourceType: 'task',
          resourceId: id,
          action: 'task_sign_management',
          documentHashSha256,
          signerDisplayName: name,
          role: 'management',
          clientIp,
        })
        if ('error' in ins) {
          setError(ins.error)
          return false
        }
        level1 = ins.evidence
      }
      const sig: DigitalSignature = { signerName: name, signedAt, level1 }
      setStore((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, managementSignature: sig } : t)),
        auditLog: [...s.auditLog, auditEntry(id, 'sign_management', `Ledelsessignatur: ${name}`)],
      }))
      return true
    },
    [setStore, setError, store.tasks, supabase, orgId, userId, useRemote],
  )

  const resetDemo = useCallback(async () => {
    const next: TaskStore = { tasks: seedTasks, auditLog: [] }
    if (useRemote && supabase && orgId) {
      try {
        setError(null)
        await upsertOrgModulePayload(supabase, orgId, MODULE_KEY, next)
        setRemoteStore(next)
        if (userId) writeOrgModuleSnap(MODULE_KEY, orgId, userId, next)
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
      }
      return
    }
    localStorage.removeItem(STORAGE_KEY_V2)
    localStorage.removeItem(LEGACY_KEY)
    setLocalStore(loadLocal())
  }, [useRemote, supabase, orgId, userId])

  return {
    tasks,
    auditLog,
    loading: useRemote ? loading : false,
    error: useRemote ? error : null,
    backend: useRemote ? ('supabase' as const) : ('local' as const),
    addTask,
    updateTask,
    deleteTask,
    setStatus,
    signAsAssignee,
    signManagement,
    resetDemo,
  }
}
