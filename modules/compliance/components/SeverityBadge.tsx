// SeverityBadge — pack-localised severity pill.
// Reads label from active pack (e.g. "Major NC" in ISO view, "Kritisk avvik"
// in AML view) so the same severity enum reads correctly to either auditor.

import { Badge } from '../../../src/components/ui/Badge'
import { useActivePack } from '../../../src/context/packContextValue'
import type { ComplianceSeverity } from '../types'

const VARIANT: Record<ComplianceSeverity, 'critical' | 'high' | 'medium' | 'neutral'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'neutral',
}

type Props = {
  severity: ComplianceSeverity
}

export function SeverityBadge({ severity }: Props) {
  const pack = useActivePack()
  return <Badge variant={VARIANT[severity]}>{pack.severityLabels[severity]}</Badge>
}
