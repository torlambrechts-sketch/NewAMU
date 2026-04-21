import type { SupabaseClient } from '@supabase/supabase-js'

export type OrgModulePayloadKey =
  | 'internal_control'
  | 'hse'
  | 'org_health'
  | 'representatives'
  | 'tasks'
  | 'organisation'
  | 'cost_settings'
  | 'workspace'
  | 'report_builder'
  | 'workplace_reporting'
  | 'workplace_dashboard'
  | 'internkontroll_settings'
  | 'amu_election'
  | 'survey_settings'

export function orgModuleSnapKey(moduleKey: OrgModulePayloadKey, orgId: string, userId: string) {
  return `atics-org-mod:${moduleKey}:${orgId}:${userId}`
}

export function readOrgModuleSnap<T>(moduleKey: OrgModulePayloadKey, orgId: string, userId: string): T | null {
  try {
    const raw = sessionStorage.getItem(orgModuleSnapKey(moduleKey, orgId, userId))
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeOrgModuleSnap<T>(moduleKey: OrgModulePayloadKey, orgId: string, userId: string, data: T) {
  try {
    sessionStorage.setItem(orgModuleSnapKey(moduleKey, orgId, userId), JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function clearOrgModuleSnap(moduleKey: OrgModulePayloadKey, orgId: string, userId: string) {
  try {
    sessionStorage.removeItem(orgModuleSnapKey(moduleKey, orgId, userId))
  } catch {
    /* ignore */
  }
}

export async function fetchOrgModulePayload<T>(
  supabase: SupabaseClient,
  orgId: string,
  moduleKey: OrgModulePayloadKey,
): Promise<T | null> {
  const { data, error } = await supabase
    .from('org_module_payloads')
    .select('payload')
    .eq('organization_id', orgId)
    .eq('module_key', moduleKey)
    .maybeSingle()
  if (error) throw error
  if (!data?.payload) return null
  return data.payload as T
}

export async function upsertOrgModulePayload(
  supabase: SupabaseClient,
  orgId: string,
  moduleKey: OrgModulePayloadKey,
  payload: unknown,
) {
  const { error } = await supabase.from('org_module_payloads').upsert(
    {
      organization_id: orgId,
      module_key: moduleKey,
      payload: payload as Record<string, unknown>,
    },
    { onConflict: 'organization_id,module_key' },
  )
  if (error) throw error
}
