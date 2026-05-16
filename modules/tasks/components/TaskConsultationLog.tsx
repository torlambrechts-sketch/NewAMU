// TaskConsultationLog — record and view who was consulted during this task.
// ISO 45001 § 5.4: worker participation must be documented.
// verneombud role + consulted_at satisfies AML § 6-2 documentation requirement.

import { useCallback, useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { StandardInput } from '../../../src/components/ui/Input'
import {
  WPSTD_FORM_FIELD_LABEL,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'

type ConsultationRow = {
  id: string
  consultedName: string
  role: string
  consultedAt: string
  method: string | null
  notes: string | null
}

type Props = { taskItemId: string }

const ROLE_LABEL: Record<string, string> = {
  verneombud: 'Verneombud (§ 6-2)',
  amu_member: 'AMU-representant (§ 7-2)',
  worker: 'Arbeidstaker (§ 4-2)',
  union_rep: 'Tillitsvalgt (§ 8)',
  manager: 'Leder',
  external_expert: 'BHT / ekstern',
  other: 'Annen',
}

const METHOD_LABEL: Record<string, string> = {
  meeting: 'Møte',
  written: 'Skriftlig',
  email: 'E-post',
  phone: 'Telefon',
  other: 'Annet',
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
  } catch {
    return s
  }
}

const EMPTY = {
  consultedName: '',
  role: 'verneombud',
  consultedAt: new Date().toISOString().split('T')[0],
  method: 'meeting',
  notes: '',
}

export function TaskConsultationLog({ taskItemId }: Props) {
  const { supabase } = useOrgSetupContext()
  const [rows, setRows] = useState<ConsultationRow[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('task_item_consultations')
      .select('id, consulted_name, role, consulted_at, method, notes')
      .eq('task_item_id', taskItemId)
      .order('consulted_at', { ascending: false })
    if (data) {
      setRows(
        data.map((r) => ({
          id: String(r.id),
          consultedName: String(r.consulted_name ?? ''),
          role: String(r.role ?? 'other'),
          consultedAt: String(r.consulted_at),
          method: r.method ? String(r.method) : null,
          notes: r.notes ? String(r.notes) : null,
        })),
      )
    }
  }, [supabase, taskItemId])

  useEffect(() => {
    void load()
  }, [load])

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!supabase || !form.consultedName.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('task_item_consultations')
      .insert({
        task_item_id: taskItemId,
        consulted_name: form.consultedName.trim(),
        role: form.role,
        consulted_at: form.consultedAt,
        method: form.method || null,
        notes: form.notes.trim() || null,
      })
      .select('id, consulted_name, role, consulted_at, method, notes')
      .single()
    if (data) {
      setRows((prev) => [
        {
          id: String(data.id),
          consultedName: String(data.consulted_name),
          role: String(data.role),
          consultedAt: String(data.consulted_at),
          method: data.method ? String(data.method) : null,
          notes: data.notes ? String(data.notes) : null,
        },
        ...prev,
      ])
    }
    setForm(EMPTY)
    setAddOpen(false)
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Konsultasjonslogg {rows.length > 0 ? `· ${rows.length}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-neutral-500 transition hover:text-[#c2410c]"
        >
          <Plus className="h-3.5 w-3.5" />
          Loggfør
        </button>
      </div>

      {addOpen && (
        <div className="rounded-lg border border-neutral-200/80 bg-white p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Navn *</p>
              <StandardInput
                value={form.consultedName}
                onChange={(e) => set('consultedName', e.target.value)}
                placeholder="Navn på person…"
              />
            </div>
            <div>
              <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Rolle</p>
              <select
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-[#c2410c] focus:outline-none"
              >
                {Object.entries(ROLE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Dato</p>
              <StandardInput
                type="date"
                value={form.consultedAt}
                onChange={(e) => set('consultedAt', e.target.value)}
              />
            </div>
            <div>
              <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Metode</p>
              <select
                value={form.method}
                onChange={(e) => set('method', e.target.value)}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-[#c2410c] focus:outline-none"
              >
                {Object.entries(METHOD_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Notat (valgfritt)…"
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
              disabled={saving || !form.consultedName.trim()}
              className="rounded bg-[#c2410c] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#b83b0a] disabled:opacity-40"
            >
              {saving ? 'Lagrer…' : 'Lagre'}
            </button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 rounded-lg border border-neutral-200/80 bg-white p-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {r.consultedName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium text-neutral-800">{r.consultedName}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                    {ROLE_LABEL[r.role] ?? r.role}
                  </span>
                  <span className="text-[11px] text-neutral-400">{fmtDate(r.consultedAt)}</span>
                  {r.method && (
                    <span className="text-[11px] text-neutral-400">
                      · {METHOD_LABEL[r.method] ?? r.method}
                    </span>
                  )}
                </div>
                {r.notes && <p className="mt-0.5 text-xs text-neutral-500">{r.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 && !addOpen && (
        <p className="text-xs text-neutral-400">Ingen konsultasjoner registrert ennå.</p>
      )}
    </div>
  )
}
