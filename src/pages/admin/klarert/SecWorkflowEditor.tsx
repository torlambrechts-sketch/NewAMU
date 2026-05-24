// Lokal workflow-redigerer brukt fra Arbeidsflyt-seksjonen.
// Bygger på workflow_rules-strukturen i DB. For å unngå duplisering
// av den større canvas-baserte redigereren ved /workflow, åpner denne
// en kompakt utgave for redigering av navn/beskrivelse/aktivering +
// peker videre for trigger- og handlings-redigering.

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarPlus,
  Clock,
  Database,
  ExternalLink,
  Flag,
  GraduationCap,
  ListTodo,
  Loader2,
  Mail,
  MessageSquare,
  Save,
  Send,
  UserCheck,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import type { ElementType } from 'react'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { StandardTextarea } from '../../../components/ui/Textarea'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import {
  ADMIN_SERIF,
  AdminCard,
  AdminError,
  AdminLoading,
} from './AdminShared'
import type {
  WorkflowAction,
  WorkflowRuleRow,
  WorkflowXorActionsEnvelope,
} from '../../../types/workflow'

interface SecWorkflowEditorProps {
  ruleId: string | 'new'
  onBack: () => void
}

interface EventOption {
  id: string
  module: string
  label: string
  properties: string[]
}

const EVENT_LIBRARY: EventOption[] = [
  {
    id: 'avvik.created',
    module: 'Register · Avvik',
    label: 'Nytt avvik registrert',
    properties: ['severity', 'location', 'category'],
  },
  {
    id: 'avvik.critical',
    module: 'Register · Avvik',
    label: 'Kritisk avvik registrert',
    properties: ['title', 'location'],
  },
  {
    id: 'check.completed',
    module: 'Sjekklister',
    label: 'Sjekkliste fullført',
    properties: ['template', 'findings', 'score'],
  },
  {
    id: 'check.overdue',
    module: 'Sjekklister',
    label: 'Sjekkliste forsinket',
    properties: ['template', 'assignee'],
  },
  {
    id: 'hmskort.expiring',
    module: 'Register · HMS-kort',
    label: 'HMS-kort utløper innen 60 dager',
    properties: ['employee', 'expiresAt'],
  },
  {
    id: 'sds.expired',
    module: 'Register · Stoffkartotek',
    label: 'SDS utgått',
    properties: ['chemical', 'location'],
  },
  {
    id: 'sykefravar.long',
    module: 'Register · Sykefravær',
    label: 'Sykefravær overstiger 7 dager',
    properties: ['employee', 'days'],
  },
  {
    id: 'amu.scheduled',
    module: 'Møter',
    label: 'AMU-møte planlagt',
    properties: ['date', 'attendees'],
  },
  {
    id: 'doc.review',
    module: 'Dokumenter',
    label: 'Dokument forfaller til revisjon',
    properties: ['document', 'reviewer'],
  },
  {
    id: 'course.stalled',
    module: 'Opplæring',
    label: 'Læring ikke startet etter 7 dager',
    properties: ['learner', 'course'],
  },
  {
    id: 'survey.completed',
    module: 'Undersøkelser',
    label: 'Undersøkelse avsluttet',
    properties: ['title', 'responseRate'],
  },
  {
    id: 'employee.hired',
    module: 'Register · Personal',
    label: 'Ny ansatt opprettet (via NAV Aa)',
    properties: ['employee', 'role'],
  },
]

interface ActionTypeOption {
  id: string
  label: string
  icon: ElementType
}

