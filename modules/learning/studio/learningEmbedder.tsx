// Learning embedder — Studio Builder Phase 2a Task 2a.1.

import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../src/components/ui/Button'
import { LearningCoursesList } from '../../../src/pages/learning/LearningCoursesList'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import { GenericRowBuilder } from '../../../src/components/studio/shell/GenericRowBuilder'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function LearningEmbedder({ mode }: EmbedderProps) {
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
            ← Tilbake til kurs-liste
          </Button>
        </div>
        <GenericRowBuilder
          rowTable="learning_courses"
          rowId={templateId}
          scopeId="learning"
          titlePrefix="Kurs · "
          titleColumn="title"
          subtitleHint="Metadata, lovreferanser og målgruppe — full modul-redigering på /learning/admin"
          fields={[
            { column: 'description', label: 'Beskrivelse', kind: 'textarea' },
            { column: 'metadata_schema', label: 'Metadata-schema (JSON)', kind: 'json' },
            { column: 'law_refs', label: 'Lovreferanser (JSON)', kind: 'json' },
          ]}
          propertyFields={[
            { column: 'title', label: 'Tittel', kind: 'text' },
            { column: 'status', label: 'Status', kind: 'text' },
          ]}
        />
      </div>
    )
  }

  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="learning" />
      <ScopeListShell
        title="Læring og kurs"
        subtitle="Kurs-oversikt — klikk for å åpne i kurs-bygger"
        bare
      >
        <LearningCoursesList />
      </ScopeListShell>
    </div>
  )
}
