// Self-fetching wrapper around useRegistersDatasets for the cross-scope
// reporting host. Uses the same useAllRegisterRecords fetcher as the
// Analyse page (now extracted to its own file) so records and types stay
// consistent across both surfaces.

import { useRegisters } from '../../../hooks/useRegisters'
import type { DatasetsHookDeps } from '../../../lib/dashboards/dashboardRegistry'
import { useAllRegisterRecords } from './useAllRegisterRecords'
import { useRegistersDatasets } from './useRegistersDatasets'

export function useRegistersDatasetsForReports(deps: DatasetsHookDeps): Record<string, unknown> {
  const registers = useRegisters({ supabase: deps.supabase })
  const allRecords = useAllRegisterRecords(deps.supabase, deps.organizationId)
  return useRegistersDatasets({
    records: allRecords.records,
    types: registers.types,
    categories: registers.categories,
    filters: deps.filters,
  })
}
