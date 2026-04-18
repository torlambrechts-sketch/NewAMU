import type { IkOrgRoleRow } from './types'

const MANDATORY_ROLES = [
  { key: 'verneombud',   label: 'Verneombud',               law: 'AML § 6-1',   note: 'Pliktig ved ≥10 ansatte, kan avtales bort ved ≤10' },
  { key: 'avp',          label: 'Arbeidsmiljøutvalg (AMU)',  law: 'AML § 7-1',   note: 'Pliktig ved ≥50 ansatte' },
  { key: 'bht',          label: 'Bedriftshelsetjeneste',     law: 'AML § 3-3',   note: 'Bransjeavhengig plikt, se BHT-forskriften' },
  { key: 'leder',        label: 'HMS-ansvarlig leder',       law: 'AML § 2-1',   note: 'Arbeidsgiver har øverste ansvar' },
  { key: 'hms_ansvarlig',label: 'HMS-koordinator',           law: 'IK-forskriften § 5', note: 'Daglig ansvar for IK-systemet' },
]

type Props = {
  roles: IkOrgRoleRow[]
  canManage: boolean
  onUpsertRole: (role: Partial<IkOrgRoleRow> & { role_key: string }) => void
}

export function IkMedvirkningView({ roles, canManage, onUpsertRole }: Props) {
  const today = new Date()
  const roleByKey = new Map(roles.map((r) => [r.role_key, r]))

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        AML § 6-1 krever verneombud ved ≥10 ansatte. AMU er pliktig ved ≥50. Bekreft at rollene er besatt og gyldig.
      </p>

      <div className="overflow-hidden rounded-xl border border-neutral-200/90 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Rolle</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Hjemmel</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Tildelt</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Gyldig til</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Status</th>
              {canManage && <th className="w-20" />}
            </tr>
          </thead>
          <tbody>
            {MANDATORY_ROLES.map((def) => {
              const row = roleByKey.get(def.key)
              const isExpired = row?.valid_until ? new Date(row.valid_until) < today : false
              const isAssigned = !!row?.assigned_name || !!row?.assigned_to

              let statusLabel = 'Ikke tildelt'
              let statusClass = 'bg-red-50 text-red-700'
              if (isAssigned && isExpired) { statusLabel = 'Utløpt'; statusClass = 'bg-amber-50 text-amber-700' }
              else if (isAssigned) { statusLabel = 'Besatt'; statusClass = 'bg-green-50 text-green-700' }

              return (
                <tr key={def.key} className="border-b border-neutral-100 hover:bg-neutral-50 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{def.label}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">{def.note}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{def.law}</td>
                  <td className="px-4 py-3 text-xs text-neutral-700">
                    {row?.assigned_name ?? <span className="italic text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {row?.valid_until ? new Date(row.valid_until).toLocaleDateString('nb-NO') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onUpsertRole({ ...(row ?? {}), role_key: def.key, display_name: def.label, law_basis: def.law })}
                        className="text-xs text-[#1a3d32] hover:underline"
                      >
                        {row ? 'Rediger' : 'Tildel'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
