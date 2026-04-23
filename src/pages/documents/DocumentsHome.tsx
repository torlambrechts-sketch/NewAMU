import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useDocuments } from '../../hooks/useDocuments'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DOCUMENTS_HUB_SECTION_IDS } from '../../components/documents/documentsHubSectionIds'
import { ModuleDocumentsKandidatdetaljHub } from '../../components/module/ModuleDocumentsKandidatdetaljHub'
import { WarningBox } from '../../components/ui/AlertBox'

/**
 * Dokumenter **Oversikt** — standard hub med {@link ModuleDocumentsKandidatdetaljHub}.
 * Malbibliotek: egen rute `/documents/malbibliotek` (samme hub-komponent).
 */
export function DocumentsHome() {
  const docs = useDocuments()
  const location = useLocation()

  useEffect(() => {
    const raw = location.hash.replace(/^#/, '')
    if (!raw || raw !== DOCUMENTS_HUB_SECTION_IDS.mapper) return
    queueMicrotask(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.hash])

  return (
    <DocumentsModuleLayout>
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <div id={DOCUMENTS_HUB_SECTION_IDS.mapper} className="scroll-mt-6">
        <ModuleDocumentsKandidatdetaljHub variant="home" showIntro centerContent="pages" />
      </div>
    </DocumentsModuleLayout>
  )
}
