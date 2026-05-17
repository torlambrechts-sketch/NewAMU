// ArbeidsflytTab — deep-link to the central Automatisering hub for
// compliance-checklist workflow rules. The previous inline editor
// was replaced so module rules live in one canonical surface
// (/workflow) instead of being duplicated per scope.

import { GitBranch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../../src/components/module'
import { Button } from '../../../src/components/ui/Button'

export function ArbeidsflytTab() {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-[#1a3d32]" />
        <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt for sjekklister</h2>
      </div>
      <p className="mb-4 text-sm text-neutral-600">
        Automatiske regler for denne modulen administreres sentralt. Klikk under for å
        åpne arbeidsflyt-byggeren med filtrene satt.
      </p>
      <Link to="/workflow?source_module=compliance_checklist">
        <Button variant="primary">Åpne arbeidsflyt for sjekklister</Button>
      </Link>
    </ModuleSectionCard>
  )
}
