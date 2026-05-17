// Settings-hub wrapper for the Møter "Arbeidsflyt" tab. The previous
// inline editor was replaced with a deep-link to the central
// Automatisering hub at /workflow — module rules are administered
// from one canonical surface, not duplicated per scope.

import { GitBranch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Button } from '../../components/ui/Button'

export default function MeetingsScopeArbeidsflyt() {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-[#1a3d32]" />
        <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt for møter</h2>
      </div>
      <p className="mb-4 text-sm text-neutral-600">
        Automatiske regler for denne modulen administreres sentralt. Klikk under for å
        åpne arbeidsflyt-byggeren med filtrene satt.
      </p>
      <Link to="/workflow?source_module=meetings">
        <Button variant="primary">Åpne arbeidsflyt for møter</Button>
      </Link>
    </ModuleSectionCard>
  )
}
