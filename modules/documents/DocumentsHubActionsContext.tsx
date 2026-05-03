/* eslint-disable react-refresh/only-export-components -- context module exports provider + hooks */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

type VoidFn = () => void

const DocumentsHubActionsContext = createContext<{
  setOpenNewFolderHandler: (fn: VoidFn | null) => void
  setNewDocumentHandler: (fn: VoidFn | null) => void
  setNewTemplateHandler: (fn: VoidFn | null) => void
  requestOpenNewFolder: () => void
  requestNewDocument: () => void
  requestNewTemplate: () => void
} | null>(null)

export function DocumentsHubActionsProvider({ children }: { children: ReactNode }) {
  const folderHandlerRef = useRef<VoidFn | null>(null)
  const documentHandlerRef = useRef<VoidFn | null>(null)
  const templateHandlerRef = useRef<VoidFn | null>(null)

  const setOpenNewFolderHandler = useCallback((fn: VoidFn | null) => { folderHandlerRef.current = fn }, [])
  const setNewDocumentHandler = useCallback((fn: VoidFn | null) => { documentHandlerRef.current = fn }, [])
  const setNewTemplateHandler = useCallback((fn: VoidFn | null) => { templateHandlerRef.current = fn }, [])

  const requestOpenNewFolder = useCallback(() => { folderHandlerRef.current?.() }, [])
  const requestNewDocument = useCallback(() => { documentHandlerRef.current?.() }, [])
  const requestNewTemplate = useCallback(() => { templateHandlerRef.current?.() }, [])

  const value = useMemo(
    () => ({
      setOpenNewFolderHandler,
      setNewDocumentHandler,
      setNewTemplateHandler,
      requestOpenNewFolder,
      requestNewDocument,
      requestNewTemplate,
    }),
    [setOpenNewFolderHandler, setNewDocumentHandler, setNewTemplateHandler, requestOpenNewFolder, requestNewDocument, requestNewTemplate],
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

export function useDocumentsHubNewTemplateRegister(onNewTemplate: () => void, enabled = true) {
  const ctx = useContext(DocumentsHubActionsContext)
  useEffect(() => {
    if (!ctx) return
    if (!enabled) {
      ctx.setNewTemplateHandler(null)
      return () => ctx.setNewTemplateHandler(null)
    }
    ctx.setNewTemplateHandler(onNewTemplate)
    return () => ctx.setNewTemplateHandler(null)
  }, [ctx, onNewTemplate, enabled])
}

export function useDocumentsHubActions() {
  const ctx = useContext(DocumentsHubActionsContext)
  if (!ctx) {
    return { requestOpenNewFolder: () => {}, requestNewDocument: () => {}, requestNewTemplate: () => {} }
  }
  return {
    requestOpenNewFolder: ctx.requestOpenNewFolder,
    requestNewDocument: ctx.requestNewDocument,
    requestNewTemplate: ctx.requestNewTemplate,
  }
}
