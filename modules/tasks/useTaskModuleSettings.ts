import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import {
  DEFAULT_TASK_MODULE_SETTINGS,
  mergeSettings,
  type TaskModuleSettings,
} from './taskModuleSettings'

const STORAGE_KEY_PREFIX = 'klarert-task-mgmt-settings-v1'

function storageKey(orgId: string | undefined) {
  return `${STORAGE_KEY_PREFIX}:${orgId ?? 'local'}`
}

function loadSettings(orgId: string | undefined): TaskModuleSettings {
  try {
    const raw = localStorage.getItem(storageKey(orgId))
    if (!raw) return DEFAULT_TASK_MODULE_SETTINGS
    const parsed = JSON.parse(raw) as Partial<TaskModuleSettings>
    return mergeSettings(DEFAULT_TASK_MODULE_SETTINGS, parsed)
  } catch {
    return DEFAULT_TASK_MODULE_SETTINGS
  }
}

function saveSettings(orgId: string | undefined, settings: TaskModuleSettings) {
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(settings))
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

/**
 * Hook returning the current task module settings + helpers.
 *
 * `update(patch)` performs a deep-shallow merge — i.e. the top-level group
 * (`notifications`, `avvik`, …) is shallow-merged so a single field can be
 * changed without spreading the rest. `reset(group?)` restores defaults
 * either for a single group or for the entire store.
 */
export function useTaskModuleSettings() {
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id

  const [settings, setSettings] = useState<TaskModuleSettings>(() => loadSettings(orgId))

  useEffect(() => {
    setSettings(loadSettings(orgId))
  }, [orgId])

  useEffect(() => {
    saveSettings(orgId, settings)
  }, [orgId, settings])

  const update = useCallback(<K extends keyof TaskModuleSettings>(group: K, patch: Partial<TaskModuleSettings[K]>) => {
    setSettings((current) => ({
      ...current,
      [group]: { ...current[group], ...patch },
    }))
  }, [])

  const reset = useCallback((group?: keyof TaskModuleSettings) => {
    if (!group) {
      setSettings(DEFAULT_TASK_MODULE_SETTINGS)
      return
    }
    setSettings((current) => ({ ...current, [group]: DEFAULT_TASK_MODULE_SETTINGS[group] }))
  }, [])

  return { settings, setSettings, update, reset }
}

export type UseTaskModuleSettings = ReturnType<typeof useTaskModuleSettings>
