// /overview/internkontroll/gaps — locked Gap Analysis page for internkontroll.
//
// Embed-only wrapper around <SystemReport id="internkontroll-gap-analysis" />.
// Renders the paragraphs × 5 modules heatmap with cell drill-down per
// framework. Layout is code-owned (seeded via migration, is_system=true).

import { SystemReport } from '../../../lib/dashboards/SystemReport'

const BREADCRUMB = [
  { label: 'Arbeidsflate', to: '/' },
  { label: 'Oversikt', to: '/overview/hms' },
  { label: 'Internkontroll', to: '/overview/internkontroll' },
  { label: 'Gap-analyse' },
]

export function InternkontrollGapPage() {
  return <SystemReport id="internkontroll-gap-analysis" breadcrumb={BREADCRUMB} />
}
