/** Fixed demo tenant — must match supabase/migrations seed (public read for anon). */
export const DEMO_ORGANIZATION_ID = '00000000-0000-4000-a000-000000000001'

export const DEMO_SESSION_STORAGE_KEY = 'atics-demo-org-session'
export const DEMO_QUERY_PARAM = 'demo'

export function isDemoRouteSearch(search: string): boolean {
  try {
    return new URLSearchParams(search).get(DEMO_QUERY_PARAM) === '1'
  } catch {
    return false
  }
}

export function readDemoSessionFlag(): boolean {
  try {
    return sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function persistDemoSessionFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(DEMO_SESSION_STORAGE_KEY, '1')
    else sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
