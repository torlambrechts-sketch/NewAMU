import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaPage } from '../../modules/sja/SjaPage'

/**
 * Thin route wrapper for `/sja/:sjaId`.
 *
 * `SjaPage` owns its own `ModulePageShell` chrome — this wrapper only
 * injects the Supabase client from the org-context.
 */
export function SjaDetailPage() {
  const { supabase } = useOrgSetupContext()
  return <SjaPage supabase={supabase} />
}
