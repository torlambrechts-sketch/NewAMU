import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { InspectionModuleView } from '../../modules/inspection/InspectionModuleView'

/**
 * Thin page wrapper for the Phase 3 Inspection Module.
 *
 * Pulls `supabase` from the org context and passes it to the data-fetching
 * component. Registered in `src/modules/registry.ts` (slug: inspection-module)
 * and routed at `/inspection-module` in App.tsx.
 */
export function InspectionModulePage() {
  const { supabase } = useOrgSetupContext()
  return <InspectionModuleView supabase={supabase} />
}
