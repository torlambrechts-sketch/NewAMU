import type { SupabaseClient } from '@supabase/supabase-js'
import { AvvikView } from '../../avvik/AvvikView'

type Props = {
  supabase: SupabaseClient | null
}

/**
 * Embed the existing AvvikView so the deviations module is reachable from
 * the unified task hub without forking the (battle-tested) detail panel,
 * RLS-aware Supabase queries or audit/history flow.
 */
export function TasksAvvikTab({ supabase }: Props) {
  return <AvvikView supabase={supabase} />
}
