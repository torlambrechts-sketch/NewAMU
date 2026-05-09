// Prosjektdetalj — 02 slide-in panel for project drill-in.
//
// Shows the full project context: PDCA progress, evidence ledger,
// task list, signatures, and the auditor-share button. Opened from
// the PDCA board (project badge on card) or from the table report
// (row click when projectId is set).
import { useState } from 'react'
import {
  CheckCircle,
  ChevronRight,
  FileText,
  Link2,
  Paperclip,
  Plus,
  Share2,
  X,
} from 'lucide-react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { TaskProject, TaskProjectEvidence } from '../../src/types/task'
import { useTaskItems } from './useTaskItems'
import { useTaskProjectEvidence } from './useTaskProjects'

const KIND_ICONS: Record<TaskProjectEvidence['kind'], typeof FileText> = {
  file: Paperclip,
  checklist_execution: CheckCircle,
  survey_response: FileText,
  register_record: FileText,
  note: FileText,
}

const KIND_LABELS: Record<TaskProjectEvidence['kind'], string> = {
  file: 'Fil',
  checklist_execution: 'Sjekkliste',
  survey_response: 'Undersøkelse',
  register_record: 'Register',
  note: 'Notat',
}

const PDCA_LABELS = { plan: 'Plan', do: 'Do', check: 'Check', act: 'Act' } as const
const STATUS_LABELS = { todo: 'Ikke startet', in_progress: 'Pågår', done: 'Fullført' } as const

type Props = {
  project: TaskProject
  onClose: () => void
}

export function TaskProjectDetailPanel({ project, onClose }: Props) {
  const { supabase } = useOrgSetupContext()
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [addNoteLabel, setAddNoteLabel] = useState('')
  const [showAddNote, setShowAddNote] = useState(false)

  const { items, loading: itemsLoading } = useTaskItems({ projectId: project.id })
  const { evidence, loading: evidenceLoading, addEvidence, removeEvidence } = useTaskProjectEvidence(project.id)

  // PDCA progress stats
  const total = items.length
  const done = items.filter((t) => t.status === 'done').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const byPhase = {
    plan: items.filter((t) => t.pdcaPhase === 'plan'),
    do: items.filter((t) => t.pdcaPhase === 'do'),
    check: items.filter((t) => t.pdcaPhase === 'check'),
    act: items.filter((t) => t.pdcaPhase === 'act'),
  }

  const handleShare = async () => {
    if (!supabase) return
    setShareLoading(true)
    try {
      const { data, error } = await supabase.rpc('generate_task_export_token', {
        p_project_id: project.id,
      })
      if (error || !data) {
        console.error('Share token error:', error)
        return
      }
      const url = `${window.location.origin}/tasks/audit/${data as string}`
      setShareUrl(url)
      await navigator.clipboard.writeText(url)
    } finally {
      setShareLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!addNoteLabel.trim()) return
    await addEvidence({
      organizationId: project.organizationId,
      projectId: project.id,
      kind: 'note',
      label: addNoteLabel.trim(),
    })
    setAddNoteLabel('')
    setShowAddNote(false)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-neutral-200 px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#c2410c] px-2 py-0.5 text-xs font-medium text-white uppercase tracking-wide">
              {project.pack === 'aml-amu' ? 'AML' : 'ISO 45001'}
            </span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {project.methodology.toUpperCase()}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${
              project.status === 'active'
                ? 'bg-green-100 text-green-800'
                : project.status === 'closed'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-neutral-100 text-neutral-600'
            }`}>
              {project.status === 'active' ? 'Aktiv' : project.status === 'closed' ? 'Lukket' : 'Arkivert'}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900 leading-tight">
            {project.title}
          </h2>
          {project.description && (
            <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{project.description}</p>
          )}
          {/* Law refs */}
          {project.lawRefs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {project.lawRefs.map((ref) => (
                <span key={ref} className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {ref}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-4 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Lukk"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* PDCA progress */}
        <section className="border-b border-neutral-100 px-6 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            PDCA-fremgang
          </h3>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-neutral-700">{done} / {total} fullført</span>
            <span className="font-semibold text-neutral-900">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-[#c2410c] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(['plan', 'do', 'check', 'act'] as const).map((phase) => {
              const phaseItems = byPhase[phase]
              const phaseDone = phaseItems.filter((t) => t.status === 'done').length
              return (
                <div key={phase} className="rounded border border-neutral-200 bg-neutral-50 p-2 text-center">
                  <div className="text-xs font-semibold text-neutral-600">{PDCA_LABELS[phase]}</div>
                  <div className="mt-0.5 text-lg font-bold text-neutral-900">{phaseItems.length}</div>
                  <div className="text-[10px] text-neutral-400">{phaseDone} ferdig</div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Evidence ledger */}
        <section className="border-b border-neutral-100 px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Bevislogg ({evidence.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowAddNote((p) => !p)}
              className="inline-flex items-center gap-1 text-xs text-[#c2410c] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Legg til notat
            </button>
          </div>

          {showAddNote && (
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={addNoteLabel}
                onChange={(e) => setAddNoteLabel(e.target.value)}
                placeholder="Notattekst..."
                className="h-8 flex-1 rounded border border-neutral-300 px-2 text-sm focus:border-neutral-500 focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddNote() }}
              />
              <button
                type="button"
                onClick={() => void handleAddNote()}
                className="h-8 rounded bg-neutral-800 px-3 text-xs font-medium text-white hover:bg-neutral-700"
              >
                Lagre
              </button>
            </div>
          )}

          {evidenceLoading ? (
            <div className="space-y-2">
              {[1, 2].map((n) => (
                <div key={n} className="h-10 animate-pulse rounded bg-neutral-100" />
              ))}
            </div>
          ) : evidence.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">Ingen bevis lagt til ennå.</p>
          ) : (
            <div className="space-y-1">
              {evidence.map((ev) => {
                const Icon = KIND_ICONS[ev.kind]
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2 rounded border border-neutral-100 bg-white px-3 py-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-neutral-800">{ev.label}</span>
                      <span className="text-[10px] text-neutral-400">
                        {KIND_LABELS[ev.kind]} · {new Date(ev.createdAt).toLocaleDateString('nb-NO')}
                      </span>
                    </div>
                    {ev.externalRefId && (
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden />
                    )}
                    <button
                      type="button"
                      onClick={() => void removeEvidence(ev.id)}
                      className="shrink-0 p-1 text-neutral-300 hover:text-red-500"
                      aria-label="Fjern"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Task list */}
        <section className="px-6 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Oppgaver ({items.length})
          </h3>
          {itemsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 animate-pulse rounded bg-neutral-100" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">Ingen oppgaver i prosjektet.</p>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded border border-neutral-100 bg-white px-3 py-2"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    item.status === 'done' ? 'bg-green-500' : item.status === 'in_progress' ? 'bg-orange-400' : 'bg-neutral-300'
                  }`} />
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{item.title}</span>
                  <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                    {PDCA_LABELS[item.pdcaPhase]}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">{STATUS_LABELS[item.status]}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer — auditor share */}
      <div className="border-t border-neutral-200 px-6 py-4">
        {shareUrl ? (
          <div className="flex items-center gap-2 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs">{shareUrl}</span>
            <span className="text-xs font-medium">Kopiert!</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={shareLoading}
            className="flex w-full items-center justify-center gap-2 rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            {shareLoading ? 'Genererer lenke...' : 'Del revisorpakke (30 dager)'}
          </button>
        )}
      </div>
    </div>
  )
}
