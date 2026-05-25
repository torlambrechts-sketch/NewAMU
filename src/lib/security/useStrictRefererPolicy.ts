// useStrictRefererPolicy — install a strict-origin referrer policy
// for the lifetime of the calling component.
//
// Public auditor surfaces (`/auditor/...`) carry a bearer token in
// the URL path. Without an explicit policy, the browser default
// (`strict-origin-when-cross-origin`) leaks the *full path* in the
// Referer header on same-origin navigations (e.g. an auditor clicking
// a lovdata.no anchor). `strict-origin` strips path + query for both
// cross- and same-origin navigations.
//
// The meta tag is the only mechanism that works once the SPA has
// already shipped (header-based policy needs server config). We inject
// it on mount and remove it on unmount so the policy doesn't leak
// onto authenticated pages an admin might navigate back to in the
// same tab.

import { useEffect } from 'react'

export function useStrictRefererPolicy(): void {
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="referrer"]')
    const previousContent = existing?.getAttribute('content') ?? null
    if (existing) {
      existing.setAttribute('content', 'strict-origin')
    } else {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'referrer')
      meta.setAttribute('content', 'strict-origin')
      document.head.appendChild(meta)
    }
    return () => {
      const node = document.querySelector<HTMLMetaElement>('meta[name="referrer"]')
      if (!node) return
      if (previousContent !== null) {
        node.setAttribute('content', previousContent)
      } else {
        node.remove()
      }
    }
  }, [])
}
