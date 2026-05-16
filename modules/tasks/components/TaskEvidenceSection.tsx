// TaskEvidenceSection — add and view objective evidence on a task item.
// Phase 2 supports notes and external links. File/photo upload and
// measurement kinds come in Phase 5 (storage wiring).

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText, Link2, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAddOpen((v) => !v)}
          icon={<Plus className="h-3.5 w-3.5" />}
          className="px-0 text-xs text-neutral-500 hover:bg-transparent hover:text-[#c2410c]"
        >
          Legg til
        </Button>
      </div>

      {addOpen && (
        <div className="rounded-lg border border-neutral-200/80 bg-white p-4 space-y-3">
          <div className="flex gap-2">
            {(['note', 'external_link'] as TaskItemEvidenceKind[]).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={form.kind === k ? 'primary' : 'secondary'}
                onClick={() => setForm((f) => ({ ...f, kind: k }))}
                className={form.kind === k ? 'bg-[#c2410c] hover:bg-[#a33609]' : 'hover:border-neutral-300'}
              >
                {KIND_LABEL[k]}
              </Button>
            ))}
            <span className="ml-2 self-center text-[11px] text-neutral-400">
              Fil-opplasting kommer i fase 5
            </span>
          </div>
          <StandardInput
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder={form.kind === 'external_link' ? 'URL eller referanse…' : 'Tittel på notat…'}
            className="bg-neutral-50 focus:border-[#c2410c] focus:ring-[#c2410c]/20"
          />
          <StandardTextarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Beskrivelse (valgfritt)…"
            className="resize-none bg-neutral-50 focus:border-[#c2410c] focus:ring-[#c2410c]/20"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(false)}>
              Avbryt
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void save()}
              disabled={saving || !form.label.trim()}
              className="bg-[#c2410c] hover:bg-[#b83b0a]"
            >
              {saving ? 'Lagrer…' : 'Lagre'}
            </Button>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(e.id)}
                  className="hidden h-7 w-7 shrink-0 text-neutral-400 hover:bg-transparent hover:text-red-500 group-hover:flex"
                  aria-label="Slett bevis"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
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
