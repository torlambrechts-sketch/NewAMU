// Dynamic Lucide icon by name — bridges the gap between the
// display_metadata.icon string stored on register_types and the
// per-icon component exports lucide-react ships. Looking up the
// component by name keeps the registers admin schema-builder UI
// simple (pick from a list of icon names) without forcing every
// page to switch-case a 50-line dispatch.
//
// If the requested icon doesn't exist on the lucide-react export
// surface we fall back to `Database` (the generic register icon) so
// the layout doesn't collapse.

import { Database, type LucideIcon } from 'lucide-react'
import * as Lucide from 'lucide-react'

const LucideAny = Lucide as unknown as Record<string, LucideIcon | undefined>

/** Look up a Lucide icon component by name. */
export function lucideByName(name: string | null | undefined): LucideIcon {
  if (!name) return Database
  return LucideAny[name] ?? Database
}

/** Alias kept for callsite readability ("const Icon = dynamic(name)"). */
export const dynamic = lucideByName

export type { LucideIcon }
