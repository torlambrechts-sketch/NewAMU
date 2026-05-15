// Eksterne brukere — samlet liste med type-filter.
//
// Four categories of "non-employee with access to org data" exist in
// the schema today, each with its own table. There's no UNION view yet
// (only 1 of 4 sources is mature), so this panel uses a chip filter
// and lazy-loads each source on demand. When 3+ sources stabilise, a
// future v_external_users_unified view can replace the per-tab queries.
//
// Sources:
// - auditor                  workflow_auditor_tokens  (signed links, no auth row)
// - external_functional_role org_active_role_holders  (category='eksternt')
// - contractor               vendors                  (survey-scoped today)
// - course_participant       learning_external_certificates  (cert submissions only)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ModuleSectionCard } from '../../module'
import { WarningBox } from '../../ui/AlertBox'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type ChipId =
  | 'auditor'
  | 'external_functional_role'
  | 'contractor'
  | 'course_participant'

const CHIPS: { id: ChipId; label: string; description: string }[] = [
  { id: 'auditor', label: 'Revisorer', description: 'Signerte lenker for ekstern revisor (Arbeidstilsynet, Datatilsynet, m.fl.)' },
  { id: 'external_functional_role', label: 'Eksterne funksjonsroller', description: 'Personer i funksjonsroller med kategori «eksternt» (f.eks. ekstern DPO)' },
  { id: 'contractor', label: 'Leverandører', description: 'Leverandører registrert for undersøkelser (kontraktørportal kommer)' },
  { id: 'course_participant', label: 'Eksterne kursdeltakere', description: 'Eksterne deltakere som har lastet opp kompetansebevis' },
]

type AuditorRow = {
  id: string
  label: string | null
  expires_at: string | null
  revoked_at: string | null
  use_count: number | null
  last_used_at: string | null
  created_at: string
}

type FunctionalRow = {
  organization_id: string
  role_slug: string
  role_label: string | null
  user_id: string | null
  user_name: string | null
  user_email: string | null
  valid_from: string | null
  valid_to: string | null
}

type VendorRow = {
  id: string
  display_name: string
  org_number: string | null
  primary_email: string | null
  contact_name: string | null
  status: string | null
}

type LearningCertRow = {
  id: string
  user_id: string
  title: string
  issuer: string | null
  valid_until: string | null
  status: string
  created_at: string
}

