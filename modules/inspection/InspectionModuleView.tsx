import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DataTable,
  FormModal,
  ModuleDetailView,
  ModuleListView,
} from '../../template'
import { parseChecklistItems } from './schema'
import type { InspectionFindingRow } from './types'
import { useInspectionModule } from './useInspectionModule'

type InspectionModuleViewProps = {
  supabase: SupabaseClient | null
}

const severityOptions: InspectionFindingRow['severity'][] = ['low', 'medium', 'high', 'critical']

function formatDate(input: string | null) {
  if (!input) return '—'
  try {
    return new Date(input).toLocaleString('nb-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return input
  }
}

function toDateTimeLocalValue(input: string | null): string {
  if (!input) return ''
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function InspectionModuleView({ supabase }: InspectionModuleViewProps) {
  const inspection = useInspectionModule({ supabase })
  const { load } = inspection
  const [createOpen, setCreateOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [newRoundForm, setNewRoundForm] = useState({
    title: '',
    templateId: '',
    locationId: '',
    cronExpression: '',
    scheduledFor: '',
    assignedTo: '',
  })
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    checklistText: '',
  })
  const [newLocationForm, setNewLocationForm] = useState({
    name: '',
    locationCode: '',
    description: '',
  })
  const [scheduleDraft, setScheduleDraft] = useState<
    Record<
      string,
      {
        scheduledFor: string
        cronExpression: string
        assignedTo: string
      }
    >
  >({})
  const [findingDraft, setFindingDraft] = useState<Record<string, { description: string; severity: InspectionFindingRow['severity'] }>>(
    {},
  )

  const openTemplateBuilder = () => setTemplateOpen(true)
  const openLocationEditor = () => setLocationOpen(true)
  const openRoundScheduler = () => setScheduleOpen(true)
  const openRoundCreator = () => setCreateOpen(true)
  const closeRoundCreator = () => setCreateOpen(false)
  const closeTemplateBuilder = () => setTemplateOpen(false)
  const closeLocationEditor = () => setLocationOpen(false)
  const closeRoundScheduler = () => setScheduleOpen(false)

  const templateBuilderButton = (
    <button
      type="button"
      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800"
      onClick={openTemplateBuilder}
    >
      Checklist builder
    </button>
  )

  const locationButton = (
    <button
      type="button"
      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800"
      onClick={openLocationEditor}
    >
      Add location
    </button>
  )

  const schedulingButton = (
    <button
      type="button"
      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800"
      onClick={openRoundScheduler}
    >
      Scheduling
    </button>
  )

  const newRoundButton = (
    <button
      type="button"
      className="rounded-full bg-[#1a3d32] px-3 py-1.5 text-sm font-medium text-white"
      onClick={openRoundCreator}
    >
      New round
    </button>
  )

  useEffect(() => {
    void load()
  }, [load])

  const rounds = inspection.rounds
  const roundById = useMemo(() => {
    const map = new Map<string, typeof rounds[number]>()
    for (const round of rounds) map.set(round.id, round)
    return map
  }, [rounds])
  const stats = useMemo(() => {
    const totals = {
      total: rounds.length,
      draft: 0,
      active: 0,
      signed: 0,
      criticalFindings: 0,
    }
    for (const round of rounds) {
      if (round.status === 'draft') totals.draft += 1
      if (round.status === 'active') totals.active += 1
      if (round.status === 'signed') totals.signed += 1
      const findings = inspection.findingsByRoundId[round.id] ?? []
      totals.criticalFindings += findings.filter((finding) => finding.severity === 'critical').length
    }
    return totals
  }, [rounds, inspection.findingsByRoundId])

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const location of inspection.locations) {
      map.set(location.id, location.name)
    }
    return map
  }, [inspection.locations])

  const templateById = useMemo(() => {
    const map = new Map<string, { name: string; checklistLength: number }>()
    for (const template of inspection.templates) {
      map.set(template.id, {
        name: template.name,
        checklistLength: parseChecklistItems(template.checklist_definition).length,
      })
    }
    return map
  }, [inspection.templates])

  const assignableUserNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of inspection.assignableUsers) map.set(user.id, user.displayName)
    return map
  }, [inspection.assignableUsers])

  const roundsForSchedule = useMemo(
    () =>
      rounds
        .slice()
        .sort((a, b) => {
          if (a.scheduled_for && b.scheduled_for) return a.scheduled_for.localeCompare(b.scheduled_for)
          if (a.scheduled_for) return -1
          if (b.scheduled_for) return 1
          return a.created_at.localeCompare(b.created_at)
        })
        .slice(0, 12),
    [rounds],
  )

  const templateOptions = useMemo(
    () =>
      inspection.templates.map((template) => ({
        id: template.id,
        name: template.name,
      })),
    [inspection.templates],
  )

  const parseChecklistText = (text: string) => {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    return lines.map((line, index) => ({
      key: `item_${index + 1}`,
      label: line,
      required: true,
    }))
  }

  return (
    <>
      <ModuleDetailView
        summary={
          <div className="grid gap-2 sm:grid-cols-5">
            <MetricCard label="Rounds" value={String(stats.total)} />
            <MetricCard label="Draft" value={String(stats.draft)} />
            <MetricCard label="Active" value={String(stats.active)} />
            <MetricCard label="Signed" value={String(stats.signed)} />
            <MetricCard label="Critical findings" value={String(stats.criticalFindings)} />
          </div>
        }
        content={
          <ModuleListView
            toolbar={
              <div className="flex w-full flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Inspection rounds</p>
                  <p className="text-xs text-neutral-600">
                    Critical findings are escalated by DB trigger into deviations + tasks.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {templateBuilderButton}
                  {locationButton}
                  {schedulingButton}
                  {newRoundButton}
                </div>
              </div>
            }
            list={
              <DataTable
                columns={[
                  { key: 'title', header: 'Title' },
                  {
                    key: 'template',
                    header: 'Template',
                    render: (row) => templateById.get(row.template_id)?.name ?? row.template_id,
                  },
                  {
                    key: 'location',
                    header: 'Location',
                    render: (row) => (row.location_id ? locationNameById.get(row.location_id) ?? row.location_id : '—'),
                  },
                  {
                    key: 'assigned_to',
                    header: 'Assigned',
                    render: (row) =>
                      row.assigned_to ? assignableUserNameById.get(row.assigned_to) ?? row.assigned_to : '—',
                  },
                  { key: 'status', header: 'Status' },
                  { key: 'scheduled_for', header: 'Scheduled', render: (row) => formatDate(row.scheduled_for) },
                  { key: 'completed_at', header: 'Completed', render: (row) => formatDate(row.completed_at) },
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (row) => (
                      <div className="flex flex-wrap gap-2">
                        {row.status !== 'signed' ? (
                          <button
                            type="button"
                            className="rounded border border-neutral-300 px-2 py-1 text-xs"
                            onClick={() => void inspection.signRound(row.id)}
                          >
                            Sign off
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">Signed</span>
                        )}
                      </div>
                    ),
                  },
                ]}
                rows={rounds}
                getRowKey={(row) => row.id}
                emptyLabel={inspection.loading ? 'Loading rounds...' : 'No inspection rounds available.'}
              />
            }
          />
        }
        sidebar={
          <div className="space-y-4">
            <section>
              <h3 className="text-sm font-semibold text-neutral-900">Templates</h3>
              <ul className="mt-2 space-y-1 text-xs text-neutral-700">
                {inspection.templates.map((template) => {
                  const info = templateById.get(template.id)
                  return (
                    <li key={template.id} className="rounded border border-neutral-200 p-2">
                      <p className="font-medium">{template.name}</p>
                      <p className="text-neutral-500">{info?.checklistLength ?? 0} checklist items</p>
                    </li>
                  )
                })}
                {inspection.templates.length === 0 ? <li className="text-neutral-500">No templates configured.</li> : null}
              </ul>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-neutral-900">Findings</h3>
              <div className="space-y-2">
                {rounds.slice(0, 4).map((round) => {
                  const existing = inspection.findingsByRoundId[round.id] ?? []
                  const draft = findingDraft[round.id] ?? {
                    description: '',
                    severity: 'medium' as InspectionFindingRow['severity'],
                  }
                  return (
                    <div key={round.id} className="rounded border border-neutral-200 p-2">
                      <p className="text-xs font-medium text-neutral-900">{round.title}</p>
                      <p className="mb-2 text-[11px] text-neutral-500">{existing.length} findings</p>
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          setFindingDraft((previous) => ({
                            ...previous,
                            [round.id]: { ...draft, description: event.target.value },
                          }))
                        }
                        rows={2}
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                        placeholder="Add finding description"
                      />
                      <div className="mt-1 flex items-center gap-2">
                        <select
                          value={draft.severity}
                          onChange={(event) =>
                            setFindingDraft((previous) => ({
                              ...previous,
                              [round.id]: {
                                ...draft,
                                severity: event.target.value as InspectionFindingRow['severity'],
                              },
                            }))
                          }
                          className="rounded border border-neutral-300 px-2 py-1 text-xs"
                        >
                          {severityOptions.map((severity) => (
                            <option key={severity} value={severity}>
                              {severity}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rounded border border-neutral-300 px-2 py-1 text-xs"
                          onClick={async () => {
                            const description = draft.description.trim()
                            if (!description) return
                            await inspection.addFinding({
                              roundId: round.id,
                              description,
                              severity: draft.severity,
                            })
                            setFindingDraft((previous) => ({
                              ...previous,
                              [round.id]: { ...draft, description: '' },
                            }))
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )
                })}
                {rounds.length === 0 ? <p className="text-xs text-neutral-500">Create a round to start registering findings.</p> : null}
              </div>
            </section>
            {inspection.error ? (
              <section className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {inspection.error}
              </section>
            ) : null}
          </div>
        }
      />

      <FormModal
        open={createOpen}
        title="Create inspection round"
        description="Rounds support optional cron expression for recurring schedules."
        actions={
          <>
            <button
              type="button"
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              onClick={closeRoundCreator}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded bg-[#1a3d32] px-3 py-1.5 text-sm font-medium text-white"
              onClick={async () => {
                const selectedTemplateId = newRoundForm.templateId || inspection.templates[0]?.id || ''
                if (!selectedTemplateId || !newRoundForm.title.trim()) return
                await inspection.createRound({
                  templateId: selectedTemplateId,
                  locationId: newRoundForm.locationId || undefined,
                  title: newRoundForm.title,
                  cronExpression: newRoundForm.cronExpression || undefined,
                  scheduledFor: newRoundForm.scheduledFor || undefined,
                  assignedTo: newRoundForm.assignedTo || undefined,
                })
                closeRoundCreator()
                setNewRoundForm((previous) => ({
                  ...previous,
                  title: '',
                  templateId: selectedTemplateId,
                  cronExpression: '',
                  scheduledFor: '',
                  assignedTo: '',
                }))
              }}
            >
              Create
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Title</span>
            <input
              value={newRoundForm.title}
              onChange={(event) => setNewRoundForm((previous) => ({ ...previous, title: event.target.value }))}
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Template</span>
            <select
              value={newRoundForm.templateId || inspection.templates[0]?.id || ''}
              onChange={(event) => setNewRoundForm((previous) => ({ ...previous, templateId: event.target.value }))}
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            >
              {inspection.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Location</span>
            <select
              value={newRoundForm.locationId}
              onChange={(event) => setNewRoundForm((previous) => ({ ...previous, locationId: event.target.value }))}
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            >
              <option value="">(Optional)</option>
              {inspection.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Scheduled for</span>
            <input
              type="datetime-local"
              value={newRoundForm.scheduledFor}
              onChange={(event) => setNewRoundForm((previous) => ({ ...previous, scheduledFor: event.target.value }))}
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-xs text-neutral-500">Cron expression</span>
            <input
              value={newRoundForm.cronExpression}
              onChange={(event) =>
                setNewRoundForm((previous) => ({ ...previous, cronExpression: event.target.value }))
              }
              placeholder="0 7 * * 1"
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-xs text-neutral-500">Assigned to</span>
            <select
              value={newRoundForm.assignedTo}
              onChange={(event) => setNewRoundForm((previous) => ({ ...previous, assignedTo: event.target.value }))}
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            >
              <option value="">(Optional)</option>
              {inspection.assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </FormModal>

      <FormModal
        open={templateOpen}
        title="Checklist builder"
        description="Create reusable checklist templates for inspection rounds."
        actions={
          <>
            <button
              type="button"
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              onClick={closeTemplateBuilder}
            >
              Close
            </button>
            <button
              type="button"
              className="rounded bg-[#1a3d32] px-3 py-1.5 text-sm font-medium text-white"
              onClick={async () => {
                const name = newTemplateForm.name.trim()
                if (!name) return
                await inspection.createTemplate({
                  name,
                  checklistItems: parseChecklistText(newTemplateForm.checklistText),
                })
                setNewTemplateForm({ name: '', checklistText: '' })
                closeTemplateBuilder()
              }}
            >
              Save template
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Template name</span>
            <input
              value={newTemplateForm.name}
              onChange={(event) =>
                setNewTemplateForm((previous) => ({ ...previous, name: event.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Checklist items (one line per item)</span>
            <textarea
              value={newTemplateForm.checklistText}
              onChange={(event) =>
                setNewTemplateForm((previous) => ({ ...previous, checklistText: event.target.value }))
              }
              rows={6}
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
              placeholder={'Emergency exits clear\nFire extinguishers accessible\nPPE available'}
            />
          </label>
          <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
            <p className="mb-1 text-xs font-medium text-neutral-700">Existing templates</p>
            <ul className="space-y-1 text-xs text-neutral-600">
              {templateOptions.map((template) => (
                <li key={template.id}>{template.name}</li>
              ))}
              {templateOptions.length === 0 ? <li>No templates available.</li> : null}
            </ul>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={locationOpen}
        title="Inspection location"
        description="Add a location/object used in inspection rounds."
        actions={
          <>
            <button
              type="button"
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
              onClick={closeLocationEditor}
            >
              Close
            </button>
            <button
              type="button"
              className="rounded bg-[#1a3d32] px-3 py-1.5 text-sm font-medium text-white"
              onClick={async () => {
                const name = newLocationForm.name.trim()
                if (!name) return
                await inspection.createLocation({
                  name,
                  locationCode: newLocationForm.locationCode,
                  description: newLocationForm.description,
                })
                setNewLocationForm({ name: '', locationCode: '', description: '' })
                closeLocationEditor()
              }}
            >
              Save location
            </button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Name</span>
            <input
              value={newLocationForm.name}
              onChange={(event) =>
                setNewLocationForm((previous) => ({ ...previous, name: event.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Code</span>
            <input
              value={newLocationForm.locationCode}
              onChange={(event) =>
                setNewLocationForm((previous) => ({ ...previous, locationCode: event.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-neutral-500">Description</span>
            <textarea
              value={newLocationForm.description}
              onChange={(event) =>
                setNewLocationForm((previous) => ({ ...previous, description: event.target.value }))
              }
              rows={3}
              className="w-full rounded border border-neutral-300 px-2 py-1.5"
            />
          </label>
        </div>
      </FormModal>

      <FormModal
        open={scheduleOpen}
        title="Round scheduling"
        description="Configure cron, assignment, and planned execution for recurring rounds."
        actions={
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
            onClick={closeRoundScheduler}
          >
            Close
          </button>
        }
      >
        <div className="space-y-3">
          {roundsForSchedule.map((round) => {
            const currentDraft = scheduleDraft[round.id] ?? {
              scheduledFor: round.scheduled_for ?? '',
              cronExpression: round.cron_expression ?? '',
              assignedTo: round.assigned_to ?? '',
            }
            return (
              <div key={round.id} className="rounded border border-neutral-200 p-3">
                <p className="text-sm font-medium text-neutral-900">{round.title}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(currentDraft.scheduledFor || null)}
                    onChange={(event) =>
                      setScheduleDraft((previous) => ({
                        ...previous,
                        [round.id]: { ...currentDraft, scheduledFor: event.target.value },
                      }))
                    }
                    className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={currentDraft.cronExpression}
                    onChange={(event) =>
                      setScheduleDraft((previous) => ({
                        ...previous,
                        [round.id]: { ...currentDraft, cronExpression: event.target.value },
                      }))
                    }
                    className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
                    placeholder="0 7 * * 1"
                  />
                  <select
                    value={currentDraft.assignedTo}
                    onChange={(event) =>
                      setScheduleDraft((previous) => ({
                        ...previous,
                        [round.id]: { ...currentDraft, assignedTo: event.target.value },
                      }))
                    }
                    className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">(Unassigned)</option>
                    {inspection.assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-neutral-300 px-2 py-1 text-xs"
                    onClick={() =>
                      void inspection.updateRoundSchedule({
                        roundId: round.id,
                        scheduledFor: currentDraft.scheduledFor || undefined,
                        cronExpression: currentDraft.cronExpression || undefined,
                        assignedTo: currentDraft.assignedTo || undefined,
                        status: roundById.get(round.id)?.status === 'draft' ? 'active' : undefined,
                      })
                    }
                  >
                    Save schedule
                  </button>
                </div>
              </div>
            )
          })}
          {roundsForSchedule.length === 0 ? (
            <p className="text-sm text-neutral-500">No rounds available yet. Create one to configure scheduling.</p>
          ) : null}
        </div>
      </FormModal>
    </>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  )
}
