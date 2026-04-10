import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import {
  BarChart3,
  BookMarked,
  ClipboardCheck,
  FileSpreadsheet,
  Globe,
  HeartPulse,
  ListTree,
  Shield,
  ShieldAlert,
} from 'lucide-react'
import { ProductRoadmapList } from '../components/ProductRoadmapList'
import { ComplianceModuleChrome } from '../components/compliance/ComplianceModuleChrome'
import type { HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { PostingsStyleSurface } from '../components/tasks/tasksPostingsLayout'

export function OrgHealthSettings() {
  const hubItems: HubMenu1Item[] = useMemo(
    () => [
      { key: 'overview', label: 'Oversikt', icon: HeartPulse, active: false, to: '/org-health?tab=overview' },
      { key: 'surveys', label: 'Undersøkelser', icon: ClipboardCheck, active: false, to: '/org-health?tab=surveys' },
      { key: 'nav', label: 'Sykefravær (NAV)', icon: FileSpreadsheet, active: false, to: '/org-health?tab=nav' },
      { key: 'metrics', label: 'AML-indikatorer', icon: BarChart3, active: false, to: '/org-health?tab=metrics' },
      { key: 'reporting', label: 'Anonym rapportering', icon: ShieldAlert, active: false, to: '/org-health?tab=reporting' },
      { key: 'settings', label: 'Veikart', icon: BookMarked, active: true, to: '/org-health/settings' },
    ],
    [],
  )

  return (
    <ComplianceModuleChrome
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Samsvar', to: '/compliance' },
        { label: 'Organisasjonshelse', to: '/org-health' },
        { label: 'Veikart' },
      ]}
      title="Veikart og planer"
      description={
        <p className="max-w-2xl">
          Produktveikart for organisasjonshelse og tilgrensende moduler.{' '}
          <Link to="/org-health" className="font-medium text-[#1a3d32] underline">
            Tilbake til oversikt
          </Link>
          .
        </p>
      }
      hubAriaLabel="Organisasjonshelse — faner"
      hubItems={hubItems}
    >
      <PostingsStyleSurface className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[#1a3d32] text-[#c9a227]">
              <ListTree className="size-7" />
            </div>
            <div>
              <h2
                className="text-xl font-semibold text-neutral-900"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Veikart (produkt)
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Planlagte og fremtidige funksjoner for organisasjonshelse og relaterte moduler. Dette er en intern oversikt —
                prioriteringer kan endres.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-6">
          <ProductRoadmapList />

          <div className="mt-8 rounded-md border border-sky-200/80 bg-sky-50/50 p-4">
            <h3 className="text-sm font-semibold text-sky-950">Forslag til implementasjon og hvordan vi starter</h3>
            <p className="mt-2 text-sm text-sky-950/85">
              Felles mønster: nye tabeller org-scoped + RLS, tillatelsesnøkler i{' '}
              <code className="rounded-none bg-white/80 px-1 text-xs">permissionKeys</code>, tynn UI-fane eller side som
              leser/skriver via eksisterende hooks-mønster. Start med én vertikal «spike» som beviser hele kjeden (DB → policy
              → én skjerm).
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-sky-950/85">
              <li>
                <strong>Fase 1 — datagrunnlag og revisjonsspor:</strong> migrasjon med tabeller (
                <em>work_time_daily_facts</em> eller tilsvarende for webhook-inndata; <em>emergency_drills</em> med evaluering
                JSON; <em>contractor_invites</em> + <em>contractor_submissions</em>; <em>bht_org_access</em> + kobling til
                mapper/dokumenter). Ingen tredjeparts-API ennå — manuell CSV/API-test fra Postman.
              </li>
              <li>
                <strong>Fase 2 — automatisering:</strong> koble arbeidsflyt-motoren (allerede i plattformen) og Kanban for
                varsler; <code className="rounded-none bg-white/80 px-1 text-xs">pg_cron</code> for nattlig AML kap. 10-sjekk
                når faktatabell fylles.
              </li>
              <li>
                <strong>Fase 3 — integrasjoner:</strong> signert webhook (HMAC) fra lønn/HR-system; BHT-portal med
                invitasjonslenke (samme mønster som underleverandør); eventuelt Edge Function for e-postkvittering.
              </li>
            </ol>
            <p className="mt-3 text-sm text-sky-950/85">
              <strong>Anbefalt første steg denne uken:</strong> skisser datamodell + RLS for <em>beredskapsøvelser</em> (minst
              friksjon, tydelig IK-f § 5 nr. 6-bevis) og én enkel liste «Planlagt / gjennomført» under internkontroll —
              deretter gjenbruk mønsteret på BHT og entreprenører.
            </p>
          </div>

          <div className="mt-8 rounded-md border border-emerald-200/80 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <Globe className="size-5 shrink-0" />
              Bedriftsomtale — kort mål
            </div>
            <p className="mt-2 text-sm text-emerald-950/90">
              Én offentlig side der ansatte kan sende <strong>anonyme meldinger</strong>, lese om <strong>valg</strong> og{' '}
              <strong>arbeidsmiljøinformasjon</strong>, uten å se hele admin-fløyen. Kobles til eksisterende rapportering og
              representasjonsmoduler når teknisk klart.
            </p>
          </div>

          <p className="mt-6 flex items-start gap-2 text-xs text-neutral-500">
            <Shield className="mt-0.5 size-4 shrink-0" />
            Ikke juridisk rådgivning — tilpass rutiner og personvern mot egen DPA og internkontroll.
          </p>
        </div>
      </PostingsStyleSurface>
    </ComplianceModuleChrome>
  )
}
