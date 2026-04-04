import { Outlet } from 'react-router-dom'

/**
 * Wrapper for e-learning routes (content only). Primary + section navigation lives in AticsShell.
 */
export function LearningLayout() {
  return (
    <div className="min-h-0 bg-[#FCF8F0]">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <Outlet />
      </div>
    </div>
  )
}

export const PIN_GREEN = '#2D403A'
export const CREAM = '#FCF8F0'
