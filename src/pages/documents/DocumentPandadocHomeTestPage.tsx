import { DocumentPandadocHomeTestWorkbench } from '../../components/documents/DocumentPandadocHomeTestWorkbench'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'

/** Route: `/documents/pandadoc-home-test` — PandaDoc-style home + tabbed table (mock). */
export function DocumentPandadocHomeTestPage() {
  return (
    <DocumentsModuleLayout>
      <DocumentPandadocHomeTestWorkbench />
    </DocumentsModuleLayout>
  )
}
