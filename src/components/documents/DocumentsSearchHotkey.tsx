import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DocumentSearchModal } from './DocumentSearchModal'

/** Cmd/Ctrl+K document search while URL is under `/documents`. */
export function DocumentsSearchHotkey() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const inDocuments = location.pathname === '/documents' || location.pathname.startsWith('/documents/')

  useEffect(() => {
    if (!inDocuments) {
      queueMicrotask(() => setOpen(false))
      return
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inDocuments])

  if (!inDocuments) return null

  return <DocumentSearchModal open={open} onClose={() => setOpen(false)} />
}
