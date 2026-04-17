import { useMemo } from 'react'
import { useRepresentatives } from '../../../hooks/useRepresentatives'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { RepresentativeMember } from '../../../types/representatives'

function pickVerneombudContact(members: RepresentativeMember[]) {
  const flagged = members.filter((m) => m.isVerneombud)
  if (flagged.length > 0) return flagged[0]!
  const chair = members.find((m) => m.side === 'employee' && m.officeRole === 'employee_chair')
  if (chair) return chair
  const dep = members.find((m) => m.side === 'employee' && m.officeRole === 'employee_deputy')
  return dep ?? null
}

export function EmergencyStopProcedure() {
  const rep = useRepresentatives()
  const { members: orgMembers, profile, user } = useOrgSetupContext()

  const contact = useMemo(() => {
    const vo = pickVerneombudContact(rep.members)
    if (!vo) {
      return { name: null as string | null, phone: null as string | null, email: null as string | null }
    }
    const byName = orgMembers.find(
      (m) => m.display_name.trim().toLowerCase() === vo.name.trim().toLowerCase(),
    )
    const om = byName
    const email = om?.email?.trim() || null
    const phone =
      user && profile && vo.name.trim().toLowerCase() === profile.display_name.trim().toLowerCase()
        ? profile.phone?.trim() || null
        : null
    return { name: vo.name, phone, email }
  }, [rep.members, orgMembers, profile, user])

  return (
    <div className="not-prose my-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
      <p className="font-semibold">Stansingsrett (AML §6-3)</p>
      <p className="mt-2">
        Verneombudet kan stanse arbeid ved overhengende fare for liv eller helse.
      </p>
      <p className="mt-2">
        {contact.name ? (
          <>
            <span className="font-medium">{contact.name}</span>
            {contact.phone || contact.email ? (
              <>
                {' '}
                — Ring:{' '}
                <span className="font-mono">{contact.phone ?? '—'}</span>
                {' · '}
                E-post:{' '}
                {contact.email ? (
                  <a className="font-mono text-red-900 underline" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                ) : (
                  <span className="font-mono">—</span>
                )}
              </>
            ) : (
              <span className="mt-1 block text-xs text-red-900/80">
                Legg inn telefon/e-post i medlemslisten eller representantregisteret slik at ansatte kan nå verneombudet.
              </span>
            )}
          </>
        ) : (
          <span className="text-red-900/90">
            Ingen verneombud registrert i representant-/valgmodulen — fyll inn kontakt i dokumentet eller oppdater
            registeret.
          </span>
        )}
      </p>
      <p className="mt-2 text-xs text-red-900/80">Hjemmel: AML §6-3</p>
    </div>
  )
}
