import { ModuleDocumentsKandidatdetaljHub } from '../../components/module/ModuleDocumentsKandidatdetaljHub'
import { WarningBox } from '../../components/ui/AlertBox'
import { useDocuments } from '../../hooks/useDocuments'

/** Route: `/documents/malbibliotek` — malbibliotek med mapper i kategorien «Malbibliotek». */
export function DocumentsMalbibliotekPage() {
  const docs = useDocuments()

  return (
    <>
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}
      <ModuleDocumentsKandidatdetaljHub variant="home" showIntro={false} centerContent="templates" />
    </>
  )
}
