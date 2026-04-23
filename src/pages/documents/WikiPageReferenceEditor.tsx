import { useNavigate, useParams } from 'react-router-dom'
import { DocumentEditorWorkbench } from '../../components/documents/DocumentEditorWorkbench'

/**
 * TipTap «referanse»-redigering for wiki-sider (samme UI som `/documents/editor-test`), med lagring til første tekstblokk.
 * Rute: `/documents/page/:pageId/reference-edit` (under {@link DocumentsModuleShellLayout}).
 */
export function WikiPageReferenceEditor() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()

  if (!pageId) {
    return <p className="text-sm text-neutral-600">Mangler side-ID.</p>
  }

  return (
    <DocumentEditorWorkbench mode="persist" pageId={pageId} showHeader={false} onExit={() => navigate('/documents')} />
  )
}
