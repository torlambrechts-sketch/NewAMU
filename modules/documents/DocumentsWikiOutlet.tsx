import { Outlet } from 'react-router-dom'
import { DocumentsSearchHotkey } from '../../src/components/documents/DocumentsSearchHotkey'
import { DocumentsShellEmbeddedProvider } from './DocumentsShellContext'

/**
 * Wiki / space / editor routes render their own `ModulePageShell` (UI_PLACEMENT_RULES §1).
 * This parent only provides embedded context for `DocumentsModuleLayout` body-only mode.
 */
export function DocumentsWikiOutlet() {
  return (
    <DocumentsShellEmbeddedProvider>
      <DocumentsSearchHotkey />
      <Outlet />
    </DocumentsShellEmbeddedProvider>
  )
}
