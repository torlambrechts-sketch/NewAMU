import { DocumentEditorWorkbench } from '../../components/documents/DocumentEditorWorkbench'

/** Route: `/documents/editor-test` — isolated UI prototype for the document module (no persistence). */
export function DocumentEditorTestPage() {
  return <DocumentEditorWorkbench showHeader={false} />
}
