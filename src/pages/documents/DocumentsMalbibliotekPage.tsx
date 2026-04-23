import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { ModuleDocumentsKandidatdetaljHub } from '../../components/module/ModuleDocumentsKandidatdetaljHub'
import { WarningBox } from '../../components/ui/AlertBox'
import { useDocuments } from '../../hooks/useDocuments'

/** Route: `/documents/malbibliotek` — malbibliotek i samme hub-ramme som oversikt (`ModuleDocumentsKandidatdetaljHub`). */
export function DocumentsMalbibliotekPage() {
  const docs = useDocuments()

  return (
    <DocumentsModuleLayout>
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}
      <ModuleDocumentsKandidatdetaljHub variant="home" showIntro centerContent="templates" />
    </DocumentsModuleLayout>
  )
}
