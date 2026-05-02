import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Mail, Plus, Radio, Trash2, Webhook } from 'lucide-react'
import type { WorkflowAction, WorkflowActionCreateDeviation } from '../../types/workflow'
import {
  defaultCreateDeviationAction,
  defaultWebhookAction,
  defaultLogOnlyAction,
  defaultNotificationAction,
  defaultSendEmailAction,
  defaultTaskAction,
  summarizeAction,
} from './workflowActionDefaults'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { SearchableSelect } from '../ui/SearchableSelect'

const FIELD_LABEL = 'mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500'
const WF_LEAD = 'text-sm leading-relaxed text-neutral-600'

const WEBHOOK_METHOD_OPTIONS = [
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'GET', label: 'GET' },
]

type DialogKind = 'email' | 'notification' | 'webhook' | null

type WorkflowActionCreateTask = Extract<WorkflowAction, { type: 'create_task' }>
type WorkflowSendEmail = Extract<WorkflowAction, { type: 'send_email' }>
type WorkflowSendNotification = Extract<WorkflowAction, { type: 'send_notification' }>
type WorkflowCallWebhook = Extract<WorkflowAction, { type: 'call_webhook' }>

function DeviationFields({
  a,
  onPatch,
}: {
  a: WorkflowActionCreateDeviation
  onPatch: (p: Partial<WorkflowActionCreateDeviation>) => void
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className={WF_LEAD}>
        Oppretter en rad i <code className="text-xs">deviations</code> med funn-alvoret. Kun aktivt for kilde
        «Inspeksjonsmodul».
      </p>
      <div>
        <label className={FIELD_LABEL}>Tittel-prefiks (valgfritt)</label>
        <StandardInput
          value={a.titlePrefix ?? ''}
          onChange={(e) => onPatch({ titlePrefix: e.target.value || undefined })}
          placeholder="Standardtittel fra rundetittel"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Frist (dager)</label>
        <StandardInput
          type="number"
          min={0}
          value={a.dueInDays ?? 1}
          onChange={(e) => onPatch({ dueInDays: Number(e.target.value) || 1 })}
        />
      </div>
      <label className={`flex items-center gap-2 ${WF_LEAD}`}>
        <input
          type="checkbox"
          checked={a.assignFromRound !== false}
          onChange={(e) => onPatch({ assignFromRound: e.target.checked })}
          className="size-4"
        />
        Arv tildelt fra inspeksjonsrunde
      </label>
    </div>
  )
}

