import { DocumentKandidatdetaljLayoutWorkbench } from '../../components/documents/DocumentKandidatdetaljLayoutWorkbench'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'

/** Route: `/documents/kandidatdetalj-layout-test` — mapper venstre / sider høyre (layout-reference). */
export function DocumentKandidatdetaljLayoutTestPage() {
  return (
    <DocumentsModuleLayout>
      <DocumentKandidatdetaljLayoutWorkbench />
    </DocumentsModuleLayout>
  )
}
