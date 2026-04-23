import { DocumentEditorWorkbench } from '../../components/documents/DocumentEditorWorkbench'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'

/** Route: `/documents/editor-test` — isolated UI prototype for the document module (no persistence). */
export function DocumentEditorTestPage() {
  return (
    <DocumentsModuleLayout>
      <DocumentEditorWorkbench />
    </DocumentsModuleLayout>
  )
}
