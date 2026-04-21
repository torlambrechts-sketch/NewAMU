import { InspectionRoundPage } from '../../modules/inspection/InspectionRoundPage'

/**
 * Thin route wrapper for `/inspection-module/:roundId`.
 *
 * The module view owns the full page chrome via `ModulePageShell`; this
 * wrapper exists only so routing can import a `src/pages/` file. Do **not**
 * add wrapper `<div>`s here — they produce double-padding since
 * `InspectionRoundPage` already wraps itself in `ModulePageShell`.
 */
export function InspectionRoundDetailPage() {
  return <InspectionRoundPage />
}
