import { normalizeInspectionConfig, normalizeRun } from './hseInspectionNormalize'
import { getSupabaseClient } from './supabaseClient'
import type { HseInspectionConfig, InspectionRun } from '../types/inspectionModule'
import type { HseAuditEntry, Incident, Inspection, SafetyRound } from '../types/hse'

export const HSE_STATE_ROW_ID = 'default'

export type HsePersistedState = {
  safetyRounds: SafetyRound[]
  inspections: Inspection[]
  incidents: Incident[]
  auditTrail: HseAuditEntry[]
  inspectionModuleConfig: HseInspectionConfig
  inspectionRuns: InspectionRun[]
}

export function parseHseStateFromPayload(raw: unknown): HsePersistedState | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const base: HsePersistedState = {
    safetyRounds: Array.isArray(p.safetyRounds) ? (p.safetyRounds as SafetyRound[]) : [],
    inspections: Array.isArray(p.inspections) ? (p.inspections as Inspection[]) : [],
    incidents: Array.isArray(p.incidents) ? (p.incidents as Incident[]) : [],
    auditTrail: Array.isArray(p.auditTrail) ? (p.auditTrail as HseAuditEntry[]) : [],
    inspectionModuleConfig: normalizeInspectionConfig(p.inspectionModuleConfig),
    inspectionRuns: Array.isArray(p.inspectionRuns)
      ? (p.inspectionRuns as InspectionRun[]).map((r) => normalizeRun(r))
      : [],
  }
  return base
}

export async function fetchHseStateFromSupabase(): Promise<HsePersistedState | null> {
  const sb = getSupabaseClient()
  if (!sb) return null

  const { data, error } = await sb
    .from('app_hse_state')
    .select('payload')
    .eq('id', HSE_STATE_ROW_ID)
    .maybeSingle()

  if (error) {
    console.warn('[Supabase] app_hse_state read failed:', error.message)
    return null
  }
  if (!data?.payload) return null
  return parseHseStateFromPayload(data.payload)
}

export async function upsertHseStateToSupabase(state: HsePersistedState): Promise<boolean> {
  const sb = getSupabaseClient()
  if (!sb) return false

  const { error } = await sb.from('app_hse_state').upsert(
    {
      id: HSE_STATE_ROW_ID,
      payload: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) {
    console.warn('[Supabase] app_hse_state upsert failed:', error.message)
    return false
  }
  return true
}
