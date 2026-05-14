// /overview/regelverk — locked tilsynsbevis-visning av regelverk-dekning.
//
// Embed-only wrapper rundt <SystemReport id="regelverk-coverage-overview" />.
// Layouten er kodeforvaltet (seedet via migrasjon, is_system=true) slik at
// alle tenants ser samme rapport — sammenlignbar på tvers av tilsyn.
//
// Den redigerbare varianten finnes fortsatt som RegelverkCoverageDashboardPage
// (samme scope), men er ikke rutet inn på denne URL-en. Når en redigerbar
// per-org-layout trengs, kan vi legge til /overview/regelverk/edit eller en
// «Tilpass»-knapp i headeren her.

import { SystemReport } from '../../../lib/dashboards/SystemReport'

const BREADCRUMB = [
  { label: 'Arbeidsflate', to: '/' },
  { label: 'Oversikt', to: '/overview/hms' },
  { label: 'Regelverk-dekning' },
]

export function RegelverkCoveragePage() {
  return <SystemReport id="regelverk-coverage-overview" breadcrumb={BREADCRUMB} />
}
