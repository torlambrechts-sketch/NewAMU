// Settings-hub wrapper for the Documents "Arbeidsflyt" tab. The previous
// inline editor was replaced with a deep-link to the central
// Automatisering hub at /workflow — module rules are administered
// from one canonical surface, not duplicated per scope.

import { GitBranch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'

export default function DocumentsScopeArbeidsflyt() {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-[#1a3d32]" />
        <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt for dokumenter</h2>
      </div>
      <p className="mb-1 text-sm text-neutral-600">
        Automatiske regler for denne modulen administreres sentralt. Klikk under for å
        åpne arbeidsflyt-byggeren med filtrene satt.
      </p>
      <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
        <strong className="text-neutral-800">Aktuelle lovkrav:</strong>{' '}
        IK-f §5 nr. 5 (årsgjennomgang) · AML §3-2 (opplæring og informasjon) ·
        Internkontrollforskriften §5 nr. 7 (oppdaterte prosedyrer).
      </div>
      <Link to="/workflow?source_module=documents">
        <Button variant="primary">Åpne arbeidsflyt for dokumenter</Button>
      </Link>
    </ModuleSectionCard>
  )
}
