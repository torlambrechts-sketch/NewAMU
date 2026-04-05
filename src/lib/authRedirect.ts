/** After login, avoid redirecting back to auth routes; prevent loops. */
export function postLoginRedirectPath(raw: string | null | undefined): string {
  const base = (raw?.trim() || '/').split('#')[0] ?? '/'
  const path = base.startsWith('/') ? base : `/${base}`
  if (path === '/login' || path === '/signup') return '/'
  return path
}
