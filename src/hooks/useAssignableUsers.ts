import type { SupabaseClient } from '@supabase/supabase-js'

export type AssignableUser = { id: string; displayName: string }

function mapProfileRows(data: { id: unknown; display_name: unknown }[] | null): AssignableUser[] {
  return (data ?? [])
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id) return null
      const displayName =
        typeof row.display_name === 'string' && row.display_name.trim().length > 0
          ? row.display_name.trim()
          : id
      return { id, displayName }
    })
    .filter((row): row is AssignableUser => row !== null)
}

/**
 * Loads org profiles for user pickers (inspection, SJA, avvik, etc.).
 * When `organizationId` is set, results are restricted to that tenant.
 * På feil: logg + tom liste (bakoverkompatibelt for moduler som allerede håndterer tom liste).
 */
export async function fetchAssignableUsers(
  supabase: SupabaseClient,
  organizationId?: string | null,
): Promise<AssignableUser[]> {
  let q = supabase.from('profiles').select('id, display_name')
  if (organizationId) {
    q = q.eq('organization_id', organizationId)
  }
  const { data, error } = await q.order('display_name', { ascending: true })
  if (error) {
    console.warn('fetchAssignableUsers', error.message)
    return []
  }
  return mapProfileRows(data as { id: unknown; display_name: unknown }[] | null)
}

/** Samme spørring som `fetchAssignableUsers`, men kaster feil (for kallere som bruker getSupabaseErrorMessage). */
export async function fetchAssignableUsersStrict(
  supabase: SupabaseClient,
  organizationId?: string | null,
): Promise<AssignableUser[]> {
  let q = supabase.from('profiles').select('id, display_name')
  if (organizationId) {
    q = q.eq('organization_id', organizationId)
  }
  const { data, error } = await q.order('display_name', { ascending: true })
  if (error) throw error
  return mapProfileRows(data as { id: unknown; display_name: unknown }[] | null)
}
