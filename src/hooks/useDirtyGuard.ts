import { useEffect } from 'react'

/**
 * Warns when leaving the page with unsaved changes.
 *
 * Note: `useBlocker` from React Router requires a **data router** (`createBrowserRouter`).
 * This app uses `BrowserRouter`, so we only use `beforeunload` for tab close / refresh.
 * In-app navigation is not blocked (would need a data router migration).
 */
export function useDirtyGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}