function TaskFields({
  t,
  onPatch,
}: {
  t: WorkflowActionCreateTask
  onPatch: (p: Partial<WorkflowActionCreateTask>) => void
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className={FIELD_LABEL}>Tittel</label>
        <StandardInput
          value={t.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Beskrivelse</label>
        <StandardTextarea
          value={t.description ?? ''}
          onChange={(e) => onPatch({ description: e.target.value })}
          rows={2}
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Ansvarlig (tekst)</label>
        <StandardInput
          value={t.assignee ?? ''}
          onChange={(e) => onPatch({ assignee: e.target.value })}
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Frist (dager)</label>
        <StandardInput
          type="number"
          min={0}
          value={t.dueInDays ?? 7}
          onChange={(e) => onPatch({ dueInDays: Number(e.target.value) || 0 })}
        />
      </div>
      <label className={`flex items-center gap-2 ${WF_LEAD}`}>
        <input
          type="checkbox"
          checked={Boolean(t.requiresManagementSignOff)}
          onChange={(e) => onPatch({ requiresManagementSignOff: e.target.checked })}
          className="size-4"
        />
        Krever ledelsessignatur
      </label>
    </div>
  )
}

export function WorkflowActionsEditor({
  actions,
  onChange,
}: {
  actions: WorkflowAction[]
  onChange: (a: WorkflowAction[]) => void
}) {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [editIndex, setEditIndex] = useState<number | null>(null)

  const [emailForm, setEmailForm] = useState<WorkflowSendEmail>(defaultSendEmailAction())
  const [notifForm, setNotifForm] = useState<WorkflowSendNotification>(defaultNotificationAction())
  const [webhookForm, setWebhookForm] = useState<WorkflowCallWebhook>(defaultWebhookAction())

  const closeDialog = useCallback(() => {
    setDialog(null)
    setEditIndex(null)
  }, [])

  useEffect(() => {
    if (dialog !== 'email' || editIndex === null) return
    const a = actions[editIndex]
    if (a && a.type === 'send_email') {
      queueMicrotask(() => setEmailForm({ ...a }))
    }
  }, [dialog, editIndex, actions])

  useEffect(() => {
    if (dialog !== 'notification' || editIndex === null) return
    const a = actions[editIndex]
    if (a && a.type === 'send_notification') {
      queueMicrotask(() => setNotifForm({ ...a }))
    }
  }, [dialog, editIndex, actions])

  useEffect(() => {
    if (dialog !== 'webhook' || editIndex === null) return
    const a = actions[editIndex]
    if (a && a.type === 'call_webhook') {
      queueMicrotask(() => setWebhookForm({ ...a }))
    }
  }, [dialog, editIndex, actions])

  const openNewDialog = (kind: DialogKind) => {
    setEditIndex(null)
    if (kind === 'email') setEmailForm(defaultSendEmailAction())
    if (kind === 'notification') setNotifForm(defaultNotificationAction())
    if (kind === 'webhook') setWebhookForm(defaultWebhookAction())
    setDialog(kind)
  }

  const openEditDialog = (idx: number) => {
    const a = actions[idx]
    setEditIndex(idx)
    if (a.type === 'send_email') {
      setEmailForm({ ...a })
      setDialog('email')
    } else if (a.type === 'send_notification') {
      setNotifForm({ ...a })
      setDialog('notification')
    } else if (a.type === 'call_webhook') {
      setWebhookForm({ ...a })
      setDialog('webhook')
    }
  }

  const saveEmail = () => {
    const next = { ...emailForm }
    if (editIndex !== null) {
      const copy = [...actions]
      copy[editIndex] = next
      onChange(copy)
    } else {
      onChange([...actions, next])
    }
    closeDialog()
  }

  const saveNotif = () => {
    const next = { ...notifForm }
    if (editIndex !== null) {
      const copy = [...actions]
      copy[editIndex] = next
      onChange(copy)
    } else {
      onChange([...actions, next])
    }
    closeDialog()
  }

  const saveWebhook = () => {
    const next = { ...webhookForm }
    if (editIndex !== null) {
      const copy = [...actions]
      copy[editIndex] = next
      onChange(copy)
    } else {
      onChange([...actions, next])
    }
    closeDialog()
  }

  const removeAt = (i: number) => {
    onChange(actions.filter((_, j) => j !== i))
  }

  const patchDeviation = (idx: number, p: Partial<WorkflowActionCreateDeviation>) => {
    const a = actions[idx]
    if (a.type !== 'create_deviation') return
    const copy = [...actions]
    copy[idx] = { ...a, ...p }
    onChange(copy)
  }

  const patchTask = (idx: number, p: Partial<WorkflowActionCreateTask>) => {
    const t = actions[idx]
    if (t.type !== 'create_task') return
    const copy = [...actions]
    copy[idx] = { ...t, ...p }
    onChange(copy)
  }

  const patchLog = (idx: number, note: string) => {
    const t = actions[idx]
    if (t.type !== 'log_only') return
    const copy = [...actions]
    copy[idx] = { type: 'log_only', note }
    onChange(copy)
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => onChange([...actions, defaultTaskAction()])}>
          <Plus className="size-3.5" /> Oppgave
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChange([...actions, defaultCreateDeviationAction()])}>
          <AlertTriangle className="size-3.5" /> Avvik…
        </Button>
        <Button variant="secondary" size="sm" onClick={() => openNewDialog('email')}>
          <Mail className="size-3.5" /> E-post…
        </Button>
        <Button variant="secondary" size="sm" onClick={() => openNewDialog('notification')}>
          <Radio className="size-3.5" /> Varsling…
        </Button>
        <Button variant="secondary" size="sm" onClick={() => openNewDialog('webhook')}>
          <Webhook className="size-3.5" /> Webhook…
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChange([...actions, defaultLogOnlyAction()])}>
          Logg
        </Button>
      </div>

      <ul className="space-y-2">
        {actions.map((a, i) => (
          <li key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-neutral-200/90 bg-white p-3">
            <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
              {a.type.replace('_', ' ')}
            </span>
            <div className="min-w-0 flex-1 text-xs text-neutral-700">{summarizeAction(a)}</div>
            <div className="flex shrink-0 gap-1">
              {(a.type === 'send_email' || a.type === 'send_notification' || a.type === 'call_webhook') && (
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(i)}>
                  Rediger…
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => removeAt(i)} aria-label="Slett" className="text-red-600 hover:text-red-700">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            {a.type === 'create_deviation' ? (
              <div className="w-full border-t border-neutral-200 pt-2">
                <DeviationFields a={a} onPatch={(p) => patchDeviation(i, p)} />
              </div>
            ) : null}
            {a.type === 'create_task' ? (
              <div className="w-full border-t border-neutral-200 pt-2">
                <TaskFields t={a} onPatch={(p) => patchTask(i, p)} />
              </div>
            ) : null}
            {a.type === 'log_only' ? (
              <div className="w-full border-t border-neutral-200/80 pt-3">
                <label className={FIELD_LABEL}>Merknad</label>
                <StandardInput
                  value={a.note ?? ''}
                  onChange={(e) => patchLog(i, e.target.value)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {actions.length === 0 ? <p className="text-xs text-neutral-500">Legg til minst én handling.</p> : null}

      {dialog ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[80] bg-black/40"
            onClick={closeDialog}
          />
          <div className="fixed left-1/2 top-1/2 z-[90] w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200/90 bg-white p-5 shadow-xl">
            {dialog === 'email' ? (
              <>
                <h4 className="text-sm font-semibold text-neutral-900">
                  {editIndex !== null ? 'Rediger e-post' : 'Send e-post (planlagt)'}
                </h4>
                <p className={`${WF_LEAD} mt-2`}>
                  Fra / til og innhold lagres i regelen. Faktisk utsending krever server (Edge Function).
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className={FIELD_LABEL}>Fra (e-post)</label>
                    <StandardInput
                      value={emailForm.fromAddress}
                      onChange={(e) => setEmailForm((f: WorkflowSendEmail) => ({ ...f, fromAddress: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Til (e-post)</label>
                    <StandardInput
                      value={emailForm.toAddress}
                      onChange={(e) => setEmailForm((f: WorkflowSendEmail) => ({ ...f, toAddress: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Emne</label>
                    <StandardInput
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm((f: WorkflowSendEmail) => ({ ...f, subject: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Innhold</label>
                    <StandardTextarea
                      value={emailForm.body}
                      onChange={(e) => setEmailForm((f: WorkflowSendEmail) => ({ ...f, body: e.target.value }))}
                      rows={5}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={closeDialog}>Avbryt</Button>
                  <Button variant="primary" size="sm" onClick={saveEmail}>OK</Button>
                </div>
              </>
            ) : null}

            {dialog === 'notification' ? (
              <>
                <h4 className="text-sm font-semibold text-neutral-900">Varsling (logges)</h4>
                <p className={`${WF_LEAD} mt-2`}>
                  Registreres ved kjøring. In-app toasts styres av brukerinnstillinger.
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className={FIELD_LABEL}>Tittel</label>
                    <StandardInput
                      value={notifForm.title}
                      onChange={(e) => setNotifForm((f: WorkflowSendNotification) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Tekst</label>
                    <StandardTextarea
                      value={notifForm.body}
                      onChange={(e) => setNotifForm((f: WorkflowSendNotification) => ({ ...f, body: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Kategori</label>
                    <StandardInput
                      value={notifForm.category ?? ''}
                      onChange={(e) => setNotifForm((f: WorkflowSendNotification) => ({ ...f, category: e.target.value }))}
                      placeholder="workflow"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={closeDialog}>Avbryt</Button>
                  <Button variant="primary" size="sm" onClick={saveNotif}>OK</Button>
                </div>
              </>
            ) : null}

            {dialog === 'webhook' ? (
              <>
                <h4 className="text-sm font-semibold text-neutral-900">Webhook (planlagt kall)</h4>
                <p className={`${WF_LEAD} mt-2`}>
                  URL og payload lagres. HTTP fra Postgres kjøres ikke — bruk Edge Function for produksjon.
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className={FIELD_LABEL}>URL</label>
                    <StandardInput
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm((f: WorkflowCallWebhook) => ({ ...f, url: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Metode</label>
                    <SearchableSelect
                      value={webhookForm.method ?? 'POST'}
                      options={WEBHOOK_METHOD_OPTIONS}
                      onChange={(val) =>
                        setWebhookForm((f: WorkflowCallWebhook) => ({
                          ...f,
                          method: val as 'POST' | 'PUT' | 'GET',
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Headers (JSON)</label>
                    <StandardTextarea
                      value={webhookForm.headersJson ?? '{}'}
                      onChange={(e) => setWebhookForm((f: WorkflowCallWebhook) => ({ ...f, headersJson: e.target.value }))}
                      rows={2}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Body</label>
                    <StandardTextarea
                      value={webhookForm.body ?? ''}
                      onChange={(e) => setWebhookForm((f: WorkflowCallWebhook) => ({ ...f, body: e.target.value }))}
                      rows={3}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={closeDialog}>Avbryt</Button>
                  <Button variant="primary" size="sm" onClick={saveWebhook}>OK</Button>
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
