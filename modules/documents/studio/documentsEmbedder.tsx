// Documents embedder — Studio Builder Phase 2a Task 2a.1.
//
// Wraps the existing DocumentTemplatesSettings page inline in the
// studio shell. The page already covers the list-templates + edit-via-
// slide-panel surface plus the metadata-schema editor, so the adapter
// is a thin host.
//
// Note: the heavy TipTap-based DocumentEditorWorkbench is for editing
// page content (1,231 LoC). Studio's authoring focus is on templates,
// not page bodies — clicking a document opens the workbench in its own
// route /documents/:id, kept outside the studio shell on purpose.

import { DocumentTemplatesSettings } from '../../../src/pages/documents/DocumentTemplatesSettings'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function DocumentsEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="documents" />
      <DocumentTemplatesSettings />
    </div>
  )
}
