// ComplianceLayerAnalysePage — 9th consumer of ModuleAnalyticsDashboard.
//
// Renders the `compliance_layer` scope (registered via the side-effect
// import below) with datasets computed by useComplianceLayerDatasets.
// Mirrors the minimal-page pattern (no pack switching, no per-page
// dimensions) — keeps the surface focused on cross-control metrics.

import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { getDashboardScope } from '../../src/lib/dashboards/dashboardRegistry'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { COMPLIANCE_LAYER_SCOPE_ID } from './dashboards/complianceLayerScope'
// Side-effect import: registers the scope on module load.
import './dashboards/complianceLayerScope'
import { useComplianceLayerDatasets } from './dashboards/useComplianceLayerDatasets'

export function ComplianceLayerAnalysePage() {
  const { supabase } = useOrgSetupContext()
  const scope = getDashboardScope(COMPLIANCE_LAYER_SCOPE_ID)
  const dashboard = useDashboardLayout({
    supabase,
    scopeId: COMPLIANCE_LAYER_SCOPE_ID,
  })
  const { datasets, loading, error } = useComplianceLayerDatasets()

  return (
    <ModuleAnalyticsDashboard
      title="Kontroller — analyse"
      description="Tverrgående statistikk om internkontrollene. Hver kontroll er koblet til ett eller flere lovkrav og til bevisartefakter på tvers av sjekklist, undersøkelse, dokument, læring, oppgave, møte og register."
      layout={dashboard.layout}
      datasets={datasets as Record<string, unknown>}
      loading={loading}
      error={error ?? null}
      accent={scope?.accent}
    />
  )
}
