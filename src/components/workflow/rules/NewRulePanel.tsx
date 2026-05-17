// NewRulePanel — slide-over to create a brand new workflow rule.
//
// Asks for: name (required), description, source_module (scope picker),
// trigger_event_name (filtered by selected scope from the registry SDK).
// On submit: calls upsertRule with no id → INSERT. Returns the new
// rule_id via onCreated so the parent can deep-link to the canvas.

import { useMemo, useState } from 'react'
import { SlidePanel } from '../../layout/SlidePanel'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { listWorkflowScopes, listWorkflowEvents } from '../../../lib/workflows/workflowRegistry'
import { WPSTD_FORM_FIELD_LABEL } from '../../layout/WorkplaceStandardFormPanel'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[æøå]/g, (c) => ({ æ: 'ae', ø: 'o', å: 'a' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function NewRulePanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (ruleId: string) => void
}) {
  const { upsertRule, canCompose } = useWorkflows()
  const scopes = useMemo(() => listWorkflowScopes(), [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scopeId, setScopeId] = useState<string>('')
  const [eventName, setEventName] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventOptions = useMemo(() => {
    if (!scopeId) return []
    return listWorkflowEvents(scopeId).map(({ event }) => ({
      value: event.name,
      label: `${event.label} (${event.name})`,
    }))
  }, [scopeId])

  const reset = () => {
    setName('')
    setDescription('')
    setScopeId('')
    setEventName('')
    setError(null)
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Navn er påkrevd.')
      return
    }
    if (!scopeId) {
      setError('Velg modul / scope.')
      return
    }
    setSaving(true)
    setError(null)
    const slug = `${scopeId}.${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`
    const result = await upsertRule({
      slug,
      name: name.trim(),
      description: description.trim(),
      source_module: scopeId,
      trigger_on: 'both',
      is_active: false,
      condition_json: { match: 'always' },
      actions_json: [],
      priority: 0,
    })
    setSaving(false)
    if (!result?.ok) {
      setError('Klarte ikke å opprette regelen — sjekk tilganger.')
      return
    }
    reset()
    if (result.id) onCreated(result.id)
    onClose()
  }

  return (
    <SlidePanel
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      titleId="new-rule-panel-title"
      title="Ny arbeidsflyt"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Avbryt
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={saving || !canCompose}>
            {saving ? 'Oppretter …' : 'Opprett regel'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {!canCompose && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Du har ikke <code>workflows.compose</code>. Be admin om tilgang for å opprette regler.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}

        <label className="block">
          <span className={WPSTD_FORM_FIELD_LABEL}>Navn på arbeidsflyten</span>
          <StandardInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="f.eks. Sjekklist kritisk funn → AMU"
          />
        </label>

        <label className="block">
          <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse (valgfritt)</span>
          <StandardTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            placeholder="Kort beskrivelse av hva regelen gjør og hvilke lover den implementerer."
          />
        </label>

        <label className="block">
          <span className={WPSTD_FORM_FIELD_LABEL}>Modul / scope</span>
          <SearchableSelect
            value={scopeId}
            onChange={(v) => {
              setScopeId(v)
              setEventName('')
            }}
            options={[
              { value: '', label: '— velg modul —' },
              ...scopes.map((s) => ({ value: s.scopeId, label: s.label })),
            ]}
          />
          {scopeId && (
            <p className="mt-1 text-xs text-neutral-500">
              {scopes.find((s) => s.scopeId === scopeId)?.description}
            </p>
          )}
        </label>

        {scopeId && (
          <label className="block">
            <span className={WPSTD_FORM_FIELD_LABEL}>Hendelse / trigger (valgfritt)</span>
            <SearchableSelect
              value={eventName}
              onChange={setEventName}
              options={[{ value: '', label: '— velg hendelse —' }, ...eventOptions]}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Lar deg tomme hvis du vil sette trigger senere i Bygg-fanen.
            </p>
          </label>
        )}

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
          Regelen opprettes som <strong>inaktiv</strong>. Du kan redigere flyten visuelt i
          Bygg-fanen, og aktivere den fra «Mine arbeidsflyter» når den er klar.
          Aktivering av regler med statlig melding krever{' '}
          <code>workflows.activate_external</code>.
        </div>
      </div>
    </SlidePanel>
  )
}
