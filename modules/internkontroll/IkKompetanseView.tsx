import type { CertStatus, IkCompetenceRecordWithStatus, IkCompetenceRequirementRow } from './types'

const CERT_STATUS_COLOR: Record<CertStatus, { bg: string; text: string; label: string }> = {
  valid:         { bg: 'bg-green-50',   text: 'text-green-700',  label: 'Gyldig' },
  expiring_soon: { bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'Utløper snart' },
  expired:       { bg: 'bg-red-50',     text: 'text-red-700',    label: 'Utløpt' },
  missing:       { bg: 'bg-neutral-100',text: 'text-neutral-500',label: 'Mangler' },
}

type Props = {
  requirements: IkCompetenceRequirementRow[]
  records: IkCompetenceRecordWithStatus[]
  canManage: boolean
  onAddRecord: (reqId: string) => void
  onAddRequirement: () => void
}

export function IkKompetanseView({ requirements, records, canManage, onAddRecord, onAddRequirement }: Props) {
  const hasExpiredHardGate = records.some((r) => {
    const req = requirements.find((q) => q.id === r.requirement_id)
    return req?.is_hard_gate && r.cert_status === 'expired'
  })

  const recordsByReq = new Map<string, IkCompetenceRecordWithStatus[]>()
  for (const rec of records) {
    if (!recordsByReq.has(rec.requirement_id)) recordsByReq.set(rec.requirement_id, [])
    recordsByReq.get(rec.requirement_id)!.push(rec)
  }

  return (
    <div className="space-y-4">
      {/* Hard-gate alert */}
      {hasExpiredHardGate && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="mt-0.5 text-red-600">⛔</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Kritisk: Obligatoriske sertifikater er utløpt</p>
            <p className="text-xs text-red-700 mt-0.5">
              SJA-signering er blokkert til sertifikatene fornyes. Se AML § 3-2 og Forskrift om utførelse av arbeid.
            </p>
          </div>
        </div>
      )}

      {/* Header + add button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          {records.filter((r) => r.cert_status === 'expired').length} utløpte ·{' '}
          {records.filter((r) => r.cert_status === 'expiring_soon').length} utløper snart ·{' '}
          {records.filter((r) => r.cert_status === 'valid').length} gyldige
        </p>
        {canManage && (
          <button
            type="button"
            onClick={onAddRequirement}
            className="rounded-lg border border-[#1a3d32] bg-[#1a3d32] px-3 py-1 text-xs font-semibold text-white hover:bg-[#14312a]"
          >
            + Krav
          </button>
        )}
      </div>

      {/* Requirements → Records list */}
      <div className="space-y-3">
        {requirements.map((req) => {
          const recs = recordsByReq.get(req.id) ?? []
          return (
            <div key={req.id} className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                <div>
                  <span className="text-sm font-semibold text-neutral-900">{req.cert_name}</span>
                  <span className="ml-2 text-xs text-neutral-500">{req.display_name}</span>
                  {req.is_hard_gate && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                      BLOKKERING
                    </span>
                  )}
                  {req.law_basis && (
                    <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                      {req.law_basis}
                    </span>
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onAddRecord(req.id)}
                    className="text-xs text-[#1a3d32] hover:underline"
                  >
                    + Registrer
                  </button>
                )}
              </div>
              {recs.length === 0 ? (
                <p className="px-4 py-3 text-xs text-neutral-400 italic">Ingen registrerte sertifikater.</p>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {recs.map((rec) => {
                    const sc = CERT_STATUS_COLOR[rec.cert_status]
                    return (
                      <div key={rec.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900">{rec.user_name}</p>
                          <p className="text-xs text-neutral-500">
                            Utstedt {new Date(rec.issued_at).toLocaleDateString('nb-NO')}
                            {rec.expires_at && ` · Utløper ${new Date(rec.expires_at).toLocaleDateString('nb-NO')}`}
                            {rec.issuer && ` · ${rec.issuer}`}
                          </p>
                        </div>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                        {rec.is_verified && (
                          <span className="text-green-600 text-xs">✓ Verifisert</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {requirements.length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-400">Ingen kompetansekrav registrert.</p>
        )}
      </div>
    </div>
  )
}
