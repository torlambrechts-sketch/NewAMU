// Meetings embedder — Studio Builder Phase 2a Task 2a.1.

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { MeetingsTemplateEditorPanel } from '../../../src/pages/meetings/MeetingsTemplateEditorPanel'
import { Button } from '../../../src/components/ui/Button'
import { useMeetings } from '../useMeetings'
import type { MeetingOrgTemplateRow } from '../types'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import { GenericRowBuilder } from '../../../src/components/studio/shell/GenericRowBuilder'

type EditorState =
  | { kind: 'idle' }
  | { kind: 'open'; editTarget: MeetingOrgTemplateRow | null }

export default function MeetingsEmbedder({ mode }: EmbedderProps) {
  const meetings = useMeetings()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editor, setEditor] = useState<EditorState>({ kind: 'idle' })

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
            ← Tilbake til møte-maler
          </Button>
        </div>
        <GenericRowBuilder
          rowTable="meeting_org_templates"
          rowId={templateId}
          scopeId="meetings"
          titlePrefix="Møte-mal · "
          titleColumn="name"
          subtitleHint="Agenda + lovreferanser. Full slide-panel-editor på Møter → Innstillinger."
          fields={[
            { column: 'definition', label: 'Definisjon (JSON)', kind: 'json' },
            { column: 'description', label: 'Beskrivelse', kind: 'textarea' },
            { column: 'metadata_schema', label: 'Metadata-schema (JSON)', kind: 'json' },
          ]}
          propertyFields={[
            { column: 'name', label: 'Navn', kind: 'text' },
            { column: 'framework', label: 'Rammeverk', kind: 'text' },
            { column: 'cadence_hint', label: 'Kadens', kind: 'text' },
            { column: 'is_active', label: 'Aktiv', kind: 'boolean' },
          ]}
        />
      </div>
    )
  }

  const orgTemplates = meetings.orgTemplates ?? []

  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="meetings" />
      <ScopeListShell
        title="Møter"
        subtitle="Egendefinerte møte-maler — AMU, drøftingsmøter, ledersjekk"
        headerActions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setEditor({ kind: 'open', editTarget: null })}
          >
            <Plus className="h-3.5 w-3.5" /> Ny mal
          </Button>
        }
      >
        {meetings.loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster maler…
          </div>
        ) : orgTemplates.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
            Ingen egne maler. Klon en system-mal fra panelet over eller klikk «Ny mal».
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {orgTemplates.map((t) => (
              <li key={t.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start py-3 font-normal"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.set('template', t.id)
                    setSearchParams(next, { replace: true })
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">{t.name}</p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {t.slug} · {t.framework ?? 'INTERNAL'}{t.cadence_hint ? ` · ${t.cadence_hint}` : ''}
                      </p>
                    </div>
                  </div>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScopeListShell>

      <MeetingsTemplateEditorPanel
        open={editor.kind === 'open'}
        onClose={() => setEditor({ kind: 'idle' })}
        editTarget={editor.kind === 'open' ? editor.editTarget : null}
      />
    </div>
  )
}
