import { useEffect } from 'react'

/**
 * Warns when leaving the page with unsaved changes.
 *
 * Note: `useBlocker` from React Router requires a **data router** (`createBrowserRouter`).
 * The app root uses `RouterProvider` + `createBrowserRouter`; pages that need in-app
 * navigation blocking should use `useBlocker` directly. This hook only covers tab close.
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
