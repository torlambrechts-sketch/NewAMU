// Benchmarking-side — anonymisert sammenligning mot bransje-peers.
//
// Bygger på `public.get_my_org_benchmark()` RPC-en og widgetkomponenten
// `<BenchmarkWidget>`. All data er aggregert per NACE2 + størrelses-bånd
// med k-anonymitet=5 håndhevet i kilde-tabellen (`benchmark_metric_snapshots`),
// så ingen rad-nivå tilgang på tvers av tenants er mulig.

import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, ShieldCheck } from 'lucide-react'
import { BenchmarkWidget, type BenchmarkMetricKey } from '../../components/dashboards/BenchmarkWidget'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type BenchmarkSpec = {
  metric: BenchmarkMetricKey
  label: string
  valueLabel: string
  goalDirection: 'increase' | 'decrease'
}

const METRICS: BenchmarkSpec[] = [
  {
    metric: 'findings_critical_per_org',
    label: 'Kritiske funn fra vernerunder',
    valueLabel: 'Antall siste 90 dager',
    goalDirection: 'decrease',
  },
  {
    metric: 'vernerunder_per_quarter',
    label: 'Signerte vernerunder per kvartal',
    valueLabel: 'Antall i inneværende kvartal',
    goalDirection: 'increase',
  },
  {
    metric: 'overdue_actions_pct',
    label: 'Andel oppgaver over frist',
    valueLabel: 'Forfalt av aktive oppgaver',
    goalDirection: 'decrease',
  },
  {
    metric: 'course_certificates_per_employee',
    label: 'Kursbevis per ansatt',
    valueLabel: 'Siste 12 måneder, per FTE',
    goalDirection: 'increase',
  },
  {
    metric: 'sjekkliste_completion_pct',
    label: 'Sjekkliste-fullføringsgrad',
    valueLabel: 'Signerte av planlagte (siste 90 dager)',
    goalDirection: 'increase',
  },
]

export function BenchmarkPage() {
  const ctx = useOrgSetupContext()
  const orgId = ctx.organization?.id ?? null

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/overview/hms"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Til HMS-oversikt
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
            <BarChart3 className="h-6 w-6 text-indigo-700" />
            Benchmarking
          </h1>
        </div>
      </div>

      {/* Privacy-banner — vises alltid på topp; informerer brukeren om
          k-anonymitet og hvorfor de aldri ser andre virksomheter direkte. */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" aria-hidden />
        <div>
          <p className="font-semibold">Personvern og anonymitet</p>
          <p className="mt-1 leading-relaxed">
            Alle data er anonymisert og aggregert per NACE-kode og virksomhetsstørrelse.
            Vi viser kun data der minst 5 virksomheter bidrar (k-anonymitet=5).
            Du kan aldri se andre virksomheter individuelt.
          </p>
          <p className="mt-1 text-xs text-indigo-800/80">
            Behandlingsgrunnlag: GDPR Art. 89 (statistikkformål) · Art. 5(1)(c) dataminimering.
          </p>
        </div>
      </div>

      {!orgId ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Logg inn på en organisasjon for å se benchmark-data.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {METRICS.map((spec) => (
            <BenchmarkWidget
              key={spec.metric}
              orgId={orgId}
              metric={spec.metric}
              label={spec.label}
              valueLabel={spec.valueLabel}
              goalDirection={spec.goalDirection}
            />
          ))}
        </div>
      )}
    </div>
  )
}
