import type { ReportModule } from '../../types/reportBuilder'
import { ReportModulesGrid } from './ReportModuleWidget'

export function CustomReportPreview({
  modules,
  datasets,
  accent,
}: {
  modules: ReportModule[]
  datasets: Record<string, unknown>
  accent: string
}) {
  return <ReportModulesGrid modules={modules} datasets={datasets} accent={accent} layoutMode="grid2" />
}
