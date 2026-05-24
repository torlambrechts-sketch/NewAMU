// Small framework pill rendered next to register type names. Reads
// from the canonical REGISTER_FRAMEWORKS list so colors stay in sync
// with the framework rail on the hub.
//
// When the type declares no framework (rare — only when a custom org
// type omits regulation_ids entirely) the pill renders nothing.

import { dynamic, lucideByName } from './lucideByName'
import type { LucideIcon } from './lucideByName'
import { primaryFramework, type RegisterFrameworkDef, frameworkFor } from '../../lib/registers/registerFrameworks'

type Props =
  | { frameworkId: string; regulationIds?: undefined }
  | { regulationIds: string[]; frameworkId?: undefined }

export function RegisterFrameworkPill(props: Props) {
  const fw: RegisterFrameworkDef | null =
    'frameworkId' in props && props.frameworkId
      ? frameworkFor(props.frameworkId)
      : primaryFramework(props.regulationIds ?? [])
  if (!fw) return null
  const Icon = dynamic(fw.icon)
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        borderColor: `${fw.color}40`,
        background: `${fw.color}12`,
        color: fw.color,
      }}
    >
      <Icon className="h-2.5 w-2.5" />
      {fw.short}
    </span>
  )
}

// Reuse the helper for callers that want to drop the icon themselves.
export { lucideByName, dynamic as dynamicLucide }
export type { LucideIcon }
