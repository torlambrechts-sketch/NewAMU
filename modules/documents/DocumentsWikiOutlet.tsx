import { Outlet } from 'react-router-dom'
import { DocumentsShellEmbeddedProvider } from './DocumentsShellContext'

/**
 * Wiki / space / editor routes render their own `ModulePageShell` (UI_PLACEMENT_RULES §1).
 * This parent only provides embedded context for `DocumentsModuleLayout` body-only mode.
 */
export function DocumentsWikiOutlet() {
  return (
    <DocumentsShellEmbeddedProvider>
      <Outlet />
    </DocumentsShellEmbeddedProvider>
  )
}
