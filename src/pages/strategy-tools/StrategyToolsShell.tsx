/* StrategyToolsShell — the per-page wrapper for every Strategy Tools surface.

   Wraps content in the scoped `.stratools` root, injects the icon sprite once,
   builds the design's people/date context (window.SD equivalent) from the org's
   real members, and provides a toast channel. The Frameworks / Whiteboard /
   Assessments views render inside it and read people via useToolsData() and the
   toast via useToolsToast(). */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { IconSprite, ToolsDataProvider, Toast, buildToolsData, initialsOf } from './StrategyToolsKit'
import type { ToolPerson } from '../../types/strategyTools'

const ToastContext = createContext<(message: string) => void>(() => {})
export function useToolsToast() {
  return useContext(ToastContext)
}

export function StrategyToolsShell({ children }: { children: ReactNode }) {
  const ctx = useOrgSetupContext() as unknown as {
    orgProfiles?: Array<{ id: string; display_name?: string | null; email?: string | null }>
    members?: Array<{ id: string; display_name?: string | null; email?: string | null }>
    user?: { id?: string; email?: string | null } | null
    profile?: { display_name?: string | null } | null
    organization?: { name?: string | null } | null
  }
  const { orgProfiles, members, user, profile, organization } = ctx

  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string) => {
    setToast(message)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  const data = useMemo(() => {
    const src = (orgProfiles && orgProfiles.length ? orgProfiles : members) || []
    const people: ToolPerson[] = src.map((p) => {
      const name = p.display_name || p.email || 'Bruker'
      return { id: p.id, name, initials: initialsOf(name) }
    })
    const currentUserId = user?.id || ''
    const currentUserName = profile?.display_name || user?.email || 'You'
    return buildToolsData(people, currentUserId, currentUserName, organization?.name || '')
  }, [orgProfiles, members, user, profile, organization])

  return (
    <div className="stratools">
      <IconSprite />
      <ToolsDataProvider value={data}>
        <ToastContext.Provider value={showToast}>
          <div style={{ padding: '24px 30px 48px', maxWidth: 1340, margin: '0 auto', width: '100%' }}>
            {children}
          </div>
          <Toast message={toast} />
        </ToastContext.Provider>
      </ToolsDataProvider>
    </div>
  )
}