const ACTION_LIBRARY: ActionTypeOption[] = [
  { id: 'create_task', label: 'Opprett oppgave', icon: ListTodo },
  { id: 'assign_task', label: 'Tildel ansvarlig', icon: UserCheck },
  { id: 'send_notification', label: 'Send varsel til bruker', icon: Bell },
  { id: 'send_email', label: 'Send e-post', icon: Mail },
  { id: 'slack.post', label: 'Post til Slack-kanal', icon: MessageSquare },
  { id: 'teams.post', label: 'Post til Teams-kanal', icon: MessageSquare },
  { id: 'add_amu_agenda_item', label: 'Legg til AMU-agendapunkt', icon: CalendarPlus },
  { id: 'assign_course', label: 'Tildel kurs', icon: GraduationCap },
  { id: 'doc.flag', label: 'Merk dokument', icon: Flag },
  { id: 'create_deviation', label: 'Opprett avvik', icon: Database },
  { id: 'altinn_send_melding', label: 'Send rapport til Altinn', icon: Send },
  { id: 'wait_delay', label: 'Vent i …', icon: Clock },
]

interface FilterRow {
  field: string
  op: '=' | '≠' | '>' | '<' | '>=' | '<=' | 'contains'
  value: string
}

function actionsAsList(
  json: WorkflowAction[] | WorkflowXorActionsEnvelope | undefined,
): WorkflowAction[] {
  if (!json) return []
  if (Array.isArray(json)) return json
  const env = json as WorkflowXorActionsEnvelope & Record<string, unknown>
  if (Array.isArray(env.branches)) {
    const all: WorkflowAction[] = []
    for (const b of env.branches as { actions?: WorkflowAction[] }[]) {
      if (Array.isArray(b.actions)) all.push(...b.actions)
    }
    return all
  }
  return []
}

