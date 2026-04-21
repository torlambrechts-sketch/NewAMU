import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaModuleView } from '../../modules/sja/SjaModuleView'

/**
 * Thin route wrapper. The module view owns the full page chrome via
 * `ModulePageShell`; this wrapper just injects the supabase client from the
 * organisation context.
 */
export function SjaModulePage() {
  const { supabase } = useOrgSetupContext()
  return <SjaModuleView supabase={supabase} />
}
