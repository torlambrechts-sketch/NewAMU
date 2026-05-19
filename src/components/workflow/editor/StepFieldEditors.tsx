// Inline field editors per action type. Keeps the new editor's UI close
// to the mockup (TIL / EMNE / MAL) without rebuilding the full Workflow
// ActionsEditor — that one is still the canonical advanced editor and is
// surfaced via a "Avansert" toggle.

import type { ReactNode } from 'react'
import type {
  WorkflowAction,
  WorkflowCondition,
} from '../../../types/workflow'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { SearchableSelect } from '../../ui/SearchableSelect'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'
const FIELD_GROUP = 'space-y-1.5'

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className={FIELD_GROUP}>
      <label className={LABEL}>
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  )
}

export const VARIABLES_BY_MODULE: Record<string, string[]> = {
  deviation: ['{avvik.id}', '{avvik.lokasjon}', '{avvik.melder}', '{avvik.alvorlighet}', '{avvik.beskrivelse}', '{avvik.opprettet}'],
  task: ['{oppgave.id}', '{oppgave.tittel}', '{oppgave.ansvarlig}', '{oppgave.frist}'],
  ros: ['{ros.id}', '{ros.tittel}', '{ros.matrise}'],
  inspection: ['{runde.id}', '{runde.tittel}', '{runde.lokasjon}'],
  hse: ['{hms.id}', '{hms.modul}'],
  alerts: ['{varsel.id}', '{varsel.kategori}'],
  default: ['{org.id}', '{org.navn}', '{trigger.tidspunkt}'],
}

export function variablesFor(sourceModule: string): string[] {
  return [...(VARIABLES_BY_MODULE[sourceModule] ?? []), ...VARIABLES_BY_MODULE.default]
}

type AnyOnPatch<A extends WorkflowAction> = (next: A) => void

export function EmailFields({
  a,
  onPatch,
  showCc,
}: {
  a: Extract<WorkflowAction, { type: 'send_email' }>
  onPatch: AnyOnPatch<Extract<WorkflowAction, { type: 'send_email' }>>
  showCc?: boolean
}) {
  return (
    <div className="space-y-4">
      <Field label="Til" required>
        <StandardInput
          value={a.toAddress}
          onChange={(e) => onPatch({ ...a, toAddress: e.target.value })}
          placeholder="amu-leder@firma.no"
        />
      </Field>
      {showCc && (
        <Field label="Kopi (valgfritt)">
          <StandardInput
            value={(a as { ccAddress?: string }).ccAddress ?? ''}
            onChange={(e) => onPatch({ ...a, ccAddress: e.target.value || undefined } as typeof a)}
            placeholder="verneombud@firma.no, hms@firma.no"
          />
        </Field>
      )}
      <Field label="Emne" required>
        <StandardInput
          value={a.subject}
          onChange={(e) => onPatch({ ...a, subject: e.target.value })}
          placeholder="Kritisk avvik — {avvik.id}"
        />
      </Field>
      <Field label="Mal">
        <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
          <span className="inline-flex items-center gap-2 text-sm text-neutral-700">
            <span aria-hidden>📄</span>
            <code className="text-xs">{a.subject ? 'kritisk-avvik.eml' : 'standard.eml'}</code>
          </span>
          <span className="text-xs text-neutral-500">Endre</span>
        </div>
      </Field>
      <Field label="Innhold">
        <StandardTextarea
          value={a.body}
          onChange={(e) => onPatch({ ...a, body: e.target.value })}
          rows={4}
          placeholder="Skriv eller bruk variabler …"
        />
      </Field>
    </div>
  )
}

export function CreateRosDraftFields({
  a,
  onPatch,
}: {
  a: Extract<WorkflowAction, { type: 'create_ros_draft' }>
  onPatch: AnyOnPatch<Extract<WorkflowAction, { type: 'create_ros_draft' }>>
}) {
  return (
    <div className="space-y-4">
      <Field label="Mal">
        <SearchableSelect
          value={a.template || 'standard-5x5'}
          options={[
            { value: 'standard-5x5', label: 'Standard 5×5-matrise' },
            { value: 'kjemikalier', label: 'Kjemikalier' },
            { value: 'arbeidsplass', label: 'Arbeidsplass' },
            { value: 'maskin', label: 'Maskin / utstyr' },
          ]}
          onChange={(v) => onPatch({ ...a, template: v })}
        />
      </Field>
      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
        <StandardInput
          type="checkbox"
          className="size-4"
          checked={a.linkSource}
          onChange={(e) => onPatch({ ...a, linkSource: e.target.checked })}
        />
        Lenk ROS til utløsende kilde
      </label>
    </div>
  )
}

