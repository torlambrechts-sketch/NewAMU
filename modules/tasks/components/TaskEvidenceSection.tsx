// TaskEvidenceSection — add and view objective evidence on a task item.
// Phase 2 supports notes and external links. File/photo upload and
// measurement kinds come in Phase 5 (storage wiring).

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText, Link2, Paperclip, Plus, Trash2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type { TaskItemEvidenceKind } from '../../../src/types/task'

type EvidenceRow = {
  id: string
  kind: TaskItemEvidenceKind
  label: string
  description: string
  filePath: string | null
  uploadedBy: string | null
  createdAt: string
}

type Props = { taskItemId: string }

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  note: FileText,
  external_link: Link2,
  file: Paperclip,
  photo: Paperclip,
}

const KIND_LABEL: Record<string, string> = {
  note: 'Notat',
  external_link: 'Lenke',
  file: 'Fil',
  photo: 'Bilde',
  measurement: 'Måling',
  checklist_ref: 'Sjekkliste',
  survey_ref: 'Undersøkelse',
}

export function TaskEvidenceSection({ taskItemId }: Props) {
  const { supabase } = useOrgSetupContext()
  const [items, setItems] = useState<EvidenceRow[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ kind: 'note' as TaskItemEvidenceKind, label: '', description: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('task_item_evidence')
      .select('id, kind, label, description, file_path, uploaded_by, created_at')
      .eq('task_item_id', taskItemId)
      .order('created_at', { ascending: true })
    if (data) {
      setItems(
        data.map((r) => ({
          id: String(r.id),
          kind: (r.kind ?? 'note') as TaskItemEvidenceKind,
          label: String(r.label ?? ''),
          description: String(r.description ?? ''),
          filePath: r.file_path ? String(r.file_path) : null,
          uploadedBy: r.uploaded_by ? String(r.uploaded_by) : null,
          createdAt: String(r.created_at),
        })),
      )
    }
  }, [supabase, taskItemId])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!supabase || !form.label.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('task_item_evidence')
      .insert({
        task_item_id: taskItemId,
        kind: form.kind,
        label: form.label.trim(),
        description: form.description.trim(),
      })
      .select('id, kind, label, description, file_path, uploaded_by, created_at')
      .single()
    if (data) {
      setItems((prev) => [
        ...prev,
        {
          id: String(data.id),
          kind: (data.kind ?? 'note') as TaskItemEvidenceKind,
          label: String(data.label),
          description: String(data.description ?? ''),
          filePath: null,
          uploadedBy: null,
          createdAt: String(data.created_at),
        },
      ])
    }
    setForm({ kind: 'note', label: '', description: '' })
    setAddOpen(false)
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!supabase) return
    setItems((prev) => prev.filter((e) => e.id !== id))
    await supabase.from('task_item_evidence').delete().eq('id', id)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Bevis {items.length > 0 ? `· ${items.length}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-neutral-500 transition hover:text-[#c2410c]"
        >
          <Plus className="h-3.5 w-3.5" />
          Legg til
        </button>
      </div>

      {addOpen && (
        <div className="rounded-lg border border-neutral-200/80 bg-white p-4 space-y-3">
          <div className="flex gap-2">
            {(['note', 'external_link'] as TaskItemEvidenceKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm((f) => ({ ...f, kind: k }))}
                className={`rounded border px-2.5 py-1 text-xs font-medium transition ${
                  form.kind === k
                    ? 'border-[#c2410c] bg-[#c2410c] text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
            <span className="ml-2 self-center text-[11px] text-neutral-400">
              Fil-opplasting kommer i fase 5
            </span>
          </div>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder={form.kind === 'external_link' ? 'URL eller referanse…' : 'Tittel på notat…'}
            className="w-full rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Beskrivelse (valgfritt)…"
            className="w-full resize-none rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !form.label.trim()}
              className="rounded bg-[#c2410c] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#b83b0a] disabled:opacity-40"
            >
              {saving ? 'Lagrer…' : 'Lagre'}
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((e) => {
            const Icon = KIND_ICON[e.kind] ?? FileText
            return (
              <li
                key={e.id}
                className="group flex items-start gap-2.5 rounded-lg border border-neutral-200/80 bg-white p-4"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#c2410c]/60" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {KIND_LABEL[e.kind]}
                    </span>
                    <span className="text-sm font-medium text-neutral-800">{e.label}</span>
                    {e.kind === 'external_link' && e.label.startsWith('http') && (
                      <a
                        href={e.label}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#c2410c] hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {e.description && (
                    <p className="mt-0.5 text-xs text-neutral-500">{e.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(e.id)}
                  className="hidden shrink-0 text-neutral-400 transition hover:text-red-500 group-hover:block"
                  aria-label="Slett bevis"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {items.length === 0 && !addOpen && (
        <p className="text-xs text-neutral-400">Ingen bevis registrert ennå.</p>
      )}
    </div>
  )
}
