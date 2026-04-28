import { useMemo, useState } from 'react'
import { Check, Link2, Loader2, Mail, Users } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { ModuleSectionCard } from '../../../src/components/module'
import { Button } from '../../../src/components/ui/Button'
import { Badge } from '../../../src/components/ui/Badge'
import { InfoBox, WarningBox } from '../../../src/components/ui/AlertBox'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../../src/components/ui/SearchableSelect'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type { UseSurveyState } from '../useSurvey'
import type { SurveyDistributionRow, SurveyInvitationRow, SurveyRow } from '../types'
import { buildSurveyRespondUrl } from '../surveyInviteLink'

function audienceLabel(row: SurveyDistributionRow): string {
  if (row.audience_type === 'all') return 'Alle ansatte med profil'
  const n = row.audience_department_ids?.length ?? 0
  return n === 0 ? 'Avdelinger (ingen valgt)' : `${n} avdeling(er)`
}

function statusBadge(dist: SurveyDistributionRow): { label: string; variant: 'neutral' | 'warning' | 'success' } {
  switch (dist.status) {
    case 'draft':
      return { label: 'Kladd', variant: 'neutral' }
    case 'generated':
      return { label: 'Mottakere generert', variant: 'warning' }
    case 'completed':
      return { label: 'Fullført', variant: 'success' }
    case 'cancelled':
      return { label: 'Avbrutt', variant: 'neutral' }
    default:
      return { label: dist.status, variant: 'neutral' }
  }
}

function TabEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Users className="h-10 w-10 text-neutral-300" strokeWidth={1.25} />
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  )
}

