// Registers embedder — Studio Builder Phase 2a Task 2a.1.

import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../src/components/ui/Button'
import RegistersScopeTyper from '../../../src/pages/registers/RegistersScopeTyper'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import { GenericRowBuilder } from '../../../src/components/studio/shell/GenericRowBuilder'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function RegistersEmbedder({ mode }: EmbedderProps) {
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
            ← Tilbake til register-typer
          </Button>
        </div>
        <GenericRowBuilder
          rowTable="register_types"
          rowId={templateId}
          scopeId="registers"
          titlePrefix="Register-type · "
          titleColumn="name"
          subtitleHint="Felt-schema (JSON), rammeverk og kadens"
          fields={[
            { column: 'metadata_schema', label: 'Felt-schema (JSON)', kind: 'json' },
            { column: 'description', label: 'Beskrivelse', kind: 'textarea' },
          ]}
          propertyFields={[
            { column: 'name', label: 'Navn', kind: 'text' },
            { column: 'is_active', label: 'Aktiv', kind: 'boolean' },
            { column: 'default_review_cadence_months', label: 'Gjennomgangs-kadens (mnd)', kind: 'text' },
          ]}
        />
      </div>
    )
  }

  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="registers" />
      <ScopeListShell
        title="Register"
        subtitle="AML / GDPR / ISO register-typer + felt-schema"
        bare
      >
        <RegistersScopeTyper />
      </ScopeListShell>
    </div>
  )
}
