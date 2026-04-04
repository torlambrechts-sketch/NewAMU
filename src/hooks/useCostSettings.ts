import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'atics-cost-settings-v1'

export type CostSettings = {
  /** Average hourly cost per employee (salary + social costs), NOK */
  hourlyRateNok: number
  /** Hours per working day */
  hoursPerDay: number
  /** Whether cost calculation is enabled and shown on dashboard */
  enabled: boolean
}

const DEFAULTS: CostSettings = {
  hourlyRateNok: 650,
  hoursPerDay: 7.5,
  enabled: true,
}

function load(): CostSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<CostSettings>) }
  } catch {
    return DEFAULTS
  }
}

export function useCostSettings() {
  const [settings, setSettings] = useState<CostSettings>(load)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const update = useCallback((patch: Partial<CostSettings>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  /** Cost of N sick-leave days at the configured rate */
  function sickLeaveCost(days: number): number {
    return Math.round(days * settings.hoursPerDay * settings.hourlyRateNok)
  }

  /** Cost of an incident assuming N hours of lost production / investigation */
  function incidentCost(hours: number): number {
    return Math.round(hours * settings.hourlyRateNok)
  }

  return { settings, update, sickLeaveCost, incidentCost }
}