export function ExternalUsersAdminPanel() {
  const { supabase: sb, organization } = useOrgSetupContext()
  const [active, setActive] = useState<ChipId>('auditor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [auditors, setAuditors] = useState<AuditorRow[]>([])
  const [functional, setFunctional] = useState<FunctionalRow[]>([])
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [certs, setCerts] = useState<LearningCertRow[]>([])

  const load = useCallback(
    async (chip: ChipId) => {
      if (!sb || !organization?.id) return
      try {
        setLoading(true)
        setError(null)
        if (chip === 'auditor') {
          const { data, error: err } = await sb
            .from('workflow_auditor_tokens')
            .select('id, label, expires_at, revoked_at, use_count, last_used_at, created_at')
            .eq('organization_id', organization.id)
            .order('created_at', { ascending: false })
            .limit(200)
          if (err) throw err
          setAuditors((data ?? []) as AuditorRow[])
        } else if (chip === 'external_functional_role') {
          const { data, error: err } = await sb
            .from('org_active_role_holders')
            .select('organization_id, role_slug, role_label, user_id, user_name, user_email, valid_from, valid_to')
            .eq('organization_id', organization.id)
            .eq('role_category', 'eksternt')
            .order('role_label')
          if (err) throw err
          setFunctional((data ?? []) as FunctionalRow[])
        } else if (chip === 'contractor') {
          const { data, error: err } = await sb
            .from('vendors')
            .select('id, display_name, org_number, primary_email, contact_name, status')
            .eq('organization_id', organization.id)
            .is('deleted_at', null)
            .order('display_name')
            .limit(200)
          if (err) throw err
          setVendors((data ?? []) as VendorRow[])
        } else if (chip === 'course_participant') {
          const { data, error: err } = await sb
            .from('learning_external_certificates')
            .select('id, user_id, title, issuer, valid_until, status, created_at')
            .eq('organization_id', organization.id)
            .order('created_at', { ascending: false })
            .limit(200)
          if (err) throw err
          setCerts((data ?? []) as LearningCertRow[])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : `Kunne ikke laste ${chip}`)
      } finally {
        setLoading(false)
      }
    },
    [sb, organization?.id],
  )

  useEffect(() => {
    void load(active)
  }, [active, load])

  const activeChipMeta = useMemo(() => CHIPS.find((c) => c.id === active)!, [active])

  if (!sb || !organization) {
    return <p className="p-4 text-center text-neutral-600">Ingen organisasjon.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active === c.id
                ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-neutral-500">{activeChipMeta.description}</p>

      {error ? <WarningBox>{error}</WarningBox> : null}

      <ModuleSectionCard className="p-5">
        {loading ? (
          <div className="flex min-h-[20vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-[#1a3d32]" />
          </div>
        ) : active === 'auditor' ? (
          <AuditorList rows={auditors} />
        ) : active === 'external_functional_role' ? (
          <FunctionalList rows={functional} />
        ) : active === 'contractor' ? (
          <VendorList rows={vendors} />
        ) : (
          <CourseParticipantList rows={certs} />
        )}
      </ModuleSectionCard>
    </div>
  )
}

function computeAuditorStatus(r: AuditorRow): string {
  if (r.revoked_at) return 'Trukket tilbake'
  if (r.expires_at && new Date(r.expires_at) < new Date()) return 'Utløpt'
  return 'Aktiv'
}

function AuditorList({ rows }: { rows: AuditorRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Ingen revisor-lenker"
        body="Lenker opprettes via /auditor/workflows. Revisorer trenger ikke konto i Atics — de signerer med den utstedte lenken."
      />
    )
  }
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-neutral-500">
          <th className="py-2 pr-4">Etikett</th>
          <th className="py-2 pr-4">Status</th>
          <th className="py-2 pr-4">Antall bruk</th>
          <th className="py-2 pr-4">Sist brukt</th>
          <th className="py-2">Utløper</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const status = computeAuditorStatus(r)
          return (
            <tr key={r.id} className="border-b border-neutral-100">
              <td className="py-2 pr-4 font-medium text-neutral-900">{r.label ?? '—'}</td>
              <td className="py-2 pr-4 text-neutral-600">{status}</td>
              <td className="py-2 pr-4 text-neutral-600">{r.use_count ?? 0}</td>
              <td className="py-2 pr-4 text-neutral-600">
                {r.last_used_at ? new Date(r.last_used_at).toLocaleDateString('nb-NO') : '—'}
              </td>
              <td className="py-2 text-neutral-600">
                {r.expires_at ? new Date(r.expires_at).toLocaleDateString('nb-NO') : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table></div>
  )
}

function FunctionalList({ rows }: { rows: FunctionalRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Ingen eksterne funksjonsroller"
        body="Eksterne funksjonsroller (f.eks. ekstern DPO, Arbeidstilsynet-inspektør) tildeles fra Funksjonelle roller. Filtreres på kategori «eksternt»."
      />
    )
  }
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-neutral-500">
          <th className="py-2 pr-4">Navn</th>
          <th className="py-2 pr-4">E-post</th>
          <th className="py-2 pr-4">Rolle</th>
          <th className="py-2">Gyldig til</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.user_id ?? 'u'}-${r.role_slug}-${i}`} className="border-b border-neutral-100">
            <td className="py-2 pr-4 font-medium text-neutral-900">{r.user_name ?? '—'}</td>
            <td className="py-2 pr-4 text-neutral-600">{r.user_email ?? '—'}</td>
            <td className="py-2 pr-4 text-neutral-600">{r.role_label ?? r.role_slug}</td>
            <td className="py-2 text-neutral-600">
              {r.valid_to ? new Date(r.valid_to).toLocaleDateString('nb-NO') : 'Løpende'}
            </td>
          </tr>
        ))}
      </tbody>
    </table></div>
  )
}

function VendorList({ rows }: { rows: VendorRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Ingen leverandører"
        body="Leverandørregisteret deler bord med undersøkelser i dag. En egen kontraktørportal (med tilgang for HMS-erklæring og kjemikalielister) kommer i en senere fase."
      />
    )
  }
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-neutral-500">
          <th className="py-2 pr-4">Navn</th>
          <th className="py-2 pr-4">Org.nr</th>
          <th className="py-2 pr-4">Kontakt</th>
          <th className="py-2 pr-4">E-post</th>
          <th className="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-neutral-100">
            <td className="py-2 pr-4 font-medium text-neutral-900">{r.display_name}</td>
            <td className="py-2 pr-4 text-neutral-600">{r.org_number ?? '—'}</td>
            <td className="py-2 pr-4 text-neutral-600">{r.contact_name ?? '—'}</td>
            <td className="py-2 pr-4 text-neutral-600">{r.primary_email ?? '—'}</td>
            <td className="py-2 text-neutral-600">{r.status ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  )
}

function CourseParticipantList({ rows }: { rows: LearningCertRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Ingen eksterne kompetansebevis"
        body="Eksterne deltakere har ennå ikke lastet opp kompetansebevis. Dedikert deltakerregister for eksterne kommer i en senere fase."
      />
    )
  }
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-neutral-500">
          <th className="py-2 pr-4">Tittel</th>
          <th className="py-2 pr-4">Utsteder</th>
          <th className="py-2 pr-4">Status</th>
          <th className="py-2 pr-4">Gyldig til</th>
          <th className="py-2">Levert</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-neutral-100">
            <td className="py-2 pr-4 font-medium text-neutral-900">{r.title}</td>
            <td className="py-2 pr-4 text-neutral-600">{r.issuer ?? '—'}</td>
            <td className="py-2 pr-4 text-neutral-600">{r.status}</td>
            <td className="py-2 pr-4 text-neutral-600">
              {r.valid_until ? new Date(r.valid_until).toLocaleDateString('nb-NO') : '—'}
            </td>
            <td className="py-2 text-neutral-600">
              {new Date(r.created_at).toLocaleDateString('nb-NO')}
            </td>
          </tr>
        ))}
      </tbody>
    </table></div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-2 py-6 text-neutral-700">
      <h3 className="text-base font-medium text-neutral-900">{title}</h3>
      <p className="text-sm text-neutral-600">{body}</p>
    </div>
  )
}
