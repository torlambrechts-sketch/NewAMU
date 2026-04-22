import { DocumentsModuleLayout } from '../../src/components/documents/DocumentsModuleLayout'
import { DocumentsScorecardBrowser } from './DocumentsScorecardBrowser'

/** Temporary route body for `/documents/scorecard-browser` — scorecard-style library UI (layout-reference). */
export function DocumentsScorecardTestPage() {
  return (
    <DocumentsModuleLayout>
      <p className="text-sm text-neutral-600">
        Eksperimentvisning: mapper og dokumenter gruppert per kategori, med layout inspirert av layout-referansen
        (scorecard). Navigasjon og data er ekte; denne ruten kan fjernes når hub er migrert.
      </p>
      <div className="mt-6">
        <DocumentsScorecardBrowser />
      </div>
    </DocumentsModuleLayout>
  )
}
