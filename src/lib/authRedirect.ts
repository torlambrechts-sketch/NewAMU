/** After login, avoid redirecting back to auth routes; prevent loops. */
export function postLoginRedirectPath(raw: string | null | undefined): string {
  const base = (raw?.trim() || '/app').split('#')[0] ?? '/app'
  const path = base.startsWith('/') ? base : `/${base}`
  if (path === '/login' || path === '/signup') return '/app'
  /** `/` is the public landing; after login send users to the workplace home. */
  if (path === '/' || path === '') return '/app'
  return path
}
