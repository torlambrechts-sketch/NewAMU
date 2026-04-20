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
  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <InspectionModuleView supabase={supabase} />
      </div>
    </div>
  )
}
