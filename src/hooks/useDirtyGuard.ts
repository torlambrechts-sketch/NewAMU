import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Warns when leaving the page with unsaved changes.
 *
 * Covers two navigation paths:
 *  - In-app SPA navigation via React Router's useBlocker (requires createBrowserRouter).
 *  - Browser tab close / refresh via beforeunload.
 *
 * Pass `isDirty=true` while there are unsaved changes. The blocker shows a
 * native browser confirm dialog; the user can stay or leave. After a
 * successful save, pass `isDirty=false` to release the guard automatically.
 */
export function useDirtyGuard(isDirty: boolean) {
  // In-app navigation guard (back button, link clicks, programmatic navigate).
  useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
        ? !window.confirm('Du har ulagrede endringer. Forlat siden?')
        : false,
  )

  // Browser tab close / page refresh.
  useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}