export function SurveyDistribusjonTab({ survey, s }: { survey: UseSurveyState; s: SurveyRow }) {
  const { departments, orgProfiles } = useOrgSetupContext()
  const [label, setLabel] = useState('')
  const [audience, setAudience] = useState<'all' | 'departments'>('all')
  const [deptSelection, setDeptSelection] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [genId, setGenId] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [sendId, setSendId] = useState<string | null>(null)

  const nameByProfileId = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of orgProfiles) {
      m[p.id] = p.display_name || p.email || p.id
    }
    return m
  }, [orgProfiles])

  const deptNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const d of departments) m[d.id] = d.name
    return m
  }, [departments])

  const audienceOptions: SelectOption[] = useMemo(
    () => [
      { value: 'all', label: 'Hele organisasjonen' },
      { value: 'departments', label: 'Valgte avdelinger' },
    ],
    [],
  )

  const byDistribution = useMemo(() => {
    const m = new Map<string, SurveyInvitationRow[]>()
    for (const inv of survey.invitations) {
      const list = m.get(inv.distribution_id) ?? []
      list.push(inv)
      m.set(inv.distribution_id, list)
    }
    return m
  }, [survey.invitations])

  const copyPersonalLink = async (token: string | null) => {
    if (!token) return
    const url = buildSurveyRespondUrl(s.id, token)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      window.setTimeout(() => {
        setCopiedToken((t) => (t === token ? null : t))
      }, 2000)
    } catch {
      /* ignore */
    }
  }

  if (!survey.canManage) {
    return <TabEmpty message="Du har ikke tilgang til å se distribusjon. Krever survey.manage eller administrator." />
  }

  return (
    <div className="space-y-6">
      {s.is_anonymous ? (
        <InfoBox>
          <p>
            Denne undersøkelsen er anonym — ingen bruker-ID på svar, så «Svar»-fanen viser ikke hvem som svarte.
            For å oppdatere mottakerlisten (<strong>venter / levert</strong>) må hver person åpne sin{' '}
            <strong>personlige lenke</strong> med <code className="rounded bg-neutral-100 px-1">?invite=…</code>.
            Uten den telles ikke svaret på riktig mottaker.
          </p>
          <p className="mt-2 text-sm">
            Lenken styrer hvilken plass i mottakerlisten som fullføres — del den kun med riktig person.
          </p>
        </InfoBox>
      ) : (
        <InfoBox>
          Innloggede brukere kobles automatisk til sin profil. Personlige lenker er valgfrie, men nyttige til e-post
          eller chat (samme kobling som uten lenke når brukeren er innlogget).
        </InfoBox>
      )}

      {s.status === 'draft' ? (
        <WarningBox>
          Undersøkelsen er fortsatt i kladd. Publiser den før deltakere kan sende inn svar. Du kan likevel opprette
          distribusjoner og forhåndsvise mottakere.
        </WarningBox>
      ) : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-800">Ny distribusjon</p>
            <p className="mt-1 text-sm text-neutral-600">
              Definer en målgruppe (hele org. eller utvalgte avdelinger) og generer mottakere basert på profiler i
              organisasjonen. Hver mottaker får en personlig lenke — kopier den manuelt eller bruk «Send e-post»
              (Supabase Edge Function + Resend).
            </p>
            <div className="mt-4 space-y-4">
              <div className={WPSTD_FORM_ROW_GRID}>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="dist-label">
                    Merkelapp (valgfritt)
                  </label>
                  <StandardInput
                    id="dist-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="F.eks. Runde 1, Q1 2026"
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="dist-audience">
                    Målgruppe
                  </label>
                  <SearchableSelect
                    value={audience}
                    options={audienceOptions}
                    onChange={(v) => {
                      setAudience(v as 'all' | 'departments')
                      if (v === 'all') setDeptSelection([])
                    }}
                  />
                </div>
              </div>
              {audience === 'departments' ? (
                <div>
                  <p className={WPSTD_FORM_FIELD_LABEL}>Avdelinger</p>
                  <p className="mb-2 text-xs text-neutral-500">
                    Velg én eller flere. Kun profiler med satt avdeling i valgte avdelinger inkluderes.
                  </p>
                  {departments.length === 0 ? (
                    <p className="text-sm text-amber-800">Ingen avdelinger er registrert i organisasjonen.</p>
                  ) : (
                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-neutral-200 p-3">
                      {departments.map((d) => {
                        const checked = deptSelection.includes(d.id)
                        return (
                          <li key={d.id}>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                              <input
                                type="checkbox"
                                className="rounded border-neutral-300"
                                checked={checked}
                                onChange={() => {
                                  setDeptSelection((prev) =>
                                    checked ? prev.filter((id) => id !== d.id) : [...prev, d.id],
                                  )
                                }}
                              />
                              {d.name}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
              <Button
                type="button"
                variant="primary"
                disabled={
                  creating ||
                  (audience === 'departments' && deptSelection.length === 0) ||
                  survey.distributionsLoading
                }
                onClick={async () => {
                  setCreating(true)
                  try {
                    const row = await survey.createDistribution({
                      surveyId: s.id,
                      label: label.trim() || null,
                      audienceType: audience,
                      departmentIds: audience === 'departments' ? deptSelection : undefined,
                    })
                    if (row) {
                      setLabel('')
                      setDeptSelection([])
                    }
                  } finally {
                    setCreating(false)
                  }
                }}
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Oppretter…
                  </>
                ) : (
                  'Opprett distribusjon'
                )}
              </Button>
            </div>
          </div>
        </div>
      </ModuleSectionCard>

      {survey.distributions.length === 0 ? (
        <TabEmpty message="Ingen distribusjoner ennå. Opprett en over for å planlegge mottakere." />
      ) : (
        <div className="space-y-4">
          {survey.distributions.map((dist) => {
            const invs = byDistribution.get(dist.id) ?? []
            const done = invs.filter((i) => i.status === 'completed').length
            const pending = invs.filter((i) => i.status === 'pending').length
            const st = statusBadge(dist)
            return (
              <ModuleSectionCard key={dist.id} className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {dist.label?.trim() || 'Uten merkelapp'}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {audienceLabel(dist)} · {new Date(dist.created_at).toLocaleString('nb-NO')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {dist.status === 'generated' || dist.status === 'completed' ? (
                      <span className="text-xs text-neutral-600">
                        {done}/{invs.length} levert
                        {pending > 0 ? ` · ${pending} venter` : null}
                      </span>
                    ) : null}
                    {dist.status === 'draft' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={genId === dist.id}
                        onClick={async () => {
                          setGenId(dist.id)
                          try {
                            await survey.generateInvitations(dist.id, s.id)
                          } finally {
                            setGenId(null)
                          }
                        }}
                      >
                        {genId === dist.id ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                            Genererer…
                          </>
                        ) : (
                          'Generer mottakere'
                        )}
                      </Button>
                    ) : null}
                    {(dist.status === 'generated' || dist.status === 'completed') && invs.length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={sendId === dist.id}
                        onClick={async () => {
                          setSendId(dist.id)
                          try {
                            await survey.sendInvitationEmails(dist.id, s.id)
                          } finally {
                            setSendId(null)
                          }
                        }}
                      >
                        {sendId === dist.id ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                            Sender…
                          </>
                        ) : (
                          <>
                            <Mail className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            Send e-post
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {invs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100 bg-white text-xs text-neutral-500">
                          <th className="px-4 py-2 font-medium">Mottaker</th>
                          <th className="px-4 py-2 font-medium">E-post (øyeblikksbilde)</th>
                          <th className="px-4 py-2 font-medium">Avdeling</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium">E-post sendt</th>
                          <th className="px-4 py-2 font-medium">Lenke</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invs.map((inv) => (
                          <tr key={inv.id} className="border-b border-neutral-50">
                            <td className="px-4 py-2.5 text-neutral-800">
                              {nameByProfileId[inv.profile_id] ?? inv.profile_id.slice(0, 8)}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-600">{inv.email_snapshot ?? '—'}</td>
                            <td className="px-4 py-2.5 text-neutral-600">
                              {inv.department_id ? deptNameById[inv.department_id] ?? inv.department_id : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={inv.status === 'completed' ? 'success' : 'neutral'}>
                                {inv.status === 'completed' ? 'Levert' : 'Venter'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-neutral-600">
                              {inv.email_sent_at ? (
                                <span title={inv.email_send_error ?? undefined}>
                                  {new Date(inv.email_sent_at).toLocaleString('nb-NO')}
                                </span>
                              ) : inv.email_send_error ? (
                                <span className="text-amber-800" title={inv.email_send_error}>
                                  Feilet
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {inv.access_token && inv.status === 'pending' ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1.5 px-2 text-xs"
                                  onClick={() => void copyPersonalLink(inv.access_token)}
                                >
                                  {copiedToken === inv.access_token ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                                  ) : (
                                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                  {copiedToken === inv.access_token ? 'Kopiert' : 'Kopier lenke'}
                                </Button>
                              ) : inv.access_token && inv.status === 'completed' ? (
                                <span className="text-xs text-neutral-400">—</span>
                              ) : (
                                <span className="text-xs text-amber-800" title="Generer mottakere på nytt etter migrasjon">
                                  Mangler token
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : dist.status !== 'draft' ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-500">Ingen profiler matchet målgruppen.</p>
                ) : (
                  <p className="px-4 py-4 text-sm text-neutral-500">
                    Klikk «Generer mottakere» for å bygge listen fra organisasjonens profiler.
                  </p>
                )}
              </ModuleSectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