export function CreateTaskFields({
  a,
  onPatch,
}: {
  a: Extract<WorkflowAction, { type: 'create_task' }>
  onPatch: AnyOnPatch<Extract<WorkflowAction, { type: 'create_task' }>>
}) {
  return (
    <div className="space-y-4">
      <Field label="Tittel" required>
        <StandardInput
          value={a.title}
          onChange={(e) => onPatch({ ...a, title: e.target.value })}
        />
      </Field>
      <Field label="Ansvarlig">
        <StandardInput
          value={a.assignee ?? ''}
          onChange={(e) => onPatch({ ...a, assignee: e.target.value || undefined })}
          placeholder="lokasjons-basert, HMS, verneombud …"
        />
      </Field>
      <Field label="Frist (dager)">
        <StandardInput
          type="number"
          min={0}
          value={a.dueInDays ?? 7}
          onChange={(e) => onPatch({ ...a, dueInDays: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="Beskrivelse">
        <StandardTextarea
          value={a.description ?? ''}
          onChange={(e) => onPatch({ ...a, description: e.target.value || undefined })}
          rows={2}
        />
      </Field>
    </div>
  )
}

export function WaitDelayFields({
  a,
  onPatch,
}: {
  a: Extract<WorkflowAction, { type: 'wait_delay' }>
  onPatch: AnyOnPatch<Extract<WorkflowAction, { type: 'wait_delay' }>>
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Antall" required>
        <StandardInput
          type="number"
          min={1}
          value={a.amount}
          onChange={(e) => onPatch({ ...a, amount: Number(e.target.value) || 1 })}
        />
      </Field>
      <Field label="Enhet" required>
        <SearchableSelect
          value={a.unit}
          options={[
            { value: 'minutes', label: 'Minutter' },
            { value: 'hours', label: 'Timer' },
            { value: 'days', label: 'Dager' },
            { value: 'weeks', label: 'Uker' },
          ]}
          onChange={(v) => onPatch({ ...a, unit: v as typeof a.unit })}
        />
      </Field>
    </div>
  )
}

export function NotificationFields({
  a,
  onPatch,
}: {
  a: Extract<WorkflowAction, { type: 'send_notification' }>
  onPatch: AnyOnPatch<Extract<WorkflowAction, { type: 'send_notification' }>>
}) {
  return (
    <div className="space-y-4">
      <Field label="Tittel" required>
        <StandardInput value={a.title} onChange={(e) => onPatch({ ...a, title: e.target.value })} />
      </Field>
      <Field label="Innhold">
        <StandardTextarea
          value={a.body}
          onChange={(e) => onPatch({ ...a, body: e.target.value })}
          rows={3}
        />
      </Field>
      <Field label="Kategori">
        <StandardInput
          value={a.category ?? ''}
          onChange={(e) => onPatch({ ...a, category: e.target.value || undefined })}
          placeholder="workflow"
        />
      </Field>
    </div>
  )
}

export function ConditionFields({
  value,
  onChange,
}: {
  value: WorkflowCondition
  onChange: (next: WorkflowCondition) => void
}) {
  return (
    <div className="space-y-4">
      <Field label="Type">
        <SearchableSelect
          value={value.match}
          options={[
            { value: 'always', label: 'Alltid' },
            { value: 'field_equals', label: 'Felt = verdi' },
            { value: 'array_any', label: 'Liste inneholder' },
          ]}
          onChange={(v) => {
            if (v === 'always') onChange({ match: 'always' })
            else if (v === 'field_equals') onChange({ match: 'field_equals', path: '', value: '' })
            else onChange({ match: 'array_any', path: '', where: {} })
          }}
        />
      </Field>
      {value.match === 'field_equals' && (
        <>
          <Field label="Felt">
            <StandardInput
              value={value.path}
              onChange={(e) => onChange({ ...value, path: e.target.value })}
              placeholder="alvorlighet"
            />
          </Field>
          <Field label="Verdi">
            <StandardInput
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
              placeholder="kritisk"
            />
          </Field>
        </>
      )}
      {value.match === 'array_any' && (
        <>
          <Field label="Sti">
            <StandardInput
              value={value.path}
              onChange={(e) => onChange({ ...value, path: e.target.value })}
              placeholder="tags"
            />
          </Field>
          <Field label="Verdier">
            <StandardInput
              value={Object.entries(value.where)
                .map(([k, v]) => `${k}=${String(v)}`)
                .join(', ')}
              onChange={(e) => {
                const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                const where: Record<string, unknown> = {}
                for (const p of parts) {
                  const [k, v] = p.split('=')
                  if (k && v !== undefined) where[k.trim()] = v.trim()
                }
                onChange({ ...value, where })
              }}
              placeholder="value=fall, value=klem"
            />
          </Field>
        </>
      )}
    </div>
  )
}

export function GenericActionPreview({ a }: { a: WorkflowAction }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
      <p className="font-medium">Avansert handling</p>
      <p className="mt-1">
        Denne handlingstypen («<code>{a.type}</code>») redigeres i den avanserte canvas-visningen.
        Bytt til Avansert øverst for å åpne den.
      </p>
    </div>
  )
}

export function VariableChips({ variables, onPick }: { variables: string[]; onPick?: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className={LABEL}>Tilgjengelige variabler</span>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <Button
            key={v}
            type="button"
            variant="ghost"
            className="h-auto rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-700 hover:bg-neutral-100"
            onClick={() => onPick?.(v)}
            disabled={!onPick}
          >
            {v}
          </Button>
        ))}
      </div>
    </div>
  )
}
