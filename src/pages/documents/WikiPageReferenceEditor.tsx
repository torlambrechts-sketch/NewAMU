import { useNavigate, useParams } from 'react-router-dom'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DocumentEditorWorkbench } from '../../components/documents/DocumentEditorWorkbench'

/**
 * TipTap «referanse»-redigering for wiki-sider (samme UI som `/documents/editor-test`), med lagring til første tekstblokk.
 * Rute: `/documents/page/:pageId/reference-edit`.
 */
export function WikiPageReferenceEditor() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()

  if (!pageId) {
    return (
      <DocumentsModuleLayout>
        <p className="text-sm text-neutral-600">Mangler side-ID.</p>
      </DocumentsModuleLayout>
    )
  }

  return (
    <DocumentsModuleLayout>
      <DocumentEditorWorkbench
        mode="persist"
        pageId={pageId}
        onExit={() => navigate('/documents')}
      />
    </DocumentsModuleLayout>
  )
}
