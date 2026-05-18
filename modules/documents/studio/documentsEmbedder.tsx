// Documents embedder — Studio Builder Phase 2a Task 2a.1.
//
// Modes:
//   ?template=<id> → GenericRowBuilder canvas for document_org_templates
//   default        → DocumentTemplatesSettings list view

import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../src/components/ui/Button'
import { DocumentTemplatesSettings } from '../../../src/pages/documents/DocumentTemplatesSettings'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import { GenericRowBuilder } from '../../../src/components/studio/shell/GenericRowBuilder'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function DocumentsEmbedder({ mode }: EmbedderProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const templateId = searchParams.get('template')

  if (templateId) {
    return (
      <div data-studio-mode={mode}>
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('template')
              setSearchParams(next, { replace: true })
            }}
          >
            ← Tilbake til dokument-maler
          </Button>
        </div>
        <GenericRowBuilder
          rowTable="document_org_templates"
          rowId={templateId}
          scopeId="documents"
          titlePrefix="Dokument-mal · "
          titleColumn="label"
          subtitleHint="Side-innhold (page_payload) + kategori + hjemmel"
          fields={[
            { column: 'page_payload', label: 'Side-innhold (JSON)', kind: 'json' },
            { column: 'description', label: 'Beskrivelse', kind: 'textarea' },
          ]}
          propertyFields={[
            { column: 'label', label: 'Tittel', kind: 'text' },
            { column: 'category', label: 'Kategori', kind: 'text' },
          ]}
        />
      </div>
    )
  }

  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="documents" />
      <ScopeListShell
        title="Dokumenter"
        subtitle="Policy, instrukser, prosedyrer og acknowledgement-flyter"
        bare
      >
        <DocumentTemplatesSettings />
      </ScopeListShell>
    </div>
  )
}
