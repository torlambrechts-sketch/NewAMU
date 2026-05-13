// WorkflowBuilderPage — unified builder shell (v3).
//
// Wired at /workflow/v3 alongside the legacy /workflow page so existing
// users aren't disrupted. Tabbed UI hosts the four substrate-aware panels
// shipped in Phase B: Library, Kjøringer, Dry-run, Endringslogg.
//
// The visual canvas (drag-drop graph editor) is a separate component
// expected in a follow-up commit — this shell is the spine that ties
// together what the Phase A substrate just enabled.

import { useState } from 'react'
import { BookOpen, ClipboardList, PlayCircle, ScrollText } from 'lucide-react'
import { ModulePageShell } from '../../components/module'
import '../../lib/workflows/registerScopes'
import { LibraryPanel } from '../../components/workflow/library/LibraryPanel'
import { RunHistoryPanel } from '../../components/workflow/runs/RunHistoryPanel'
import { DryRunPanel } from '../../components/workflow/dryRun/DryRunPanel'
import { RevisionHistoryPanel } from '../../components/workflow/audit/RevisionHistoryPanel'

type Tab = 'library' | 'runs' | 'dry-run' | 'revisions'

const TABS: { id: Tab; label: string; Icon: typeof BookOpen }[] = [
  { id: 'library', label: 'Mal-bibliotek', Icon: BookOpen },
  { id: 'runs', label: 'Kjøringer', Icon: ClipboardList },
  { id: 'dry-run', label: 'Dry-run', Icon: PlayCircle },
  { id: 'revisions', label: 'Endringslogg', Icon: ScrollText },
]

export function WorkflowBuilderPage() {
  const [tab, setTab] = useState<Tab>('library')

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Admin', to: '/admin' },
        { label: 'Arbeidsflyt', to: '/workflow' },
        { label: 'v3' },
      ]}
      title="Arbeidsflyt — v3"
      description="Forhåndsdefinert bibliotek, dry-run, kjøringshistorikk og endringslogg på toppen av den nye substraten."
    >
      <div className="space-y-4">
        <nav className="flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === id ? 'bg-emerald-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        {tab === 'library' && <LibraryPanel />}
        {tab === 'runs' && <RunHistoryPanel />}
        {tab === 'dry-run' && <DryRunPanel />}
        {tab === 'revisions' && <RevisionHistoryPanel />}
      </div>
    </ModulePageShell>
  )
}

export default WorkflowBuilderPage
