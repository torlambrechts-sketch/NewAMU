/* eslint-disable react-refresh/only-export-components -- context module exports provider + hooks */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type VoidFn = () => void

export type DocumentsHubShellCapabilities = {
  /** Show «Nytt dokument» in module shell when on /documents hub */
  canNewDocument: boolean
  /** Show «Ny mappe» in module shell when on /documents hub */
  canNewFolder: boolean
}

const DocumentsHubActionsContext = createContext<{
  setOpenNewFolderHandler: (fn: VoidFn | null) => void
  setNewDocumentHandler: (fn: VoidFn | null) => void
  setShellCapabilities: (caps: DocumentsHubShellCapabilities | null) => void
  shellCapabilities: DocumentsHubShellCapabilities | null
  requestOpenNewFolder: () => void
  requestNewDocument: () => void
} | null>(null)

export function DocumentsHubActionsProvider({ children }: { children: ReactNode }) {
  const folderHandlerRef = useRef<VoidFn | null>(null)
  const documentHandlerRef = useRef<VoidFn | null>(null)
  const [shellCapabilities, setShellCapabilities] = useState<DocumentsHubShellCapabilities | null>(null)

  const setOpenNewFolderHandler = useCallback((fn: VoidFn | null) => {
    folderHandlerRef.current = fn
  }, [])

  const setNewDocumentHandler = useCallback((fn: VoidFn | null) => {
    documentHandlerRef.current = fn
  }, [])

  const requestOpenNewFolder = useCallback(() => {
    folderHandlerRef.current?.()
  }, [])

  const requestNewDocument = useCallback(() => {
    documentHandlerRef.current?.()
  }, [])

  const value = useMemo(
    () => ({
      setOpenNewFolderHandler,
      setNewDocumentHandler,
      setShellCapabilities,
      shellCapabilities,
      requestOpenNewFolder,
      requestNewDocument,
    }),
    [setOpenNewFolderHandler, setNewDocumentHandler, shellCapabilities, requestOpenNewFolder, requestNewDocument],
  )

  return <DocumentsHubActionsContext.Provider value={value}>{children}</DocumentsHubActionsContext.Provider>
}

export function useDocumentsHubActionsRegister(onOpenNewFolder: () => void) {
  const ctx = useContext(DocumentsHubActionsContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setOpenNewFolderHandler(onOpenNewFolder)
    return () => ctx.setOpenNewFolderHandler(null)
  }, [ctx, onOpenNewFolder])
}

export function useDocumentsHubShellCapabilitiesRegister(caps: DocumentsHubShellCapabilities | null) {
  const ctx = useContext(DocumentsHubActionsContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setShellCapabilities(caps)
    return () => ctx.setShellCapabilities(null)
  }, [ctx, caps])
}

export function useDocumentsHubNewDocumentRegister(onNewDocument: () => void, enabled = true) {
  const ctx = useContext(DocumentsHubActionsContext)
  useEffect(() => {
    if (!ctx) return
    if (!enabled) {
      ctx.setNewDocumentHandler(null)
      return () => ctx.setNewDocumentHandler(null)
    }
    ctx.setNewDocumentHandler(onNewDocument)
    return () => ctx.setNewDocumentHandler(null)
  }, [ctx, onNewDocument, enabled])
}

export function useDocumentsHubActions() {
  const ctx = useContext(DocumentsHubActionsContext)
  if (!ctx) {
    return {
      requestOpenNewFolder: () => {},
      requestNewDocument: () => {},
      shellCapabilities: null as DocumentsHubShellCapabilities | null,
    }
  }
  return {
    requestOpenNewFolder: ctx.requestOpenNewFolder,
    requestNewDocument: ctx.requestNewDocument,
    shellCapabilities: ctx.shellCapabilities,
  }
}
