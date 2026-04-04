import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Reads public Supabase settings from Vite env.
 * On Vercel, use either VITE_* or duplicate NEXT_PUBLIC_* (see vite.config envPrefix).
 * Never put service role or DB passwords in the frontend.
 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = (
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim()
  const anonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.SUPABASE_ANON_KEY ||
    ''
  ).trim()
  if (!url || !anonKey) return null
  return { url: url.replace(/\/$/, ''), anonKey }
}

let browserClient: SupabaseClient | null | undefined

/** Singleton browser client for auth and PostgREST (RLS applies). */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient
  const c = getSupabasePublicConfig()
  if (!c) {
    browserClient = null
    return null
  }
  browserClient = createClient(c.url, c.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return browserClient
}

/** Clears singleton (e.g. after tests). */
export function resetSupabaseBrowserClientForTests() {
  browserClient = undefined
}
