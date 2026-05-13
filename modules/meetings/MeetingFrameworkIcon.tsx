// Shared framework icon used by the Møter admin tabs (Pakker / Krav /
// Statistikk) and the unified settings hub's Maler scope. Lifted out of
// the now-deleted `MeetingsAdminPage.tsx` so it has no dependency on
// the legacy orchestrator.

import {
  Award,
  Building2,
  ClipboardList,
  Globe,
  Layers,
  Lock,
  Scale,
  Shield,
  Users,
} from 'lucide-react'

const FRAMEWORK_ICON: Record<string, React.ElementType> = {
  INTERNAL: Building2,
  AML: Shield,
  'IK-f': ClipboardList,
  Hovedavtalen: Users,
  Likestillingsloven: Scale,
  ISO_9001: Award,
  ISO_14001: Globe,
  ISO_27001: Lock,
  ISO_45001: Layers,
  GDPR: Lock,
}

export function MeetingFrameworkIcon({
  framework,
  className = 'h-4 w-4',
}: {
  framework: string
  className?: string
}) {
  const Icon = FRAMEWORK_ICON[framework] ?? Shield
  return <Icon className={className} aria-hidden />
}
