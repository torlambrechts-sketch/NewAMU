import { useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { RosAnalysisRow, RosHazardRow, RosMeasureRow, RosSignatureRow } from './types'
import { riskScore } from './types'
import type { RosState } from './useRos'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { Badge } from '../../src/components/ui/Badge'
import { ModulePreflightChecklist } from '../../src/components/module/ModulePreflightChecklist'
import { ModuleSignatureCard } from '../../src/components/module/ModuleSignatureCard'

export function RosSignaturesTab({
  analysis,
  hazards,
  measures,
  signatures,
  ros,
}: {
  analysis: RosAnalysisRow
  hazards: RosHazardRow[]
  measures: RosMeasureRow[]
  signatures: RosSignatureRow[]
  ros: RosState
}) {
  const { profile, user } = useOrgSetupContext()
  const [signing, setSigning] = useState<'responsible' | 'verneombud' | null>(null)

  const blockNewSignatures = analysis.status === 'approved' || analysis.status === 'archived'
  const sigByRole = useMemo(() => {
    const m = new Map<string, RosSignatureRow>()
    for (const s of signatures) m.set(s.role, s)
    return m
  }, [signatures])

  const hasHazards = hazards.length > 0
  const allHazardsScored = hazards.every((h) => h.initial_probability != null && h.initial_consequence != null)
  const criticalWithMeasures = hazards.every((h) => {
    const s = riskScore(h.residual_probability, h.residual_consequence)
    if (s == null || s < 15) return true
    return measures.some((m) => m.hazard_id === h.id && m.status !== 'cancelled')
  })

  const canSign = hasHazards && allHazardsScored && criticalWithMeasures

  const checks = [
    { ok: hasHazards, label: 'Minst én farekilde er registrert' },
    { ok: allHazardsScored, label: 'Alle farekilder har initial risikoscore' },
    { ok: criticalWithMeasures, label: 'Alle farekilder med kritisk risiko har tiltak' },
    { ok: (analysis.scope ?? '').trim().length > 0, label: 'Omfang er beskrevet (anbefalt)' },
  ]

  async function handleSign(role: 'responsible' | 'verneombud') {
    setSigning(role)
    const name = profile?.display_name?.trim() || user?.email?.trim() || 'Bruker'
    await ros.signAnalysis(analysis.id, role, name)
    setSigning(null)
  }

  const roleOrder: { role: 'responsible' | 'verneombud'; title: string; lawReference: string }[] = [
    { role: 'responsible', title: 'Ansvarlig for analysen', lawReference: 'AML § 2-1' },
    { role: 'verneombud', title: 'Verneombud', lawReference: 'AML § 6-2' },
  ]

  return (
    <div className="flex flex-col">
      <ComplianceBanner
        title="IK-forskriften § 5 — dokumentasjon og medvirkning"
        className="border-b border-[#1a3d32]/20"
      >
        <p>
          ROS-analysen skal signeres av ansvarlig leder (AML § 2-1) og verneombud (AML § 6-2). Etter at begge har
          signert, settes status til godkjent og dokumentet låses — videre endringer krever ny revisjon eller kopi.
        </p>
      </ComplianceBanner>

      <div className="space-y-6 p-5 md:p-6">
        {!blockNewSignatures && <ModulePreflightChecklist items={checks} heading="Klar for signering?" />}

        {roleOrder.map(({ role, title, lawReference }) => {
          const sig = sigByRole.get(role) ?? null
          return (
            <ModuleSignatureCard
              key={role}
              title={title}
              lawReference={lawReference}
              signed={sig ? { at: sig.signed_at, byName: sig.signer_name } : null}
              buttonLabel={`Signer som ${title.toLowerCase()}`}
              variant="primary"
              disabled={!canSign || signing !== null}
              busy={signing === role}
              hideButton={blockNewSignatures}
              onSign={() => handleSign(role)}
            />
          )
        })}

        {analysis.status === 'approved' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
            <p className="text-sm font-semibold text-green-800">Analysen er godkjent og låst</p>
            <p className="mt-1 text-xs text-green-600">
              Arkivert i henhold til internkontrollforskriften. Minimum ti års oppbevaringsplikt for HMS-dokumentasjon.
            </p>
          </div>
        )}

        {!blockNewSignatures &&
          analysis.status !== 'approved' &&
          sigByRole.has('responsible') !== sigByRole.has('verneombud') && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
              <Badge variant="signed" className="mb-2">
                Én signatur registrert
              </Badge>
              <p className="text-sm text-blue-900">
                Når både ansvarlig og verneombud har signert, settes analysen automatisk til godkjent (låst) i databasen.
              </p>
            </div>
          )}
      </div>
    </div>
  )
}
