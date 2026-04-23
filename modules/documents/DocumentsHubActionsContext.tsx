/* eslint-disable react-refresh/only-export-components -- context module exports provider + hooks */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

type VoidFn = () => void

const DocumentsHubActionsContext = createContext<{
  setOpenNewFolderHandler: (fn: VoidFn | null) => void
  setNewDocumentHandler: (fn: VoidFn | null) => void
  requestOpenNewFolder: () => void
  requestNewDocument: () => void
} | null>(null)

export function DocumentsHubActionsProvider({ children }: { children: ReactNode }) {
  const folderHandlerRef = useRef<VoidFn | null>(null)
  const documentHandlerRef = useRef<VoidFn | null>(null)

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
      requestOpenNewFolder,
      requestNewDocument,
    }),
    [setOpenNewFolderHandler, setNewDocumentHandler, requestOpenNewFolder, requestNewDocument],
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
    return { requestOpenNewFolder: () => {}, requestNewDocument: () => {} }
  }
  return { requestOpenNewFolder: ctx.requestOpenNewFolder, requestNewDocument: ctx.requestNewDocument }
}
