import type { SupabaseClient } from '@supabase/supabase-js'

/** Ensure a profile row exists without 409 on duplicate (RLS-safe after profiles_select_self migration). */
export async function ensureProfileRowExists(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    { id: userId, display_name: 'Bruker' },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error && error.code !== '23505') {
    throw error
  }
}
