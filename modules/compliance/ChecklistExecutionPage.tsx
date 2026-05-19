// ChecklistExecutionPage — fill-in-the-checklist + sign view.
// One row per checklist item from the template (or definition_snapshot if signed).
// Each row supports: response value (per item.type), optional finding flag with
// severity + comment. Saves each response on commit. Signing locks the row.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, CheckCircle2, Circle, Lock, ShieldCheck } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
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
import { ExecutionMetadataPanel } from './components/ExecutionMetadataPanel'
import { ExecutionCommentThread } from './components/ExecutionCommentThread'
import { EntityTimeline } from '../../src/components/audit/EntityTimeline'
// Side-effect import — registers the compliance_checklist audit scope
// before <EntityTimeline> first renders. See specs/endringslogg-spec.md §5.
import './audit/complianceChecklistAuditScope'
import type {
  ChecklistItem,
  ComplianceExecutionRow,
  ComplianceResponseRow,
  ComplianceSeverity,
} from './types'

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

export function ChecklistExecutionPage() {
  const params = useParams<{ executionId: string }>()
  const executionId = params.executionId ?? ''
  const navigate = useNavigate()
  const pack = useActivePack()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const cl = useChecklistModule({ supabase })
  const { load, loadDetail, saveResponse, signExecution, updateExecutionMetadata } = cl

  const [activeFinding, setActiveFinding] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (executionId) void loadDetail(executionId)
  }, [executionId, loadDetail])

  const execution = useMemo(
    () => cl.executions.find((e) => e.id === executionId) ?? null,
    [cl.executions, executionId],
  )

  const template = useMemo(
    () => cl.templates.find((t) => t.id === execution?.template_id) ?? null,
    [cl.templates, execution?.template_id],
  )

  // After sign, show the snapshot. Before sign, show the live template definition.
  // React Compiler handles memoization — manual useMemo deps are too brittle here
  // because both branches feed parseChecklistDefinition.
  const definition =
    execution?.status === 'signed' && execution.definition_snapshot
      ? parseChecklistDefinition(execution.definition_snapshot)
      : parseChecklistDefinition(template?.definition)

  const responsesByKey = useMemo(() => {
    const list = cl.responsesByExecutionId[executionId] ?? []
    const map: Record<string, ComplianceResponseRow> = {}
    for (const r of list) map[r.item_key] = r
    return map
  }, [cl.responsesByExecutionId, executionId])

  const requiredCount = definition.items.filter((i) => i.required).length
  const requiredAnswered = definition.items.filter(
    (i) => i.required && responsesByKey[i.key],
  ).length
  const findingsCount = Object.values(responsesByKey).filter((r) => r.is_finding).length
  const readOnly = execution?.status === 'signed'

  // Back link returns to the template's execution list (?template=…&pack=…)
  // when we know which template this came from. Without that, we fall back
  // to the pack lens; without that, the hub.
  const templateBackUrl = useMemo(() => {
    if (template) {
      return `/compliance/checklists?template=${encodeURIComponent(template.slug)}&pack=${encodeURIComponent(template.pack)}`
    }
    if (execution) {
      return `/compliance/checklists?pack=${encodeURIComponent(execution.pack)}`
    }
    return '/compliance/checklists'
  }, [template, execution])

  const onSign = async () => {
    if (!executionId) return
    await signExecution(executionId)
    // Land back on the template page so the user sees their newly-signed
    // checklist in the list and can start the next one.
    navigate(templateBackUrl)
  }

  if (!execution) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Sjekklister', to: '/compliance/checklists' },
          { label: '…' },
        ]}
        title="Laster …"
      >
        <div className="space-y-6">
          {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}
        </div>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Sjekklister', to: '/compliance/checklists' },
        ...(template
          ? [{ label: template.name, to: templateBackUrl }]
          : [{ label: pack.pluralLabel, to: templateBackUrl }]),
        { label: execution.title },
      ]}
      title={execution.title}
      description={template?.name ?? ''}
      headerActions={
        <div className="flex items-center gap-2">
          <Link
            to={templateBackUrl}
            className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
          {readOnly ? (
            <>
              {execution.archived_at ? (
                <Badge variant="neutral">
                  <span className="inline-flex items-center gap-1">
                    <Archive className="h-3 w-3" />
                    Arkivert
                  </span>
                </Badge>
              ) : (
                <Badge variant="signed">
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    {STATUS_LABEL[execution.status]}
                  </span>
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
            <Button
              variant="primary"
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={onSign}
              disabled={requiredAnswered < requiredCount}
            >
              Signer
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(execution.status)}>{STATUS_LABEL[execution.status]}</Badge>
          <span className="text-sm text-neutral-600">
            {requiredAnswered} / {requiredCount} påkrevde besvart
          </span>
          {findingsCount > 0 ? (
            <span className="text-sm text-neutral-600">· {findingsCount} funn</span>
          ) : null}
        </div>

        {readOnly ? (
          <InfoBox>
            Sjekklisten er signert {execution.signed_at ? `(${new Date(execution.signed_at).toLocaleString('nb-NO')})` : ''}.
            {' '}Svar og spørsmål er låst, men tittel, sammendrag og deltakere kan fortsatt redigeres som etterregistrering.
          </InfoBox>
        ) : null}

        <ExecutionMetadataPanel
          execution={execution}
          templateMetadataSchema={template?.metadata_schema ?? null}
          assignableUsers={cl.assignableUsers}
          locations={orgSetup.locations}
          departments={orgSetup.departments}
          teams={orgSetup.teams}
          members={orgSetup.members}
          onSave={(payload) => updateExecutionMetadata({ executionId, ...payload })}
        />

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

        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Punkter</h2>
          <p className="mt-1.5 text-sm text-neutral-600">
            Besvar hvert punkt. Marker som funn for å registrere avvik —
            kritiske funn oppretter automatisk et avvik.
          </p>
          <ul className="mt-5 space-y-3">
            {definition.items.map((item) => {
              const response = responsesByKey[item.key]
              const isFindingExpanded = activeFinding[item.key] ?? Boolean(response?.is_finding)

              return (
                <li
                  key={item.key}
                  className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">
                        {item.prompt}
                        {item.required ? (
                          <span className="ml-1.5 text-xs font-normal text-red-600">Påkrevd</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {item.law_ref ?? item.iso_clause ?? ''}
                        {item.help ? ` · ${item.help}` : ''}
                      </p>
                    </div>
                    {response?.is_finding && response.severity ? (
                      <SeverityBadge severity={response.severity} />
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <ItemControl
                      item={item}
                      response={response}
                      readOnly={readOnly}
                      onCommit={(value) =>
                        saveResponse({
                          executionId,
                          itemKey: item.key,
                          value,
                          comment: response?.comment ?? undefined,
                          severity: response?.severity ?? undefined,
                        })
                      }
                      onUploadAttachment={(file) =>
                        cl.uploadResponseAttachment({
                          executionId,
                          itemKey: item.key,
                          file,
                        })
                      }
                      onRemoveAttachment={(storagePath) =>
                        cl.removeResponseAttachment({
                          executionId,
                          itemKey: item.key,
                          storagePath,
                        })
                      }
                      signUrl={cl.signAttachmentUrl}
                    />
                  </div>

                  {!readOnly ? (
                    <div className="mt-3 border-t border-neutral-200/80 pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActiveFinding((prev) => ({
                            ...prev,
                            [item.key]: !isFindingExpanded,
                          }))
                        }
                        icon={
                          isFindingExpanded ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )
                        }
                        className="px-0 font-medium text-neutral-600 hover:bg-transparent hover:text-neutral-900"
                      >
                        Marker som funn
                      </Button>

                      {isFindingExpanded ? (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {SEVERITIES.map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant={response?.severity === s ? 'primary' : 'secondary'}
                                onClick={() =>
                                  saveResponse({
                                    executionId,
                                    itemKey: item.key,
                                    value: response?.value ?? {},
                                    comment: response?.comment ?? undefined,
                                    severity: s,
                                  })
                                }
                              >
                                {pack.severityLabels[s]}
                              </Button>
                            ))}
                          </div>
                          <StandardTextarea
                            value={response?.comment ?? ''}
                            onChange={(e) =>
                              saveResponse({
                                executionId,
                                itemKey: item.key,
                                value: response?.value ?? {},
                                comment: e.target.value,
                                severity: response?.severity ?? item.severity_default ?? 'medium',
                              })
                            }
                            placeholder="Beskriv funnet …"
                            rows={3}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </ModuleSectionCard>
        </div>
        <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-6rem)]">
          <EntityTimeline
            supabase={supabase}
            entityKind="compliance_checklist_execution"
            entityId={executionId}
            accent="#1a3d32"
          />
        </div>
      </div>
    </ModulePageShell>
  )
}

// ── Per-type response control ───────────────────────────────────────────────

type ControlProps = {
  item: ChecklistItem
  response: ComplianceResponseRow | undefined
  readOnly: boolean
  onCommit: (value: unknown) => void | Promise<void>
  onUploadAttachment: (file: File) => Promise<string | null>
  onRemoveAttachment: (storagePath: string) => Promise<void>
  signUrl: (storagePath: string, ttlSeconds?: number) => Promise<string | null>
}

function ItemControl({
  item,
  response,
  readOnly,
  onCommit,
  onUploadAttachment,
  onRemoveAttachment,
  signUrl,
}: ControlProps) {
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
            <Button
              key={o.id}
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              disabled={readOnly}
              onClick={() => onCommit({ ok: o.ok })}
              className={readOnly ? 'cursor-not-allowed opacity-60' : undefined}
            >
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
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onCommit({ number: n })
        }}
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
      <p className="text-xs text-neutral-700">
        Signert {new Date(signed).toLocaleString('nb-NO')}
      </p>
    ) : (
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={readOnly}
        onClick={() => onCommit({ signedAt: new Date().toISOString() })}
      >
        Signer punkt
      </Button>
    )
  }

  if (item.type === 'date') {
    const dateVal = (value.date as string) ?? ''
    return (
      <StandardInput
        type="date"
        value={dateVal}
        onChange={(e) => onCommit({ date: e.target.value })}
        readOnly={readOnly}
      />
    )
  }

  return null
}
