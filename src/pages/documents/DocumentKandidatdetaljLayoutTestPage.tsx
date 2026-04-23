import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { ModuleDocumentsKandidatdetaljHub } from '../../components/module/ModuleDocumentsKandidatdetaljHub'

/** Route: `/documents/kandidatdetalj-layout-test` — same hub as oversikt, demo breadcrumb. */
export function DocumentKandidatdetaljLayoutTestPage() {
  return (
    <DocumentsModuleLayout>
      <ModuleDocumentsKandidatdetaljHub variant="demo" showIntro />
    </DocumentsModuleLayout>
  )
}
