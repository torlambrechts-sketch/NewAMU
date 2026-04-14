import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

/**
 * Returnerer Supabase-klient når VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY er satt.
 * Ellers null (appen faller tilbake til localStorage).
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (!url?.trim() || !key?.trim()) {
    client = null
    return null
  }

  client = createClient(url.trim(), key.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return client
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null
}
