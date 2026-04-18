import type { SupabaseClient } from '@supabase/supabase-js'

export type AssignableUser = { id: string; displayName: string }

/**
 * Loads org profiles for user pickers (inspection, SJA, avvik, etc.).
 */
export async function fetchAssignableUsers(supabase: SupabaseClient): Promise<AssignableUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .order('display_name', { ascending: true })
  if (error) {
    console.warn('fetchAssignableUsers', error.message)
    return []
  }
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