export function SecWorkflowEditor({ ruleId, onBack }: SecWorkflowEditorProps) {
  const { supabase, organization } = useOrgSetupContext()
  const isNew = ruleId === 'new'
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(isNew ? 'Ny arbeidsflyt' : '')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [eventId, setEventId] = useState('')
  const [filters, setFilters] = useState<FilterRow[]>([])
  const [actions, setActions] = useState<WorkflowAction[]>([])
  const [originalRule, setOriginalRule] = useState<WorkflowRuleRow | null>(null)

  useEffect(() => {
    if (isNew) return
    if (!supabase || !organization?.id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const { data, error: e } = await supabase
          .from('workflow_rules')
          .select('*')
          .eq('id', ruleId)
          .eq('organization_id', organization.id)
          .maybeSingle()
        if (e) throw e
        if (!data || cancelled) return
        const row = data as WorkflowRuleRow
        setOriginalRule(row)
        setName(row.name)
        setDescription(row.description ?? '')
        setEnabled(row.is_active)
        setEventId(row.trigger_event_name ?? '')
        setActions(actionsAsList(row.actions_json))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke laste regel')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id, ruleId, isNew])

  const eventInfo = useMemo(() => EVENT_LIBRARY.find((e) => e.id === eventId), [eventId])

  function addFilter() {
    setFilters((prev) => [
      ...prev,
      { field: eventInfo?.properties[0] ?? '', op: '=', value: '' },
    ])
  }
  function updateFilter(i: number, patch: Partial<FilterRow>) {
    setFilters((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  }
  function removeFilter(i: number) {
    setFilters((prev) => prev.filter((_, j) => j !== i))
  }

  function addAction(type: string) {
    setActions((prev) => [...prev, { type, config: {} } as unknown as WorkflowAction])
  }
  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, j) => j !== i))
  }
  function moveAction(i: number, dir: -1 | 1) {
    setActions((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      return next
    })
  }

  async function save() {
    if (!supabase || !organization?.id) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name,
        description,
        is_active: enabled,
        trigger_event_name: eventId || null,
        actions_json: actions,
      }
      if (isNew) {
        const { error: e } = await supabase.from('workflow_rules').insert({
          ...payload,
          organization_id: organization.id,
          slug:
            'wf-' +
            Math.random().toString(36).slice(2, 8) +
            '-' +
            Math.random().toString(36).slice(2, 8),
          source_module: eventInfo?.module.toLowerCase().split(' ')[0] ?? 'workflow',
          trigger_on: 'insert',
          trigger_type: 'db_event',
          condition_json: { match: 'always' },
          priority: 100,
          is_template: false,
        })
        if (e) throw e
      } else {
        const { error: e } = await supabase
          .from('workflow_rules')
          .update(payload)
          .eq('id', ruleId)
          .eq('organization_id', organization.id)
        if (e) throw e
      }
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading label="Laster arbeidsflyt…" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          onClick={onBack}
        >
          Tilbake til arbeidsflyter
        </Button>
        {!isNew && originalRule ? (
          <a
            href={`/workflow?rule=${encodeURIComponent(ruleId)}`}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Åpne i full byggekanvas
          </a>
        ) : null}
      </div>

      {error ? <AdminError message={error} /> : null}

      <AdminCard className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <StandardInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Navn på arbeidsflyt"
              className="w-full border-none bg-transparent p-0 text-2xl font-bold tracking-tight text-neutral-900 outline-none focus:bg-amber-50/40"
              style={{ fontFamily: ADMIN_SERIF }}
            />
            <StandardTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beskriv hva flyten gjør…"
              rows={2}
              className="mt-2 w-full resize-none border-none bg-transparent p-0 text-sm text-neutral-600 outline-none focus:bg-amber-50/40"
            />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs">
              <span className="text-neutral-600">{enabled ? 'Aktiv' : 'Utkast'}</span>
              <Button
                variant="ghost"
                onClick={() => setEnabled(!enabled)}
                className={
                  'relative h-5 w-9 cursor-pointer rounded-full border-transparent p-0 transition-colors hover:bg-transparent ' +
                  (enabled ? 'bg-[#1a3d32] hover:bg-[#143028]' : 'bg-neutral-300 hover:bg-neutral-400')
                }
                aria-pressed={enabled}
                aria-label="Aktiver"
              >
                <span
                  className={
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ' +
                    (enabled ? 'translate-x-4' : 'translate-x-0.5')
                  }
                />
              </Button>
            </label>
            <Button
              variant="primary"
              size="sm"
              icon={saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              onClick={() => void save()}
              disabled={saving}
            >
              Lagre
            </Button>
          </div>
        </div>
      </AdminCard>

      <AdminCard className="p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-700">Når…</h3>
          <span className="text-[11px] text-neutral-500">Hendelsen som utløser flyten</span>
        </div>

        <div className="mt-3 space-y-2">
          {/* Native select beholdes her — SearchableSelect støtter ikke optgroup. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-[#1a3d32] focus:bg-white"
          >
            <option value="">Velg en hendelse…</option>
            {Object.entries(
              EVENT_LIBRARY.reduce<Record<string, EventOption[]>>((acc, e) => {
                ;(acc[e.module] = acc[e.module] || []).push(e)
                return acc
              }, {}),
            ).map(([mod, evs]) => (
              <optgroup key={mod} label={mod}>
                {evs.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {eventInfo && (
            <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                Tilgjengelige felt
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {eventInfo.properties.map((p) => (
                  <code key={p} className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-blue-900">
                    event.{p}
                  </code>
                ))}
              </div>
            </div>
          )}

          {eventInfo && (
            <div>
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Betingelser (alle må være sanne)
                </div>
                <Button
                  variant="ghost"
                  onClick={addFilter}
                  className="border-transparent p-0 text-[10px] font-medium text-neutral-500 hover:bg-transparent hover:text-[#1a3d32]"
                >
                  + Legg til betingelse
                </Button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {filters.length === 0 && (
                  <li className="rounded border border-dashed border-neutral-200 px-3 py-2 text-center text-[11px] text-neutral-500">
                    Ingen betingelser — flyten utløses ved alle slike hendelser
                  </li>
                )}
                {filters.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white p-2"
                  >
                    {/* Kompakt inline native select for filter-rad. */}
                    {/* eslint-disable-next-line no-restricted-syntax */}
                    <select
                      value={f.field}
                      onChange={(e) => updateFilter(i, { field: e.target.value })}
                      className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-xs outline-none focus:border-[#1a3d32]"
                    >
                      {eventInfo.properties.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    {/* Kompakt inline native select for sammenligningsoperator. */}
                    {/* eslint-disable-next-line no-restricted-syntax */}
                    <select
                      value={f.op}
                      onChange={(e) =>
                        updateFilter(i, { op: e.target.value as FilterRow['op'] })
                      }
                      className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-xs outline-none focus:border-[#1a3d32]"
                    >
                      <option>=</option>
                      <option>≠</option>
                      <option>&gt;</option>
                      <option>&lt;</option>
                      <option>&gt;=</option>
                      <option>&lt;=</option>
                      <option>contains</option>
                    </select>
                    <StandardInput
                      value={f.value}
                      onChange={(e) => updateFilter(i, { value: e.target.value })}
                      placeholder="verdi"
                      className="flex-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs outline-none focus:border-[#1a3d32]"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => removeFilter(i)}
                      className="rounded border-transparent p-1 text-neutral-400 hover:bg-red-50 hover:text-red-700"
                      aria-label="Fjern betingelse"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AdminCard>

      <div className="flex justify-center">
        <span className="flex h-6 w-px bg-neutral-300" />
      </div>

      <AdminCard className="p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1a3d32] text-white">
            <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-700">
            … så gjør
          </h3>
          <span className="text-[11px] text-neutral-500">Handlinger utføres i rekkefølge</span>
        </div>

        <ol className="mt-3 space-y-2">
          {actions.length === 0 && (
            <li className="rounded border-2 border-dashed border-neutral-200 px-3 py-6 text-center text-[12px] text-neutral-500">
              Ingen handlinger ennå — velg fra paletten under
            </li>
          )}
          {actions.map((a, i) => {
            const meta = ACTION_LIBRARY.find((x) => x.id === (a as { type: string }).type)
            const Icon = meta?.icon ?? Zap
            const config = (a as { config?: Record<string, unknown> }).config ?? {}
            return (
              <li key={i} className="group rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold tabular-nums text-neutral-400">{i + 1}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fbf9f3] text-[#1a3d32]">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-neutral-900">
                      {meta?.label ?? (a as { type: string }).type}
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
                      {Object.entries(config).map(([k, v]) => (
                        <div
                          key={k}
                          className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-1"
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                            {k}
                          </span>
                          <div className="text-neutral-800">{String(v)}</div>
                        </div>
                      ))}
                      {Object.keys(config).length === 0 && (
                        <div className="col-span-2 text-[11px] italic text-neutral-400">
                          Klikk for å konfigurere
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="hidden items-center gap-0.5 group-hover:inline-flex">
                    <Button
                      variant="ghost"
                      onClick={() => moveAction(i, -1)}
                      className="rounded border-transparent p-1 text-neutral-400 hover:bg-neutral-100"
                      aria-label="Flytt opp"
                    >
                      <ArrowLeft className="h-3 w-3 rotate-90" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => moveAction(i, 1)}
                      className="rounded border-transparent p-1 text-neutral-400 hover:bg-neutral-100"
                      aria-label="Flytt ned"
                    >
                      <ArrowRight className="h-3 w-3 rotate-90" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => removeAction(i)}
                      className="rounded border-transparent p-1 text-neutral-400 hover:bg-red-50 hover:text-red-700"
                      aria-label="Fjern handling"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </span>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-3 rounded-md bg-[#fbf9f3] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Legg til handling
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {ACTION_LIBRARY.map((a) => {
              const Icon = a.icon
              return (
                <Button
                  key={a.id}
                  variant="ghost"
                  onClick={() => addAction(a.id)}
                  className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-left text-[11px] font-medium text-neutral-700 transition-colors hover:border-[#1a3d32] hover:bg-[#e7efe9]/30 hover:text-[#1a3d32]"
                >
                  <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{a.label}</span>
                </Button>
              )
            })}
          </div>
        </div>
      </AdminCard>
    </div>
  )
}
