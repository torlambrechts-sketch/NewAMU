import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'

export function DocumentNew() {
  const navigate = useNavigate()
  const { createBlank } = useDocumentCenter()

  useEffect(() => {
    const d = createBlank()
    if (d) navigate(`/documents/${d.id}`, { replace: true })
  }, [createBlank, navigate])

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600">
      Oppretter dokument…
    </div>
  )
}
