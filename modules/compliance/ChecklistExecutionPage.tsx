// ChecklistExecutionPage — GjennomforingDetail-style fill-in view.
// Two-column layout: left canvas (section outline + items) + right sidebar
// (progress, metadata, deltakere, lovverk). Sub-tabs: Utfyll / Funn / Historikk.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Lock,
  MessageSquare,
  Minus,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { StandardInput } from '../../src/components/ui/Input'
import { WarningBox, InfoBox } from '../../src/components/ui/AlertBox'
import { useActivePack } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import { parseChecklistDefinition } from './schema'
import { SeverityBadge } from './components/SeverityBadge'
import { PhotoItemControl } from './components/PhotoItemControl'
import { ExecutionCommentThread } from './components/ExecutionCommentThread'
import type {
  ChecklistItem,
  ComplianceAssignableUser,
  ComplianceExecutionRow,
  ComplianceResponseRow,
  ComplianceSeverity,
} from './types'

// ── Display helpers ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ComplianceExecutionRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}

const SEVERITIES: ComplianceSeverity[] = ['low', 'medium', 'high', 'critical']

function statusVariant(status: ComplianceExecutionRow['status']): 'draft' | 'active' | 'signed' {
  if (status === 'signed') return 'signed'
  if (status === 'active') return 'active'
  return 'draft'
}

function readValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

// ── Initials avatar (matches ComboApp design) ───────────────────────────────

function Initials({ name, size = 24 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/)
  const txt = ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: '#e7efe9',
        color: '#1a3d32',
        fontSize: Math.max(9, Math.round(size * 0.42)),
      }}
    >
      {txt}
    </span>
  )
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-neutral-200/70" style={{ height: 4 }}>
      <div
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          height: '100%',
          background: '#1a3d32',
          transition: 'width .35s ease',
        }}
      />
    </div>
  )
}

// ── Section grouping helper ──────────────────────────────────────────────────

type SectionGroup = { name: string; items: ChecklistItem[] }

function groupIntoSections(items: ChecklistItem[]): SectionGroup[] {
  if (items.length === 0) return []
  const map = new Map<string, ChecklistItem[]>()
  for (const it of items) {
    const key = it.section ?? 'Punkter'
    const arr = map.get(key)
    if (arr) arr.push(it)
    else map.set(key, [it])
  }
  return Array.from(map.entries()).map(([name, sectionItems]) => ({ name, items: sectionItems }))
}

// ── Main page ────────────────────────────────────────────────────────────────

type SubTab = 'utfyll' | 'funn' | 'historikk'

