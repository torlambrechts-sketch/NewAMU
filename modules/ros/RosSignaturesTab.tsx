import { useMemo, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import type { RosAnalysisRow, RosHazardRow, RosMeasureRow, RosSignatureRow } from './types'
import { riskScore } from './types'
import type { RosState } from './useRos'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

const BTN_PRIMARY = 'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14312a] transition-colors disabled:opacity-40'

export function RosSignaturesTab({
  analysis, hazards, measures, signatures, ros,
}: {
  analysis: RosAnalysisRow
  hazards: RosHazardRow[]
  measures: RosMeasureRow[]
  signatures: RosSignatureRow[]
  ros: RosState
}) {
  const { profile, user } = useOrgSetupContext()
  const [signing, setSigning] = useState<'responsible' | 'verneombud' | null>(null)

  const isApproved = analysis.status === 'approved' || analysis.status === 'archived'
  const sigByRole = useMemo(() => {
    const m = new Map<string, RosSignatureRow>()
    for (const s of signatures) m.set(s.role, s)
    return m
  }, [signatures])

  // Pre-flight checks
  const hasHazards = hazards.length > 0
  const allHazardsScored = hazards.every((h) =>
    h.initial_probability != null && h.initial_consequence != null,
  )
  const criticalWithMeasures = hazards.every((h) => {
    const s = riskScore(h.residual_probability, h.residual_consequence)
    if (s == null || s < 15) return true
    return measures.some((m) => m.hazard_id === h.id && m.status !== 'cancelled')
  })

  const canSign = hasHazards && allHazardsScored && criticalWithMeasures

  const checks = [
    { ok: hasHazards,         label: 'Minst én farekilde er registrert' },
    { ok: allHazardsScored,   label: 'Alle farekilder har initial risikoscore' },
    { ok: criticalWithMeasures, label: 'Alle farekilder med kritisk risiko har tiltak' },
    { ok: (analysis.scope ?? '').trim().length > 0, label: 'Omfang er beskrevet (anbefalt)' },
  ]

  async function handleSign(role: 'responsible' | 'verneombud') {
    setSigning(role)
    const name = profile?.display_name?.trim() || user?.email?.trim() || 'Bruker'
    await ros.signAnalysis(analysis.id, role, name)
    setSigning(null)
  }

  return (
    <div className="space-y-5 px-5 py-5 md:px-8">
      {/* Legal box */}
      <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] p-4">
        <p className="text-xs font-semibold text-[#1a3d32]">IK-forskriften § 5 — dokumentasjon og medvirkning</p>
        <p className="mt-1 text-xs text-neutral-500">
          ROS-analysen skal signeres av ansvarlig leder (AML § 2-1) og verneombud (AML § 6-2).
          Etter signering låses dokumentet — endringer krever ny versjon.
        </p>
      </div>

      {/* Pre-flight checklist */}
      {!isApproved && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Klar for signering?</p>
          {checks.map(({ ok, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              {ok
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                : <Circle className="h-4 w-4 shrink-0 text-neutral-300" />
              }
              <span className={ok ? 'text-neutral-700' : 'text-neutral-400'}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Signature cards */}
      {(['responsible', 'verneombud'] as const).map((role) => {
        const sig = sigByRole.get(role)
        const roleLabel = role === 'responsible' ? 'Ansvarlig for analysen' : 'Verneombud'
        const lawRef    = role === 'responsible' ? 'AML § 2-1' : 'AML § 6-2'
        return (
          <div key={role} className={`rounded-xl border-2 p-5 transition-all ${
            sig ? 'border-green-300 bg-green-50'
              : canSign ? 'border-[#1a3d32]/40 bg-white shadow-sm'
              : 'border-neutral-200 bg-white'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {sig
                  ? <CheckCircle2 className="h-7 w-7 shrink-0 text-green-500" />
                  : <Circle className="h-7 w-7 shrink-0 text-neutral-300" />
                }
                <div>
                  <p className="text-base font-semibold text-neutral-900">{roleLabel}</p>
                  <p className="text-xs text-neutral-500">{lawRef}</p>
                  {sig ? (
                    <p className="mt-0.5 text-xs font-medium text-green-700">
                      ✓ Signert av {sig.signer_name} — {new Date(sig.signed_at).toLocaleDateString('nb-NO', { dateStyle: 'medium' })}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-neutral-400">Venter på signatur</p>
                  )}
                </div>
              </div>
              {!sig && !isApproved && (
                <button type="button" disabled={!canSign || signing !== null}
                  onClick={() => void handleSign(role)}
                  className={BTN_PRIMARY}>
                  {signing === role ? 'Signerer…' : `Signer som ${roleLabel.toLowerCase()}`}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {isApproved && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
          <p className="text-sm font-semibold text-green-800">Analysen er godkjent og låst</p>
          <p className="mt-1 text-xs text-green-600">
            Arkivert i henhold til IK-forskriften. Minimum 10 års oppbevaringsplikt.
          </p>
        </div>
      )}
    </div>
  )
}
