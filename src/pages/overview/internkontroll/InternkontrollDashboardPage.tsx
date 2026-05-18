// /overview/internkontroll — locked Compliance Dashboard for internkontroll.
//
// Embed-only wrapper around <SystemReport id="internkontroll-compliance-dashboard" />.
// Layout is code-owned (seeded via migration, is_system=true) so every
// tenant sees the same KPI strip + framework coverage bar + evidence
// table — comparable across orgs for tilsynsbevis. The companion
// /overview/internkontroll/gaps page is the drill-down lens.

import { SystemReport } from '../../../lib/dashboards/SystemReport'

const BREADCRUMB = [
  { label: 'Arbeidsflate', to: '/' },
  { label: 'Oversikt', to: '/overview/hms' },
  { label: 'Internkontroll' },
]

export function InternkontrollDashboardPage() {
  return <SystemReport id="internkontroll-compliance-dashboard" breadcrumb={BREADCRUMB} />
}
