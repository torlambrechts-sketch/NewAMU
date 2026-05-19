import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Warns when leaving the page with unsaved changes.
 *
 * Covers two navigation paths:
 *  - In-app SPA navigation via React Router's useBlocker (requires createBrowserRouter).
 *  - Browser tab close / refresh via beforeunload.
 *
 * `isDirty` should be true when there are pending unsaved changes (e.g.
 * saveStatus === 'idle' after a user edit). The guard only activates after
 * `isDirty` has transitioned from false → true at least once, preventing a
 * false prompt on initial load when saveStatus naturally starts as 'idle'.
 */
export function useDirtyGuard(isDirty: boolean) {
  // Only arm the guard after a clean→dirty transition. On page load, hooks
  // start with saveStatus='idle' (isDirty=true) before any user interaction.
  // We ignore that initial state and wait for a false→true flip instead.
  const prevDirty = useRef<boolean | null>(null)
  const armed = useRef(false)

  if (prevDirty.current === false && isDirty) {
    armed.current = true
  }
  prevDirty.current = isDirty

  const active = isDirty && armed.current

  // In-app navigation guard (back button, link clicks, programmatic navigate).
  useBlocker(
    ({ currentLocation, nextLocation }) =>
      active && currentLocation.pathname !== nextLocation.pathname
        ? !window.confirm('Du har ulagrede endringer. Forlat siden?')
        : false,
  )

  // Browser tab close / page refresh.
  useEffect(() => {
    if (!active) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [active])
}
