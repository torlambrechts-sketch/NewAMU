// Brukere-seksjonen.
// Lister profilene i organisasjonen + roller, MFA-status og siste
// pålogging. Filter-chips for raske utvalg. Inviter-knapp åpner
// invitations-flyten (samme RPC som UsersInternalAdminPanel).

import { useMemo, useState } from 'react'
import {
  KeyRound,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserPlus,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import {
  ADMIN_TABLE_TH,
  ADMIN_TABLE_TR_BODY,
  AdminCard,
  AdminError,
  AdminLoading,
  Initials,
} from './AdminShared'
import { useAdminUsers } from './useAdminUsers'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { AdminSectionProps } from './types'

type FilterId = 'all' | 'admin' | 'vo' | 'mfa-off' | 'external'

export function SecUsers({ easy }: AdminSectionProps) {
  const { users, loading, error, refresh } = useAdminUsers()
  const { locations } = useOrgSetupContext()
  const [filter, setFilter] = useState<FilterId>('all')

  const mfaOffCount = users.filter((u) => !u.mfa).length
  const externalCount = users.filter((u) => u.external).length

  const filtered = useMemo(() => {
    switch (filter) {
      case 'mfa-off':
        return users.filter((u) => !u.mfa)
      case 'external':
        return users.filter((u) => u.external)
      case 'admin':
        return users.filter((u) => u.primaryRoleSlug === 'admin')
      case 'vo':
        return users.filter(
          (u) => u.primaryRoleSlug === 'vo' || u.primaryRoleSlug === 'hvo',
        )
      default:
        return users
    }
  }, [filter, users])

  if (loading) return <AdminLoading />

  return (
    <AdminCard>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Brukere</h3>
          <p className="text-[11px] text-neutral-500">
            {users.length} totalt · {users.filter((u) => u.mfa).length} med MFA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-3 w-3" />}
            onClick={() => void refresh()}
          >
            Synk Aa-register
          </Button>
          <Button variant="primary" size="sm" icon={<UserPlus className="h-3 w-3" />}>
            Inviter bruker
          </Button>
        </div>
      </div>

      {error ? (
        <div className="px-5 pt-3">
          <AdminError message={error} />
        </div>
      ) : null}

      <div className="border-b border-neutral-100 px-5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label={`Alle (${users.length})`}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label="Administratorer"
            active={filter === 'admin'}
            onClick={() => setFilter('admin')}
          />
          <FilterChip
            label="Verneombud"
            active={filter === 'vo'}
            onClick={() => setFilter('vo')}
          />
          <FilterChip
            label={`MFA av (${mfaOffCount})`}
            active={filter === 'mfa-off'}
            onClick={() => setFilter('mfa-off')}
          />
          <FilterChip
            label={`Eksterne (${externalCount})`}
            active={filter === 'external'}
            onClick={() => setFilter('external')}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-neutral-50/60">
            <tr>
              <th className={ADMIN_TABLE_TH}>Bruker</th>
              <th className={ADMIN_TABLE_TH}>Rolle</th>
              {!easy && <th className={ADMIN_TABLE_TH}>Lokasjon</th>}
              <th className={ADMIN_TABLE_TH}>MFA</th>
              {!easy && <th className={ADMIN_TABLE_TH}>SSO</th>}
              <th className={ADMIN_TABLE_TH}>Status</th>
              <th className={ADMIN_TABLE_TH}>Sist pålogget</th>
              <th className={`${ADMIN_TABLE_TH} text-right`} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={easy ? 5 : 7}
                  className="px-5 py-8 text-center text-xs text-neutral-500"
                >
                  Ingen brukere matcher filteret.
                </td>
              </tr>
            ) : (
              filtered.map((u, i) => {
                const tone = (['forest', 'cream', 'sand'] as const)[i % 3]
                const locName =
                  u.locationName ??
                  locations.find((l) => l.id === u.locationId)?.name ??
                  '—'
                return (
                  <tr key={u.id} className={`${ADMIN_TABLE_TR_BODY} cursor-pointer`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Initials name={u.displayName} size={26} tone={tone} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-neutral-900">
                              {u.displayName}
                            </span>
                            {u.external && (
                              <span
                                title="Ekstern"
                                className="rounded bg-purple-100 px-1 py-0 text-[9px] font-bold text-purple-800"
                              >
                                EKST
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {u.email ?? '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium text-neutral-900">
                        {u.roleNames.length ? u.roleNames.join(', ') : 'Ingen rolle'}
                      </span>
                      {u.primaryRoleLaw.length > 0 ? (
                        <div className="text-[10px] text-neutral-500">
                          {u.primaryRoleLaw[0]}
                        </div>
                      ) : null}
                    </td>
                    {!easy && (
                      <td className="px-5 py-3 text-neutral-700">
                        {locName.split('·')[0]}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      {u.mfa ? (
                        <ShieldCheck
                          className="h-4 w-4 text-green-700"
                          aria-label="MFA aktivert"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                          <ShieldOff className="h-2.5 w-2.5" aria-hidden="true" /> Av
                        </span>
                      )}
                    </td>
                    {!easy && (
                      <td className="px-5 py-3">
                        {u.sso ? (
                          <KeyRound
                            className="h-4 w-4 text-[#1a3d32]"
                            aria-label="SSO aktivert"
                          />
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      {u.status === 'aktiv' ? (
                        <Badge variant="success">Aktiv</Badge>
                      ) : (
                        <Badge variant="warning">Permittert</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[11px] tabular-nums text-neutral-600">
                      {u.lastLogin ? formatDate(u.lastLogin) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-neutral-300" aria-hidden="true">
                      ›
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminCard>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ' +
        (active
          ? 'bg-[#1a3d32] text-white hover:bg-[#143028] hover:text-white'
          : 'border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-700')
      }
    >
      {label}
    </Button>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(
      2,
      '0',
    )}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`
  } catch {
    return iso
  }
}
