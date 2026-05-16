// RiskRegisterPage — P1 stub for the future risk register list page.
//
// The /risk/register route exists so sidebar links resolve and the
// scorecard drill-down (drillDimensionId='riskId') has a sensible
// landing surface. In P2 this becomes a real list reading from
// `risk_register_unified_v` with row-level deeplinks back into the
// source module (compliance, tasks, deviations, ...).

import { Link } from 'react-router-dom'
import { ArrowLeft, ListChecks } from 'lucide-react'

export function RiskRegisterPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/risk/analyse"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake til risikoanalyse
        </Link>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <ListChecks className="h-6 w-6 text-rose-700" aria-hidden />
          <h1 className="text-2xl font-semibold text-neutral-900">Risikoregister</h1>
        </div>
        <p className="mb-4 text-neutral-600">
          En samlet liste over alle aktive risikoer på tvers av sjekklister,
          avvik, vernerunder og varslinger kommer i neste leveranse. I dag
          finner du visualiseringen og topp 10-rapporten på{' '}
          <Link to="/risk/analyse" className="font-medium text-rose-700 underline">
            risikoanalyse-siden
          </Link>
          .
        </p>
        <p className="text-sm text-neutral-500">
          Når registeret er på plass vil hver rad lenke tilbake til kilden
          (sjekklisteutførelse, oppgave, vernerunde) slik Arbeidstilsynet ber
          om: ROS, handlingsplan, frister, ansvar — i én visning.
        </p>
      </div>
    </div>
  )
}
