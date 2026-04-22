import { createContext, useContext, type ReactNode } from 'react'

const DocumentsShellEmbeddedContext = createContext(false)

export function DocumentsShellEmbeddedProvider({ children }: { children: ReactNode }) {
  return <DocumentsShellEmbeddedContext.Provider value={true}>{children}</DocumentsShellEmbeddedContext.Provider>
}

/** True when the route renders inside `DocumentsModuleShellLayout` (ModulePageShell owns chrome). */
export function useDocumentsShellEmbedded(): boolean {
  return useContext(DocumentsShellEmbeddedContext)
}
