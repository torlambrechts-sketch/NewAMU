import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { Task } from '../../src/types/task'
import {
  EMPTY_TASK_MODULE_STORE,
  defaultExtensionFor,
  type TaskCommentEntry,
  type TaskExtension,
  type TaskMilestone,
  type TaskModuleStore,
  type TaskProject,
  type TaskSubtask,
} from './types'

const STORAGE_KEY_PREFIX = 'klarert-task-mgmt-v1'

function storageKey(orgId: string | undefined) {
  return `${STORAGE_KEY_PREFIX}:${orgId ?? 'local'}`
}

function safeParse(raw: string | null): TaskModuleStore {
  if (!raw) return EMPTY_TASK_MODULE_STORE
  try {
    const parsed = JSON.parse(raw) as Partial<TaskModuleStore>
    return {
      extensions: parsed.extensions ?? {},
      projects: parsed.projects ?? [],
      milestones: parsed.milestones ?? [],
    }
  } catch {
    return EMPTY_TASK_MODULE_STORE
  }
}

function loadStore(orgId: string | undefined): TaskModuleStore {
  try {
    return safeParse(localStorage.getItem(storageKey(orgId)))
  } catch {
    return EMPTY_TASK_MODULE_STORE
  }
}

function saveStore(orgId: string | undefined, store: TaskModuleStore) {
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(store))
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

/**
 * Extension store for the comprehensive task management module.
 *
 * Lives alongside (not inside) {@link useTasks}. We never mutate the signed
 * Task envelope from this hook — extensions are scheduling / collaboration
 * metadata only. All write helpers are referentially stable so callers can
 * safely include them in `useEffect` / `useMemo` deps without re-rendering.
 */
export function useTaskExtensions(tasks: Task[]) {
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id

  const [store, setStore] = useState<TaskModuleStore>(() => loadStore(orgId))

  // Re-load when the org changes (multi-tenant safety).
  useEffect(() => {
    setStore(loadStore(orgId))
  }, [orgId])

  // Persist on every change. Cheap (localStorage) — no debounce needed at this size.
  useEffect(() => {
    saveStore(orgId, store)
  }, [orgId, store])

  /**
   * Returns the extension for a given task, creating a default in-memory
   * record on read. Mutation goes through the named helpers below so the
   * stored map stays normalised.
   */
  const getExtension = useCallback(
    (task: Task): TaskExtension => store.extensions[task.id] ?? defaultExtensionFor(task),
    [store.extensions],
  )

  const upsertExtension = useCallback(
    (taskId: string, patch: Partial<Omit<TaskExtension, 'taskId'>>) => {
      setStore((s) => {
        const current = s.extensions[taskId] ?? {
          taskId,
          priority: 'medium' as const,
          labels: [],
          dependsOn: [],
          watchers: [],
          comments: [],
          subtasks: [],
        }
        return {
          ...s,
          extensions: {
            ...s.extensions,
            [taskId]: { ...current, ...patch, taskId },
          },
        }
      })
    },
    [],
  )

  const addComment = useCallback(
    (taskId: string, body: string, authorName: string, authorUserId?: string) => {
      const trimmed = body.trim()
      if (!trimmed) return
      const entry: TaskCommentEntry = {
        id: newId('cmt'),
        body: trimmed,
        authorName,
        authorUserId,
        at: new Date().toISOString(),
      }
      setStore((s) => {
        const current = s.extensions[taskId]
        const ext: TaskExtension = current
          ? { ...current, comments: [...current.comments, entry] }
          : {
              taskId,
              priority: 'medium',
              labels: [],
              dependsOn: [],
              watchers: [],
              subtasks: [],
              comments: [entry],
            }
        return { ...s, extensions: { ...s.extensions, [taskId]: ext } }
      })
    },
    [],
  )

  const addSubtask = useCallback((taskId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const sub: TaskSubtask = { id: newId('sub'), title: trimmed, done: false }
    setStore((s) => {
      const current = s.extensions[taskId]
      const ext: TaskExtension = current
        ? { ...current, subtasks: [...current.subtasks, sub] }
        : {
            taskId,
            priority: 'medium',
            labels: [],
            dependsOn: [],
            watchers: [],
            comments: [],
            subtasks: [sub],
          }
      return { ...s, extensions: { ...s.extensions, [taskId]: ext } }
    })
  }, [])

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setStore((s) => {
      const ext = s.extensions[taskId]
      if (!ext) return s
      return {
        ...s,
        extensions: {
          ...s.extensions,
          [taskId]: {
            ...ext,
            subtasks: ext.subtasks.map((t) => (t.id === subtaskId ? { ...t, done: !t.done } : t)),
          },
        },
      }
    })
  }, [])

  const createProject = useCallback(
    (input: Omit<TaskProject, 'id' | 'createdAt'>) => {
      const project: TaskProject = {
        ...input,
        id: newId('prj'),
        createdAt: new Date().toISOString(),
      }
      setStore((s) => ({ ...s, projects: [project, ...s.projects] }))
      return project
    },
    [],
  )

  const updateProject = useCallback((id: string, patch: Partial<Omit<TaskProject, 'id'>>) => {
    setStore((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setStore((s) => ({
      ...s,
      projects: s.projects.filter((p) => p.id !== id),
      milestones: s.milestones.filter((m) => m.projectId !== id),
      // detach extensions linked to project / milestones being removed
      extensions: Object.fromEntries(
        Object.entries(s.extensions).map(([k, ext]) => [
          k,
          ext.projectId === id ? { ...ext, projectId: undefined, milestoneId: undefined } : ext,
        ]),
      ),
    }))
  }, [])

  const createMilestone = useCallback((input: Omit<TaskMilestone, 'id'>) => {
    const milestone: TaskMilestone = { ...input, id: newId('ms') }
    setStore((s) => ({ ...s, milestones: [...s.milestones, milestone] }))
    return milestone
  }, [])

  const deleteMilestone = useCallback((id: string) => {
    setStore((s) => ({
      ...s,
      milestones: s.milestones.filter((m) => m.id !== id),
      extensions: Object.fromEntries(
        Object.entries(s.extensions).map(([k, ext]) => [
          k,
          ext.milestoneId === id ? { ...ext, milestoneId: undefined } : ext,
        ]),
      ),
    }))
  }, [])

  /**
   * O(N) snapshot used by the views to pair every Task with its extension and
   * guarantee a stable extension object even for previously unmanaged tasks.
   */
  const taskExtensionMap = useMemo(() => {
    const out = new Map<string, TaskExtension>()
    for (const task of tasks) {
      out.set(task.id, store.extensions[task.id] ?? defaultExtensionFor(task))
    }
    return out
  }, [tasks, store.extensions])

  return {
    store,
    projects: store.projects,
    milestones: store.milestones,
    getExtension,
    taskExtensionMap,
    upsertExtension,
    addComment,
    addSubtask,
    toggleSubtask,
    createProject,
    updateProject,
    deleteProject,
    createMilestone,
    deleteMilestone,
  }
}

export type UseTaskExtensions = ReturnType<typeof useTaskExtensions>
