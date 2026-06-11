// Brukere-seksjonen.
// Lister profilene i organisasjonen + roller, MFA-status og siste
// pålogging. Filter-chips for raske utvalg. Inviter-knapp åpner
// invitations-flyten (samme RPC som UsersInternalAdminPanel).

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Upload,
  UserPlus,
  Users2,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { StandardTextarea } from '../../../components/ui/Textarea'
import {
  ADMIN_TABLE_TH,
  ADMIN_TABLE_TR_BODY,
  AdminCard,
  AdminError,
  AdminLoading,
  Initials,
} from './AdminShared'
import { formatDateTime } from './format'
import { useAdminUsers } from './useAdminUsers'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import {
  createInvitations,
  parseCsvEmails,
  parseEmailList,
  type InviteResult,
} from '../../../lib/inviteEmails'
import type { AdminSectionProps } from './types'

type FilterId = 'all' | 'admin' | 'vo' | 'external' | 'no-role' | 'mfa-off'

type PendingInvite = {
  id: string
  email: string
  token: string
  expiresAt: string
  createdAt: string
}

const inviteLinkFor = (token: string) => `${window.location.origin}/invite/${token}`

export function SecUsers({ easy }: AdminSectionProps) {
  const { users, loading, error, refresh, authMetaAvailable } = useAdminUsers()
  const { supabase, organization, refreshChildren } = useOrgSetupContext()
  const [filter, setFilter] = useState<FilterId>('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  // Bulk invite (H2.4) — paste/CSV → preview with dedupe → batch create.
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResults, setBulkResults] = useState<InviteResult[] | null>(null)

  const loadInvites = useCallback(async () => {
    if (!supabase || !organization) return
    const { data } = await supabase
      .from('invitations')
      .select('id, email, token, expires_at, created_at')
      .eq('organization_id', organization.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPendingInvites(
      (data ?? []).map((r) => {
        const row = r as Record<string, unknown>
        return {
          id: String(row.id),
          email: String(row.email ?? ''),
          token: String(row.token ?? ''),
          expiresAt: String(row.expires_at ?? ''),
          createdAt: String(row.created_at ?? ''),
        }
      }),
    )
  }, [supabase, organization])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  const copyInviteLink = useCallback(async (token: string) => {
    const full = inviteLinkFor(token)
    await navigator.clipboard.writeText(full).catch(() => undefined)
    setInviteMsg(`Lenke kopiert: ${full}`)
  }, [])

  const revokeInvite = useCallback(
    async (id: string) => {
      if (!supabase) return
      const { error: upErr } = await supabase
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('id', id)
      if (upErr) {
        setInviteMsg(upErr.message)
        return
      }
      setInviteMsg('Invitasjon trukket tilbake.')
      await loadInvites()
    },
    [supabase, loadInvites],
  )

  const resendInvite = useCallback(
    async (invite: PendingInvite) => {
      if (!supabase) return
      // Email delivery is a follow-up (edge function + provider). Today the
      // link is the channel, so "send på nytt" renews validity and re-copies
      // the link for the admin to share.
      const { error: upErr } = await supabase
        .from('invitations')
        .update({ expires_at: new Date(Date.now() + 14 * 86400000).toISOString() })
        .eq('id', invite.id)
      if (upErr) {
        setInviteMsg(upErr.message)
        return
      }
      await copyInviteLink(invite.token)
      setInviteMsg(`Gyldighet fornyet 14 dager. Lenke kopiert — del den med ${invite.email}.`)
      await loadInvites()
    },
    [supabase, copyInviteLink, loadInvites],
  )

  const noRoleCount = users.filter((u) => u.roleNames.length === 0).length
  const externalCount = users.filter((u) => u.external).length
  const mfaOffCount = authMetaAvailable
    ? users.filter((u) => !u.mfa).length
    : 0

  const filtered = useMemo(() => {
    switch (filter) {
      case 'no-role':
        return users.filter((u) => u.roleNames.length === 0)
      case 'external':
        return users.filter((u) => u.external)
      case 'admin':
        return users.filter((u) => u.primaryRoleSlug === 'admin')
      case 'mfa-off':
        // Defensive: when auth metadata isn't available all users
        // would falsely have `mfa: false` (the fallback default). The
        // filter chip is hidden in that case, but guard here too in
        // case URL state ever drives the filter.
        return authMetaAvailable ? users.filter((u) => !u.mfa) : []
      case 'vo':
        return users.filter(
          (u) =>
            u.primaryRoleSlug === 'verneombud' ||
            u.primaryRoleSlug === 'hoved_verneombud',
        )
      default:
        return users
    }
  }, [filter, users, authMetaAvailable])

  async function submitInvite() {
    if (!supabase || !inviteEmail.includes('@')) return
    setInviteBusy(true)
    setInviteMsg(null)
    setInviteLink(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('create_invitation', {
        p_email: inviteEmail.trim(),
        p_role_ids: null,
        p_days_valid: 14,
      })
      if (rpcErr) throw rpcErr
      const row = Array.isArray(data) ? data[0] : data
      const path = (row as { invite_url_path?: string } | null)?.invite_url_path
      if (path) {
        const full = `${window.location.origin}${path}`
        setInviteLink(full)
        await navigator.clipboard.writeText(full).catch(() => undefined)
        setInviteMsg('Invitasjons-lenke opprettet og kopiert. Del den med mottakeren.')
      } else {
        setInviteMsg('Invitasjon opprettet.')
      }
      setInviteEmail('')
      await Promise.all([refresh(), refreshChildren?.(), loadInvites()])
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : 'Kunne ikke opprette invitasjon')
    } finally {
      setInviteBusy(false)
    }
  }

  // Preview rows: parsed input classified against existing members + pending
  // invites so the admin sees exactly what will happen before creating.
  const bulkPreview = useMemo(() => {
    const parsed = parseEmailList(bulkText)
    const memberEmails = new Set(
      users.map((u) => u.email?.trim().toLowerCase()).filter((e): e is string => !!e),
    )
    const pendingEmails = new Set(pendingInvites.map((i) => i.email.trim().toLowerCase()))
    return {
      invalid: parsed.invalid,
      alreadyMember: parsed.valid.filter((e) => memberEmails.has(e)),
      alreadyInvited: parsed.valid.filter((e) => !memberEmails.has(e) && pendingEmails.has(e)),
      ready: parsed.valid.filter((e) => !memberEmails.has(e) && !pendingEmails.has(e)),
    }
  }, [bulkText, users, pendingInvites])

  const handleCsvFile = useCallback(async (file: File) => {
    const text = await file.text()
    const parsed = parseCsvEmails(text)
    const all = [...parsed.valid, ...parsed.invalid]
    if (all.length > 0) {
      setBulkText((prev) => (prev.trim() ? `${prev.trim()}\n` : '') + all.join('\n'))
    }
  }, [])

  const submitBulk = useCallback(async () => {
    if (!supabase || bulkPreview.ready.length === 0) return
    setBulkBusy(true)
    setBulkResults(null)
    try {
      const results = await createInvitations(supabase, bulkPreview.ready)
      setBulkResults(results)
      if (results.some((r) => r.ok)) {
        setBulkText('')
        await Promise.all([refresh(), refreshChildren?.(), loadInvites()])
      }
    } finally {
      setBulkBusy(false)
    }
  }, [supabase, bulkPreview.ready, refresh, refreshChildren, loadInvites])

  if (loading) return <AdminLoading />
  if (!organization) return <AdminError message="Mangler organisasjon." />

  return (
    <AdminCard>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Brukere</h3>
          <p className="text-[11px] text-neutral-500">
            {users.length} totalt · {externalCount} eksterne
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-3 w-3" />}
            onClick={() => void refresh()}
          >
            Oppdater
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus className="h-3 w-3" />}
            onClick={() => setInviteOpen((v) => !v)}
          >
            Inviter bruker
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Users2 className="h-3 w-3" />}
            onClick={() => setBulkOpen((v) => !v)}
          >
            Inviter flere
          </Button>
        </div>
      </div>

      {inviteOpen && (
        <div className="flex flex-wrap items-end gap-2 border-b border-neutral-100 bg-neutral-50/60 px-5 py-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="invite-email">
              E-post
            </label>
            <StandardInput
              id="invite-email"
              type="email"
              placeholder="navn@firma.no"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={inviteBusy || !inviteEmail.includes('@')}
            icon={inviteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
            onClick={() => void submitInvite()}
          >
            Opprett invitasjons-lenke
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInviteOpen(false)
              setInviteMsg(null)
            }}
          >
            Avbryt
          </Button>
          {inviteLink ? (
            <div className="basis-full">
              <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <code className="min-w-0 flex-1 truncate text-[11px] text-neutral-700">{inviteLink}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy className="h-3 w-3" />}
                  onClick={() => void copyInviteLink(inviteLink.split('/invite/')[1] ?? '')}
                >
                  Kopier
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-neutral-400">
                E-postutsending kommer — del lenken manuelt inntil videre.
              </p>
            </div>
          ) : null}
          {inviteMsg ? (
            <span className="basis-full text-[11px] text-neutral-700">{inviteMsg}</span>
          ) : null}
        </div>
      )}

      {bulkOpen && (
        <div className="space-y-3 border-b border-neutral-100 bg-neutral-50/60 px-5 py-3">
          <div>
            <label
              className="text-[10px] font-bold uppercase tracking-wider text-neutral-500"
              htmlFor="bulk-invite-emails"
            >
              Lim inn e-postadresser (linjeskift, komma eller semikolon)
            </label>
            <StandardTextarea
              id="bulk-invite-emails"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={4}
              placeholder={'kari@firma.no\nole@firma.no, per@firma.no'}
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:border-neutral-400">
              <Upload className="h-3 w-3" aria-hidden />
              Last opp CSV
              {/* eslint-disable-next-line no-restricted-syntax -- hidden file input; StandardInput targets text fields */}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleCsvFile(f)
                  e.target.value = ''
                }}
              />
            </label>
            <span className="text-[11px] text-neutral-500">
              {bulkPreview.ready.length} klare
              {bulkPreview.alreadyMember.length > 0
                ? ` · ${bulkPreview.alreadyMember.length} allerede medlem`
                : ''}
              {bulkPreview.alreadyInvited.length > 0
                ? ` · ${bulkPreview.alreadyInvited.length} allerede invitert`
                : ''}
              {bulkPreview.invalid.length > 0 ? ` · ${bulkPreview.invalid.length} ugyldige` : ''}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBulkOpen(false)
                  setBulkResults(null)
                }}
              >
                Avbryt
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={bulkBusy || bulkPreview.ready.length === 0}
                icon={
                  bulkBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <UserPlus className="h-3 w-3" />
                  )
                }
                onClick={() => void submitBulk()}
              >
                Opprett {bulkPreview.ready.length} invitasjoner
              </Button>
            </div>
          </div>
          {bulkPreview.invalid.length > 0 ? (
            <p className="text-[11px] text-red-600">
              Ugyldige: {bulkPreview.invalid.join(', ')}
            </p>
          ) : null}
          {bulkResults ? (
            <div className="rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-[11px]">
              <p className="font-semibold text-neutral-800">
                {bulkResults.filter((r) => r.ok).length} av {bulkResults.length} invitasjoner
                opprettet. Lenkene ligger under «Ventende invitasjoner».
              </p>
              {bulkResults
                .filter((r) => !r.ok)
                .map((r) => (
                  <p key={r.email} className="mt-0.5 text-red-600">
                    {r.email}: {r.error}
                  </p>
                ))}
            </div>
          ) : null}
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="border-b border-neutral-100 px-5 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Ventende invitasjoner ({pendingInvites.length})
          </p>
          <ul className="flex flex-col gap-1.5">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-800">
                  {inv.email}
                </span>
                <span className="text-[10px] text-neutral-400">
                  Utløper {formatDateTime(inv.expiresAt)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy className="h-3 w-3" />}
                  onClick={() => void copyInviteLink(inv.token)}
                >
                  Kopier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCw className="h-3 w-3" />}
                  onClick={() => void resendInvite(inv)}
                >
                  Send på nytt
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-3 w-3" />}
                  onClick={() => void revokeInvite(inv.id)}
                >
                  Trekk tilbake
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
            label={`Uten rolle (${noRoleCount})`}
            active={filter === 'no-role'}
            onClick={() => setFilter('no-role')}
          />
          <FilterChip
            label={`Eksterne (${externalCount})`}
            active={filter === 'external'}
            onClick={() => setFilter('external')}
          />
          {authMetaAvailable ? (
            <FilterChip
              label={`MFA av (${mfaOffCount})`}
              active={filter === 'mfa-off'}
              onClick={() => setFilter('mfa-off')}
            />
          ) : null}
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
                  // Easy mode = 6 cols (Bruker, Rolle, MFA, Status, Sist pålogget, action).
                  // Advanced adds Lokasjon + SSO = 8.
                  colSpan={easy ? 6 : 8}
                  className="px-5 py-8 text-center text-xs text-neutral-500"
                >
                  Ingen brukere matcher filteret.
                </td>
              </tr>
            ) : (
              filtered.map((u, i) => {
                const tone = (['forest', 'cream', 'sand'] as const)[i % 3]
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
                        {u.locationName ? (
                          u.locationName.split('·')[0]?.trim()
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      {!authMetaAvailable ? (
                        <span
                          className="text-neutral-400"
                          aria-label="MFA-status krever administrator-tilgang"
                          title="MFA-status krever administrator-tilgang"
                        >
                          —
                        </span>
                      ) : u.mfa ? (
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
                        {!authMetaAvailable ? (
                          <span
                            className="text-neutral-400"
                            aria-label="SSO-status krever administrator-tilgang"
                            title="SSO-status krever administrator-tilgang"
                          >
                            —
                          </span>
                        ) : u.sso ? (
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
                      {formatDateTime(u.lastLogin)}
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