export function ChecklistExecutionPage() {
  const params = useParams<{ executionId: string }>()
  const executionId = params.executionId ?? ''
  const navigate = useNavigate()
  const pack = useActivePack()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const cl = useChecklistModule({ supabase })
  const { load, loadDetail, saveResponse, signExecution, updateExecutionMetadata } = cl

  const [activeSectionIdx, setActiveSectionIdx] = useState(0)
  const [activeFinding, setActiveFinding] = useState<Record<string, boolean>>({})
  const [subTab, setSubTab] = useState<SubTab>('utfyll')

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (executionId) void loadDetail(executionId) }, [executionId, loadDetail])

  const execution = useMemo(
    () => cl.executions.find((e) => e.id === executionId) ?? null,
    [cl.executions, executionId],
  )

  const template = useMemo(
    () => cl.templates.find((t) => t.id === execution?.template_id) ?? null,
    [cl.templates, execution?.template_id],
  )

  const definition =
    execution?.status === 'signed' && execution.definition_snapshot
      ? parseChecklistDefinition(execution.definition_snapshot)
      : parseChecklistDefinition(template?.definition)

  const sections = useMemo(() => groupIntoSections(definition.items), [definition.items])

  const responsesByKey = useMemo(() => {
    const list = cl.responsesByExecutionId[executionId] ?? []
    const map: Record<string, ComplianceResponseRow> = {}
    for (const r of list) map[r.item_key] = r
    return map
  }, [cl.responsesByExecutionId, executionId])

  const requiredCount = definition.items.filter((i) => i.required).length
  const requiredAnswered = definition.items.filter((i) => i.required && responsesByKey[i.key]).length
  const allItems = definition.items
  const answeredCount = allItems.filter((i) => responsesByKey[i.key]).length
  const findingsList = Object.values(responsesByKey).filter((r) => r.is_finding)
  const findingsCount = findingsList.length
  const readOnly = execution?.status === 'signed'

  const locationById = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of orgSetup.locations) m.set(l.id, l.name)
    return m
  }, [orgSetup.locations])

  const locationLabel = execution?.location_id
    ? (locationById.get(execution.location_id) ?? '—')
    : execution?.scope_catalogue_item_label ?? execution?.scope_other_label ?? '—'

  const templateBackUrl = useMemo(() => {
    if (template) return `/compliance/checklists?template=${encodeURIComponent(template.slug)}&pack=${encodeURIComponent(template.pack)}`
    if (execution) return `/compliance/checklists?pack=${encodeURIComponent(execution.pack)}`
    return '/compliance/checklists'
  }, [template, execution])

  const onSign = async () => {
    if (!executionId) return
    await signExecution(executionId)
    navigate(templateBackUrl)
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (!execution) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Sjekklister', to: '/compliance/checklists' }, { label: '…' }]}
        title="Laster …"
      >
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}
      </ModulePageShell>
    )
  }

  const activeSection = sections[activeSectionIdx] ?? sections[0]

  // ── Full render ───────────────────────────────────────────────────────────

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Sjekklister', to: '/compliance/checklists' },
        ...(template ? [{ label: template.name, to: templateBackUrl }] : [{ label: pack.pluralLabel, to: templateBackUrl }]),
        { label: execution.title },
      ]}
      title={execution.title}
      description={`${locationLabel} · ${execution.scheduled_for ? fmt(execution.scheduled_for) : ''}`}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={templateBackUrl}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
          {readOnly ? (
            <>
              {execution.archived_at ? (
                <Badge variant="neutral">
                  <span className="inline-flex items-center gap-1"><Archive className="h-3 w-3" />Arkivert</span>
                </Badge>
              ) : (
                <Badge variant="signed">
                  <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />{STATUS_LABEL[execution.status]}</span>
                </Badge>
              )}
              {execution.status === 'signed' && !execution.archived_at ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Archive className="h-3.5 w-3.5" />}
                  onClick={() => {
                    if (window.confirm('Arkivere denne signerte sjekklisten? Handlingen kan ikke angres.')) {
                      void cl.archiveExecution(executionId)
                    }
                  }}
                >
                  Arkiver
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button variant="secondary" icon={<Save className="h-4 w-4" />} onClick={() => navigate(templateBackUrl)}>
                Lagre kladd
              </Button>
              <Button
                variant="primary"
                icon={readOnly ? <ShieldCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                onClick={onSign}
                disabled={requiredAnswered < requiredCount}
              >
                Send til godkjenning
              </Button>
            </>
          )}
        </div>
      }
    >
      {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">

        {/* ── LEFT: main canvas ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-neutral-200/80 bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>

          {/* Sub-tab strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2.5">
            <div className="flex items-center gap-1">
              <Badge variant={statusVariant(execution.status)}>{STATUS_LABEL[execution.status]}</Badge>
              <span className="ml-2 text-xs text-neutral-400">
                {execution.updated_at ? `Sist redigert ${fmt(execution.updated_at)}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {(['utfyll', 'funn', 'historikk'] as SubTab[]).map((t) => {
                const label = t === 'funn' ? `Funn (${findingsCount})` : t === 'utfyll' ? 'Utfyll' : 'Historikk'
                const active = subTab === t
                return (
                  <button
                    key={t}
                    onClick={() => setSubTab(t)}
                    className={[
                      'rounded-md px-2.5 py-1 font-medium transition-colors capitalize',
                      active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Utfyll tab ─────────────────────────────────────────────── */}
          {subTab === 'utfyll' && sections.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)]">
              {/* Section outline */}
              <div className="border-b border-neutral-100 bg-[#fbf9f3] py-3 md:border-b-0 md:border-r">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Seksjoner</div>
                <ul className="mt-1">
                  {sections.map((s, i) => {
                    const done = s.items.filter((it) => responsesByKey[it.key]).length
                    const active = i === activeSectionIdx
                    return (
                      <li key={i}>
                        <button
                          onClick={() => setActiveSectionIdx(i)}
                          className={[
                            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors',
                            active ? 'bg-white font-semibold text-[#1a3d32]' : 'text-neutral-700 hover:bg-white/60',
                          ].join(' ')}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="tabular-nums text-neutral-400">{i + 1}.</span>
                            <span className="truncate">{s.name}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-[10px] text-neutral-400">{done}/{s.items.length}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Active section items */}
              {activeSection && (
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                      {activeSectionIdx + 1}. {activeSection.name}
                    </h3>
                    <span className="text-[11px] tabular-nums text-neutral-500">
                      {activeSection.items.filter((i) => responsesByKey[i.key]).length}/{activeSection.items.length} besvart
                    </span>
                  </div>

                  {readOnly ? (
                    <div className="mt-3">
                      <InfoBox>
                        Sjekklisten er signert {execution.signed_at ? `(${fmt(execution.signed_at)})` : ''}.
                        {' '}Svar er låst — tittel og deltakere kan fortsatt endres.
                      </InfoBox>
                    </div>
                  ) : null}

                  <ul className="mt-3 space-y-2">
                    {activeSection.items.map((item, idx) => (
                      <SectionItemRow
                        key={item.key}
                        item={item}
                        index={idx}
                        response={responsesByKey[item.key]}
                        readOnly={readOnly}
                        isFindingExpanded={activeFinding[item.key] ?? Boolean(responsesByKey[item.key]?.is_finding)}
                        onToggleFinding={() => setActiveFinding((prev) => ({ ...prev, [item.key]: !(prev[item.key] ?? Boolean(responsesByKey[item.key]?.is_finding)) }))}
                        severityLabels={pack.severityLabels}
                        onCommit={(value) => saveResponse({ executionId, itemKey: item.key, value, comment: responsesByKey[item.key]?.comment ?? undefined, severity: responsesByKey[item.key]?.severity ?? undefined })}
                        onCommitFinding={(comment, severity) => saveResponse({ executionId, itemKey: item.key, value: responsesByKey[item.key]?.value ?? {}, comment, severity })}
                        onUploadAttachment={(file) => cl.uploadResponseAttachment({ executionId, itemKey: item.key, file })}
                        onRemoveAttachment={(path) => cl.removeResponseAttachment({ executionId, itemKey: item.key, storagePath: path })}
                        signUrl={cl.signAttachmentUrl}
                      />
                    ))}
                  </ul>

                  {/* Section pagination */}
                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
                    <button
                      className="font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-0"
                      disabled={activeSectionIdx === 0}
                      onClick={() => setActiveSectionIdx((i) => Math.max(0, i - 1))}
                    >
                      ‹ Forrige seksjon
                    </button>
                    {activeSectionIdx < sections.length - 1 ? (
                      <Button variant="primary" size="sm" onClick={() => setActiveSectionIdx((i) => i + 1)}>
                        Neste seksjon ›
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Funn tab ───────────────────────────────────────────────── */}
          {subTab === 'funn' && (
            <div className="p-5">
              {findingsList.length === 0 ? (
                <div className="py-8 text-center text-sm text-neutral-500">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />
                  Ingen funn registrert ennå.
                </div>
              ) : (
                <ul className="space-y-3">
                  {findingsList.map((r) => {
                    const item = definition.items.find((i) => i.key === r.item_key)
                    return (
                      <li key={r.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-neutral-900">{item?.prompt ?? r.item_key}</span>
                          {r.severity ? <SeverityBadge severity={r.severity} /> : null}
                        </div>
                        {r.comment ? (
                          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-900">
                            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                            {r.comment}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ── Historikk tab ──────────────────────────────────────────── */}
          {subTab === 'historikk' && (
            <div className="p-5">
              <ExecutionCommentThread
                executionId={executionId}
                itemKey={null}
                currentUserId={cl.currentUserId}
                comments={cl.commentsByExecutionId[executionId] ?? []}
                members={orgSetup.members}
                onLoad={() => cl.loadComments(executionId)}
                onAdd={cl.addComment}
                onUpdate={cl.updateComment}
                onDelete={cl.deleteComment}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT: sidebar ────────────────────────────────────────────── */}
        <aside className="space-y-4">

          {/* Progress */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Fremdrift</h3>
              <span className="text-base font-bold tabular-nums text-[#1a3d32]">
                {allItems.length > 0 ? Math.round((answeredCount / allItems.length) * 100) : 0}%
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={allItems.length > 0 ? answeredCount / allItems.length : 0} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] tabular-nums text-neutral-500">
              <span>{answeredCount} av {allItems.length} punkter</span>
              <span>{allItems.length - answeredCount} gjenstår</span>
            </div>
            {requiredCount > 0 && (
              <div className="mt-2 text-[11px] text-neutral-500">
                {requiredAnswered}/{requiredCount} påkrevde besvart
              </div>
            )}
          </div>

          {/* Detaljer */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold text-neutral-900">Detaljer</h3>
            <dl className="mt-2 space-y-2 text-[12px]">
              {template ? (
                <div className="flex justify-between gap-2">
                  <dt className="shrink-0 text-neutral-500">Mal</dt>
                  <dd className="text-right text-neutral-900 truncate">{template.name}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-neutral-500">Sted</dt>
                <dd className="text-right text-neutral-900">{locationLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-neutral-500">Opprettet</dt>
                <dd className="text-neutral-900 tabular-nums">{fmt(execution.created_at)}</dd>
              </div>
              {execution.scheduled_for ? (
                <div className="flex justify-between gap-2">
                  <dt className="shrink-0 text-neutral-500">Frist</dt>
                  <dd className="text-neutral-900 tabular-nums">{fmt(execution.scheduled_for)}</dd>
                </div>
              ) : null}
              {execution.signed_at ? (
                <div className="flex justify-between gap-2">
                  <dt className="shrink-0 text-neutral-500">Signert</dt>
                  <dd className="text-neutral-900 tabular-nums">{fmt(execution.signed_at)}</dd>
                </div>
              ) : null}
              {template?.cadence_hint ? (
                <div className="flex justify-between gap-2">
                  <dt className="shrink-0 text-neutral-500">Kadense</dt>
                  <dd className="text-neutral-900 capitalize">{template.cadence_hint}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* Deltakere — org members + free-text attendees */}
          <DeltakereCard
            memberIds={execution.participant_member_ids}
            attendees={execution.attendees}
            assignableUsers={cl.assignableUsers}
            readOnly={readOnly}
            onToggleMember={(memberId, add) => {
              const next = add
                ? [...execution.participant_member_ids, memberId]
                : execution.participant_member_ids.filter((id) => id !== memberId)
              void updateExecutionMetadata({ executionId, participantMemberIds: next })
            }}
            onAddAttendee={(name) => void updateExecutionMetadata({ executionId, attendees: [...execution.attendees, name] })}
            onRemoveAttendee={(name) => void updateExecutionMetadata({ executionId, attendees: execution.attendees.filter((a) => a !== name) })}
          />

          {/* Lovverk */}
          {(template?.law_refs?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold text-neutral-900">Lovverk</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {template!.law_refs.map((ref) => (
                  <span
                    key={ref}
                    className="rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </ModulePageShell>
  )
}

// ── SectionItemRow ────────────────────────────────────────────────────────────
// Renders one checklist item with OK / Avvik / N/A icon buttons on the right,
// expanding finding details below.

type ItemRowProps = {
  item: ChecklistItem
  index: number
  response: ComplianceResponseRow | undefined
  readOnly: boolean
  isFindingExpanded: boolean
  onToggleFinding: () => void
  severityLabels: Record<string, string>
  onCommit: (value: unknown) => void | Promise<void>
  onCommitFinding: (comment: string, severity: ComplianceSeverity) => void | Promise<void>
  onUploadAttachment: (file: File) => Promise<string | null>
  onRemoveAttachment: (path: string) => Promise<void>
  signUrl: (path: string, ttl?: number) => Promise<string | null>
}

function SectionItemRow({
  item, index, response, readOnly, isFindingExpanded, onToggleFinding,
  severityLabels, onCommit, onCommitFinding, onUploadAttachment, onRemoveAttachment, signUrl,
}: ItemRowProps) {
  const value = readValue(response?.value)
  const answered = response !== undefined

  // Determine visual state from the response value for yes_no_na items
  const yesNoState: boolean | null | undefined =
    item.type === 'yes_no_na' ? (value.ok as boolean | null | undefined) : undefined

  const itemState: 'ok' | 'avvik' | 'pending' =
    !answered ? 'pending' :
    response.is_finding ? 'avvik' :
    'ok'

  return (
    <li
      className={[
        'rounded-md border px-3 py-3 transition-colors',
        itemState === 'ok' ? 'border-green-100 bg-green-50/40' :
        itemState === 'avvik' ? 'border-amber-200 bg-amber-50' :
        'border-neutral-200/80 bg-white',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-neutral-400">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-neutral-900">
            {item.prompt}
            {item.required ? <span className="ml-1.5 text-[10px] font-normal text-red-500">Påkrevd</span> : null}
          </div>
          {(item.law_ref || item.iso_clause || item.help) ? (
            <div className="mt-0.5 text-[10px] text-neutral-400">
              {[item.law_ref, item.iso_clause, item.help].filter(Boolean).join(' · ')}
            </div>
          ) : null}

          {/* Finding note */}
          {response?.is_finding && response.comment ? (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200">
              <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              <span className="italic">{response.comment}</span>
              {response.severity ? <SeverityBadge severity={response.severity} /> : null}
            </div>
          ) : null}

          {/* Non-boolean item controls (text, number, etc.) */}
          {item.type !== 'yes_no_na' && (
            <div className="mt-2">
              <ItemControl
                item={item}
                response={response}
                readOnly={readOnly}
                onCommit={onCommit}
                onUploadAttachment={onUploadAttachment}
                onRemoveAttachment={onRemoveAttachment}
                signUrl={signUrl}
              />
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            {item.type === 'yes_no_na' ? (
              <>
                <button
                  title="OK / Ja"
                  onClick={() => onCommit({ ok: true })}
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                    yesNoState === true
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-neutral-200 bg-white text-neutral-400 hover:border-green-500 hover:text-green-600',
                  ].join(' ')}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  title="Avvik / Nei"
                  onClick={() => {
                    void onCommit({ ok: false })
                    if (!isFindingExpanded) onToggleFinding()
                  }}
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                    yesNoState === false || response?.is_finding
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-neutral-200 bg-white text-neutral-400 hover:border-amber-500 hover:text-amber-600',
                  ].join(' ')}
                >
                  <AlertTriangle className="h-4 w-4" />
                </button>
                <button
                  title="Ikke aktuelt"
                  onClick={() => onCommit({ ok: null })}
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                    yesNoState === null && answered
                      ? 'border-neutral-500 bg-neutral-500 text-white'
                      : 'border-neutral-200 bg-white text-neutral-400 hover:border-neutral-400',
                  ].join(' ')}
                >
                  <Minus className="h-4 w-4" />
                </button>
              </>
            ) : (
              /* Flag-as-finding toggle for non-boolean items */
              <button
                title={isFindingExpanded ? 'Fjern funn' : 'Marker som funn'}
                onClick={onToggleFinding}
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                  isFindingExpanded
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-neutral-200 bg-white text-neutral-400 hover:border-amber-500 hover:text-amber-600',
                ].join(' ')}
              >
                {isFindingExpanded ? <Circle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}

        {readOnly && response?.is_finding && response.severity ? (
          <SeverityBadge severity={response.severity} />
        ) : null}
      </div>

      {/* Expanded finding fields */}
      {!readOnly && isFindingExpanded && (
        <div className="mt-3 border-t border-neutral-100 pt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => onCommitFinding(response?.comment ?? '', s)}
                className={[
                  'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
                  response?.severity === s
                    ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400',
                ].join(' ')}
              >
                {severityLabels[s] ?? s}
              </button>
            ))}
          </div>
          <StandardTextarea
            value={response?.comment ?? ''}
            onChange={(e) => onCommitFinding(e.target.value, response?.severity ?? 'medium')}
            placeholder="Beskriv funnet …"
            rows={2}
          />
        </div>
      )}
    </li>
  )
}

// ── Deltakere card ────────────────────────────────────────────────────────────
// Two tiers: org members (tracked, with IDs) + free-text attendees (external).
// Org members come from cl.assignableUsers; toggling saves participantMemberIds.
// Free-text is for external people not in the org (e.g. external auditors).

function DeltakereCard({
  memberIds,
  attendees,
  assignableUsers,
  readOnly,
  onToggleMember,
  onAddAttendee,
  onRemoveAttendee,
}: {
  memberIds: string[]
  attendees: string[]
  assignableUsers: ComplianceAssignableUser[]
  readOnly: boolean
  onToggleMember: (memberId: string, add: boolean) => void
  onAddAttendee: (name: string) => void
  onRemoveAttendee: (name: string) => void
}) {
  const [memberSearch, setMemberSearch] = useState('')
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [attendeeDraft, setAttendeeDraft] = useState('')

  const selectedMembers = assignableUsers.filter((u) => memberIds.includes(u.id))
  const filteredMembers = assignableUsers.filter(
    (u) => !memberIds.includes(u.id) &&
      u.displayName.toLowerCase().includes(memberSearch.toLowerCase()),
  )

  const commitAttendee = () => {
    const name = attendeeDraft.trim()
    if (name && !attendees.includes(name)) onAddAttendee(name)
    setAttendeeDraft('')
  }

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <h3 className="text-sm font-semibold text-neutral-900">Deltakere</h3>

      {/* Org members */}
      <ul className="mt-2 space-y-1.5">
        {selectedMembers.map((u) => (
          <li key={u.id} className="flex items-center gap-2 text-xs">
            <Initials name={u.displayName} size={22} />
            <span className="flex-1 truncate font-medium text-neutral-900">{u.displayName}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onToggleMember(u.id, false)}
                className="text-neutral-300 hover:text-red-500"
                title="Fjern"
              >
                <Minus className="h-3 w-3" />
              </button>
            )}
          </li>
        ))}
        {/* Free-text external attendees */}
        {attendees.map((name, i) => (
          <li key={`ext-${i}`} className="flex items-center gap-2 text-xs">
            <Initials name={name} size={22} />
            <div className="flex-1 min-w-0">
              <span className="block truncate font-medium text-neutral-900">{name}</span>
              <span className="text-[10px] text-neutral-400">Ekstern</span>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onRemoveAttendee(name)}
                className="text-neutral-300 hover:text-red-500"
                title="Fjern"
              >
                <Minus className="h-3 w-3" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Member picker (org employees) */}
      {!readOnly && assignableUsers.length > 0 && (
        <div className="mt-2">
          {showMemberPicker ? (
            <div className="rounded-md border border-neutral-200 bg-white">
              <div className="flex items-center gap-1.5 border-b border-neutral-100 px-2 py-1.5">
                <Search className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
                <input
                  autoFocus
                  type="search"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowMemberPicker(false)}
                  placeholder="Søk ansatt …"
                  className="flex-1 text-xs outline-none bg-transparent placeholder:text-neutral-400"
                />
              </div>
              <ul className="max-h-40 overflow-y-auto py-1">
                {filteredMembers.length === 0 ? (
                  <li className="px-3 py-2 text-[11px] text-neutral-400">Ingen treff</li>
                ) : filteredMembers.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => { onToggleMember(u.id, true); setMemberSearch('') }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-[#e7efe9] hover:text-[#1a3d32]"
                    >
                      <Initials name={u.displayName} size={18} />
                      <span className="truncate">{u.displayName}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-neutral-100 px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => { setShowMemberPicker(false); setMemberSearch('') }}
                  className="text-[11px] text-neutral-500 hover:text-neutral-800"
                >
                  Lukk ›
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMemberPicker(true)}
              className="flex w-full items-center gap-2 rounded-md border border-dashed border-neutral-300 px-2 py-1.5 text-[11px] font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
            >
              <Plus className="h-3 w-3" /> Legg til ansatt
            </button>
          )}
        </div>
      )}

      {/* External / free-text attendees */}
      {!readOnly && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5">
            <StandardInput
              value={attendeeDraft}
              onChange={(e) => setAttendeeDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitAttendee(); if (e.key === 'Escape') setAttendeeDraft('') }}
              placeholder="Ekstern deltaker (navn) …"
              className="h-7 flex-1 text-xs"
            />
            <button
              type="button"
              disabled={!attendeeDraft.trim()}
              onClick={commitAttendee}
              className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
            >
              Legg til
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Per-type response control ─────────────────────────────────────────────────

type ControlProps = {
  item: ChecklistItem
  response: ComplianceResponseRow | undefined
  readOnly: boolean
  onCommit: (value: unknown) => void | Promise<void>
  onUploadAttachment: (file: File) => Promise<string | null>
  onRemoveAttachment: (storagePath: string) => Promise<void>
  signUrl: (storagePath: string, ttlSeconds?: number) => Promise<string | null>
}

function ItemControl({ item, response, readOnly, onCommit, onUploadAttachment, onRemoveAttachment, signUrl }: ControlProps) {
  const value = readValue(response?.value)

  if (item.type === 'yes_no_na') {
    const current = (value.ok as boolean | null | undefined) ?? null
    const opts: { id: 'yes' | 'no' | 'na'; label: string; ok: boolean | null }[] = [
      { id: 'yes', label: 'Ja', ok: true },
      { id: 'no', label: 'Nei', ok: false },
      { id: 'na', label: 'Ikke aktuelt', ok: null },
    ]
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const active =
            (o.id === 'yes' && current === true) ||
            (o.id === 'no' && current === false) ||
            (o.id === 'na' && current === null && response !== undefined)
          return (
            <Button key={o.id} size="sm" variant={active ? 'primary' : 'secondary'} disabled={readOnly} onClick={() => onCommit({ ok: o.ok })}>
              {o.label}
            </Button>
          )
        })}
      </div>
    )
  }

  if (item.type === 'text') {
    return (
      <StandardTextarea
        value={(value.text as string) ?? ''}
        onChange={(e) => onCommit({ text: e.target.value })}
        readOnly={readOnly}
        rows={3}
        placeholder="Skriv svar …"
      />
    )
  }

  if (item.type === 'number') {
    return (
      <StandardInput
        type="number"
        value={typeof value.number === 'number' ? String(value.number) : ''}
        onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onCommit({ number: n }) }}
        readOnly={readOnly}
      />
    )
  }

  if (item.type === 'photo') {
    const urls = Array.isArray(value.urls) ? (value.urls as string[]) : []
    return (
      <PhotoItemControl
        paths={urls}
        readOnly={readOnly}
        onUpload={onUploadAttachment}
        onRemove={onRemoveAttachment}
        signUrl={signUrl}
      />
    )
  }

  if (item.type === 'signature') {
    const signed = value.signedAt as string | undefined
    return signed ? (
      <p className="text-xs text-neutral-700">Signert {new Date(signed).toLocaleString('nb-NO')}</p>
    ) : (
      <Button type="button" variant="primary" size="sm" disabled={readOnly} onClick={() => onCommit({ signedAt: new Date().toISOString() })}>
        Signer punkt
      </Button>
    )
  }

  if (item.type === 'date') {
    return (
      <StandardInput
        type="date"
        value={(value.date as string) ?? ''}
        onChange={(e) => onCommit({ date: e.target.value })}
        readOnly={readOnly}
      />
    )
  }

  return null
}
