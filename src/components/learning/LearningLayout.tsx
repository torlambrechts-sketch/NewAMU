import { Outlet } from 'react-router-dom'

/** Matches `AticsShell` main background — do not use a different cream here (avoids visible banding). */
export const SHELL_PAGE_BG = '#f5f0e8'
/** Primary brand green from shell header */
export const SHELL_PRIMARY = '#1a3d32'
/** Gold accent from shell logo */
export const SHELL_ACCENT = '#c9a227'

/** @deprecated Use SHELL_PRIMARY for new code — kept for minimal churn in imports */
export const PIN_GREEN = SHELL_PRIMARY
export const CREAM = SHELL_PAGE_BG

/**
 * Wrapper for e-learning routes (content only). Primary + section navigation lives in AticsShell.
 * Background is transparent so the shell’s `#f5f0e8` fills the viewport without a color seam.
 */
export function LearningLayout() {
  return (
    <div className="min-h-0">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <Outlet />
      </div>
    </div>
  )
}
