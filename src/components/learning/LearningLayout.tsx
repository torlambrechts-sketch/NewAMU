import { Outlet } from 'react-router-dom'
import { WORKPLACE_CREAM } from '../layout/WorkplaceChrome'

/** Workplace content canvas (aligned with Action Board). */
export const SHELL_PAGE_BG = WORKPLACE_CREAM
/** Primary brand green from shell header */
export const SHELL_PRIMARY = '#1a3d32'
/** Gold accent from shell logo */
export const SHELL_ACCENT = '#c9a227'

/** @deprecated Use SHELL_PRIMARY for new code — kept for minimal churn in imports */
export const PIN_GREEN = SHELL_PRIMARY
export const CREAM = SHELL_PAGE_BG

/**
 * Wrapper for e-learning routes (content only). Primary + section navigation lives in AticsShell.
 */
export function LearningLayout() {
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: SHELL_PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <Outlet />
      </div>
    </div>
  )
}
