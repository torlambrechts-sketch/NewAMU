// Meetings embedder — Studio Builder Phase 2a Task 2a.1.
//
// Wraps the existing src/pages/meetings/MeetingsTemplateEditorPanel
// (slide-panel form, ~600 LoC) inline in the studio shell. Same adapter
// pattern as compliance: list templates, click to edit, "Ny" creates.

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { MeetingsTemplateEditorPanel } from '../../../src/pages/meetings/MeetingsTemplateEditorPanel'
import { Button } from '../../../src/components/ui/Button'
import { useMeetings } from '../useMeetings'
import type { MeetingOrgTemplateRow } from '../types'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'

type EditorState =
  | { kind: 'idle' }
  | { kind: 'open'; editTarget: MeetingOrgTemplateRow | null }

export default function MeetingsEmbedder({ mode }: EmbedderProps) {
  const meetings = useMeetings()
  const [editor, setEditor] = useState<EditorState>({ kind: 'idle' })

  const orgTemplates = meetings.orgTemplates ?? []

  return (
    <div data-studio-mode={mode} className="space-y-4">
      <CloneDeepLinkRedirect scopeId="meetings" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900 font-serif">Møte-maler</h4>
          <p className="text-xs text-neutral-500">
            Egendefinerte møte-maler. System-maler administreres separat under Møter → Innstillinger.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setEditor({ kind: 'open', editTarget: null })}
        >
          <Plus className="h-3.5 w-3.5" /> Ny mal
        </Button>
      </div>

      {meetings.loading ? (
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster maler…
        </div>
      ) : orgTemplates.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Ingen egne maler enda. Klikk «Ny mal» for å opprette den første.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {orgTemplates.map((t) => (
            <li key={t.id}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start py-3 font-normal"
                onClick={() => setEditor({ kind: 'open', editTarget: t })}
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

      <MeetingsTemplateEditorPanel
        open={editor.kind === 'open'}
        onClose={() => setEditor({ kind: 'idle' })}
        editTarget={editor.kind === 'open' ? editor.editTarget : null}
      />
    </div>
  )
}
