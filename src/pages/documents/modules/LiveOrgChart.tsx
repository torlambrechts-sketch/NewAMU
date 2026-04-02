import { useRepresentatives } from '../../../hooks/useRepresentatives'
import { useCouncil } from '../../../hooks/useCouncil'
import { avatarUrlFromSeed } from '../../../lib/avatarUrl'

type Props = {
  showAMU?: boolean
  showVerneombud?: boolean
}

const roleLabels: Record<string, string> = {
  employee_chair: 'Leder (AT)',
  employee_deputy: 'Nestleder (AT)',
  employee_member: 'Medlem (AT)',
  leadership_chair: 'Leder (AG)',
  leadership_deputy: 'Nestleder (AG)',
  leadership_member: 'Medlem (AG)',
}

export function LiveOrgChart({ showAMU = true, showVerneombud = true }: Props) {
  const rep = useRepresentatives()
  const council = useCouncil()

  const verneombud = rep.members.filter(
    (m) => m.officeRole === 'employee_chair' || m.officeRole === 'employee_deputy',
  )
  const amuMembers = rep.members

  return (
    <div className="not-prose my-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-800">⚡</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Live — oppdateres automatisk</span>
      </div>

      {showVerneombud && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-neutral-700">Verneombud</h4>
          {verneombud.length === 0 ? (
            <p className="text-sm text-neutral-500">Ingen verneombud registrert ennå.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {verneombud.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                  <img src={avatarUrlFromSeed(m.id + m.name, 40)} alt="" className="size-8 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-medium text-neutral-900">{m.name}</div>
                    <div className="text-xs text-neutral-500">{roleLabels[m.officeRole] ?? m.officeRole}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAMU && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-neutral-700">AMU — Arbeidsmiljøutvalg</h4>
          {council.board.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {council.board.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                  <img src={avatarUrlFromSeed(m.id + m.name, 40)} alt="" className="size-8 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-medium text-neutral-900">{m.name}</div>
                    <div className="text-xs text-neutral-500">
                      {m.role === 'leader' ? 'Leder' : m.role === 'deputy' ? 'Nestleder' : 'Medlem'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : amuMembers.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {amuMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                  <img src={avatarUrlFromSeed(m.id + m.name, 40)} alt="" className="size-8 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-medium text-neutral-900">{m.name}</div>
                    <div className="text-xs text-neutral-500">{roleLabels[m.officeRole] ?? m.officeRole}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">AMU er ikke satt opp ennå. Gå til Council Room for å registrere valg og representanter.</p>
          )}
        </div>
      )}

      <p className="mt-1 text-xs text-neutral-400">
        Data hentes live fra Council-modulen. Endringer der reflekteres umiddelbart her.
      </p>
    </div>
  )
}
