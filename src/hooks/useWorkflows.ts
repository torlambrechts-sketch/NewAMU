import { useCallback, useEffect, useMemo, useState } from 'react'
import { WORKFLOW_PRESETS } from '../data/workflowPresets'
import type { WorkflowCategory, WorkflowDefinition, WorkflowStep, WorkflowStepLinkType } from '../types/workflow'

const STORAGE_KEY = 'atics-workflows-v1'

function newId() {
  return crypto.randomUUID()
}

function normalizeSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i }))
}

function normalizeDefinition(raw: WorkflowDefinition): WorkflowDefinition {
  return {
    ...raw,
    steps: normalizeSteps(raw.steps),
  }
}

function load(): WorkflowDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as WorkflowDefinition[]
    if (!Array.isArray(arr)) return []
    return arr.map((w) => normalizeDefinition(w))
  } catch {
    return []
  }
}

function save(workflows: WorkflowDefinition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))
}

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(() => load())

  useEffect(() => {
    save(workflows)
  }, [workflows])

  const presets = useMemo(() => WORKFLOW_PRESETS, [])

  const createFromPreset = useCallback((presetId: string) => {
    const preset = WORKFLOW_PRESETS.find((p) => p.id === presetId)
    if (!preset) return null
    const now = new Date().toISOString()
    const steps: WorkflowStep[] = preset.steps.map((s, i) => ({
      ...s,
      id: newId(),
      order: i,
    }))
    const w: WorkflowDefinition = {
      id: newId(),
      title: preset.title,
      description: preset.description,
      category: preset.category,
      presetId: preset.id,
      steps,
      createdAt: now,
      updatedAt: now,
    }
    setWorkflows((prev) => [w, ...prev])
    return w
  }, [])

  const createBlank = useCallback((title: string, category: WorkflowCategory, description?: string) => {
    const now = new Date().toISOString()
    const w: WorkflowDefinition = {
      id: newId(),
      title: title.trim(),
      description: description?.trim() ?? '',
      category,
      steps: [],
      createdAt: now,
      updatedAt: now,
    }
    setWorkflows((prev) => [w, ...prev])
    return w
  }, [])

  const updateWorkflow = useCallback(
    (id: string, patch: Partial<Pick<WorkflowDefinition, 'title' | 'description' | 'category'>>) => {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, ...patch, updatedAt: new Date().toISOString() }
            : w,
        ),
      )
    },
    [],
  )

  const deleteWorkflow = useCallback((id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const addStep = useCallback(
    (
      workflowId: string,
      partial: {
        title: string
        description?: string
        roleHint?: string
        suggestedDueDays?: number
        linkType: WorkflowStepLinkType
        linkPath?: string
      },
    ) => {
      const step: WorkflowStep = {
        id: newId(),
        order: 999,
        title: partial.title.trim(),
        description: partial.description?.trim() ?? '',
        roleHint: partial.roleHint?.trim(),
        suggestedDueDays: partial.suggestedDueDays,
        linkType: partial.linkType,
        linkPath: partial.linkPath?.trim() || undefined,
      }
      setWorkflows((prev) =>
        prev.map((w) => {
          if (w.id !== workflowId) return w
          const steps = normalizeSteps([...w.steps, step])
          return { ...w, steps, updatedAt: new Date().toISOString() }
        }),
      )
    },
    [],
  )

  const updateStep = useCallback(
    (workflowId: string, stepId: string, patch: Partial<Omit<WorkflowStep, 'id' | 'order'>>) => {
      setWorkflows((prev) =>
        prev.map((w) => {
          if (w.id !== workflowId) return w
          const steps = w.steps.map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  ...patch,
                  title: patch.title != null ? patch.title.trim() : s.title,
                  description: patch.description != null ? patch.description.trim() : s.description,
                }
              : s,
          )
          return { ...w, steps, updatedAt: new Date().toISOString() }
        }),
      )
    },
    [],
  )

  const removeStep = useCallback((workflowId: string, stepId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== workflowId) return w
        const steps = normalizeSteps(w.steps.filter((s) => s.id !== stepId))
        return { ...w, steps, updatedAt: new Date().toISOString() }
      }),
    )
  }, [])

  const moveStep = useCallback((workflowId: string, stepId: string, dir: 'up' | 'down') => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== workflowId) return w
        const idx = w.steps.findIndex((s) => s.id === stepId)
        if (idx < 0) return w
        const j = dir === 'up' ? idx - 1 : idx + 1
        if (j < 0 || j >= w.steps.length) return w
        const steps = [...w.steps]
        ;[steps[idx], steps[j]] = [steps[j], steps[idx]]
        return {
          ...w,
          steps: normalizeSteps(steps),
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [])

  return {
    workflows,
    presets,
    createFromPreset,
    createBlank,
    updateWorkflow,
    deleteWorkflow,
    addStep,
    updateStep,
    removeStep,
    moveStep,
  }
}
