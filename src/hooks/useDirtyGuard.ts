import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

const CONFIRM_MSG = 'Du har ulagrede endringer. Vil du forlate siden uten å lagre?'

/**
 * Warns the user before navigating away or closing the tab when there are
 * unsaved changes. Handles both in-app navigation (useBlocker) and
 * browser tab close / hard refresh (beforeunload).
 */
export function useDirtyGuard(isDirty: boolean) {
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const confirmed = window.confirm(CONFIRM_MSG)
    if (confirmed) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])

  useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}
