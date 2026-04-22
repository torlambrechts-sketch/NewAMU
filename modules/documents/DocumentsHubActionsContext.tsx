import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

type OpenNewFolderFn = () => void

const DocumentsHubActionsContext = createContext<{
  setOpenNewFolderHandler: (fn: OpenNewFolderFn | null) => void
  requestOpenNewFolder: () => void
} | null>(null)

export function DocumentsHubActionsProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<OpenNewFolderFn | null>(null)

  const setOpenNewFolderHandler = useCallback((fn: OpenNewFolderFn | null) => {
    handlerRef.current = fn
  }, [])

  const requestOpenNewFolder = useCallback(() => {
    handlerRef.current?.()
  }, [])

  const value = useMemo(
    () => ({ setOpenNewFolderHandler, requestOpenNewFolder }),
    [setOpenNewFolderHandler, requestOpenNewFolder],
  )

  return <DocumentsHubActionsContext.Provider value={value}>{children}</DocumentsHubActionsContext.Provider>
}

export function useDocumentsHubActionsRegister(onOpen: () => void) {
  const ctx = useContext(DocumentsHubActionsContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setOpenNewFolderHandler(onOpen)
    return () => ctx.setOpenNewFolderHandler(null)
  }, [ctx, onOpen])
}

export function useDocumentsHubActions() {
  const ctx = useContext(DocumentsHubActionsContext)
  if (!ctx) {
    return { requestOpenNewFolder: () => {} }
  }
  return { requestOpenNewFolder: ctx.requestOpenNewFolder }
}
