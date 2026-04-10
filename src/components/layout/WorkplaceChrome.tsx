import { Outlet } from 'react-router-dom'

/** Matches Action Board / layout-reference cream work surface */
export const WORKPLACE_CREAM = '#F9F7F2'
/** Primary green — same as Action Board active tabs */
export const WORKPLACE_FOREST = '#1a3d32'

/**
 * Wraps authenticated workplace routes: full-height cream canvas so every page aligns
 * with Action Board without duplicating background on each screen.
 */
export function WorkplaceChrome() {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: WORKPLACE_CREAM,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <Outlet />
    </div>
  )
}
