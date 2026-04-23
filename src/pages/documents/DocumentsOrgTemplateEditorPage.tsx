import { useNavigate, useParams } from 'react-router-dom'
import { DocumentEditorWorkbench } from '../../components/documents/DocumentEditorWorkbench'

/**
 * Rediger organisasjonsmal i samme TipTap-redaktør som wiki-sider (`persistTarget="org_template"`).
 * Rute: `/documents/templates/org/:templateId/edit`
 */
export function DocumentsOrgTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()

  if (!templateId) {
    return <p className="text-sm text-neutral-600">Mangler mal-ID.</p>
  }

  return (
    <DocumentEditorWorkbench
      mode="persist"
      persistTarget="org_template"
      orgTemplateId={templateId}
      showHeader={false}
      onExit={() => navigate('/documents/malbibliotek')}
    />
  )
}
