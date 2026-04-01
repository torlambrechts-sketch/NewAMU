import { useCallback, useEffect, useState } from 'react'
import type { Task, TaskStatus } from '../types/task'

const STORAGE_KEY = 'atics-tasks-v1'

const seedTasks: Task[] = [
  {
    id: '1',
    title: 'Review Q1 hiring pipeline',
    description: 'Consolidate feedback from department leads.',
    status: 'in_progress',
    assignee: 'Jane Cooper',
    dueDate: '2026-04-15',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Update onboarding checklist',
    description: 'Sync with HR policy changes.',
    status: 'todo',
    assignee: 'Jenny Wilson',
    dueDate: '2026-04-20',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Publish department metrics',
    description: 'Export and share weekly stats.',
    status: 'done',
    assignee: 'Ronald Richards',
    dueDate: '2026-03-28',
    createdAt: new Date().toISOString(),
  },
]

function load(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedTasks
    const parsed = JSON.parse(raw) as Task[]
    return Array.isArray(parsed) && parsed.length ? parsed : seedTasks
  } catch {
    return seedTasks
  }
}

function save(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => load())

  useEffect(() => {
    save(tasks)
  }, [tasks])

  const addTask = useCallback((partial: Omit<Task, 'id' | 'createdAt'>) => {
    const t: Task = {
      ...partial,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    setTasks((prev) => [t, ...prev])
    return t
  }, [])

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    )
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const setStatus = useCallback((id: string, status: TaskStatus) => {
    updateTask(id, { status })
  }, [updateTask])

  return { tasks, addTask, updateTask, deleteTask, setStatus }
}
