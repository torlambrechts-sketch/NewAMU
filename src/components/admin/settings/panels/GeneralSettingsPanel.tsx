// Generelle innstillinger (system scope) — sammendrag + lenke.
//
// The full editable form for org settings (employeeCount, industry,
// collective-agreement, signers, retention, etc.) already lives in
// `src/pages/OrganisationPage.tsx` under tab=settings, persisted via
// `useOrganisation().updateSettings`. Building a duplicate form here
// would split the source of truth, so this panel only surfaces the
// core identity (name, orgnr, BRREG snapshot freshness) and deep-links
// to the existing edit page for everything else.

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../../module'
import { Button } from '../../../ui/Button'
import { useOrgSetupContext } from '../../../../hooks/useOrgSetupContext'

type OrgRow = {
  id: string
  name: string
  organization_number: string
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
  brreg_snapshot: { name?: string; lastSyncedAt?: string } | null
}

export default function GeneralSettingsPanel() {
  const { supabase: sb, organization } = useOrgSetupContext()
  const [row, setRow] = useState<OrgRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sb || !organization?.id) return
    let cancelled = false
    void (async () => {
      const { data, error } = await sb
        .from('organizations')
        .select('id, name, organization_number, onboarding_completed_at, created_at, updated_at, brreg_snapshot')
        .eq('id', organization.id)
        .maybeSingle()
      if (cancelled) return
      if (!error && data) setRow(data as OrgRow)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [sb, organization?.id])

  if (loading) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#1a3d32]" />
      </div>
    )
  }

  if (!row) {
    return <p className="p-4 text-center text-neutral-600">Ingen organisasjon.</p>
  }

  return (
    <div className="space-y-4">
      <ModuleSectionCard className="p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Selskapsidentitet</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Kjernedata for organisasjonen. Detaljerte felter (ansattall, bransje, tariffavtale,
          signaturansvarlige, oppbevarings­tid) redigeres på Organisasjonssiden.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Selskap</dt>
            <dd className="mt-0.5 text-neutral-900">{row.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Org.nr</dt>
            <dd className="mt-0.5 text-neutral-900">{row.organization_number}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Onboarding fullført</dt>
            <dd className="mt-0.5 text-neutral-900">
              {row.onboarding_completed_at
                ? new Date(row.onboarding_completed_at).toLocaleDateString('nb-NO')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Sist oppdatert</dt>
            <dd className="mt-0.5 text-neutral-900">
              {new Date(row.updated_at).toLocaleDateString('nb-NO')}
            </dd>
          </div>
          {row.brreg_snapshot?.lastSyncedAt ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">BRREG-synk</dt>
              <dd className="mt-0.5 text-neutral-900">
                Sist hentet {new Date(row.brreg_snapshot.lastSyncedAt).toLocaleDateString('nb-NO')}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/organisation?tab=settings">
            <Button variant="primary" size="sm">
              Rediger på Organisasjonssiden
            </Button>
          </Link>
          <Link to="/organisation?tab=insights">
            <Button variant="secondary" size="sm">
              Se organisasjonsoversikt
            </Button>
          </Link>
        </div>
      </ModuleSectionCard>
    </div>
  )
}
