import { Navigate, useParams } from 'react-router-dom'

/** Default document editor is the TipTap reference editor (`/documents/page/:id/reference-edit`). */
export function WikiPageEditRedirect() {
  const { pageId } = useParams<{ pageId: string }>()
  if (!pageId) return <Navigate to="/documents" replace />
  return <Navigate to={`/documents/page/${pageId}/reference-edit`} replace />
}
