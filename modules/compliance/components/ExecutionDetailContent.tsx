// ExecutionDetailContent — headless body of a checklist execution.
//
// Renders item list + metadata panel + comment thread without page chrome.
// Used by ChecklistsLibraryPage (panel + full-view) and ChecklistExecutionPage
// (wrapped in ModulePageShell). No routing, no shell, no navigation.

import { useMemo, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { Badge } from '../../../src/components/ui/Badge'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { StandardInput } from '../../../src/components/ui/Input'
import { InfoBox } from '../../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { ExecutionMetadataPanel } from './ExecutionMetadataPanel'
import { ExecutionCommentThread } from './ExecutionCommentThread'
import { SeverityBadge } from './SeverityBadge'
import { PhotoItemControl } from './PhotoItemControl'
import { parseChecklistDefinition } from '../schema'
import type { ChecklistModuleState } from '../useChecklistModule'
import type { OrgSetupValue } from '../../../src/context/orgSetupContext'
import type { CompliancePack } from '../../../src/lib/compliance/packs'
import type {
  ChecklistItem,
  ComplianceResponseRow,
  ComplianceSeverity,
} from '../types'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}

function statusVariant(status: string): 'draft' | 'active' | 'signed' {
  if (status === 'signed') return 'signed'
  if (status === 'active') return 'active'
  return 'draft'
}

function readValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

type Props = {
  executionId: string
  cl: ChecklistModuleState
  orgSetup: OrgSetupValue
  pack: CompliancePack
}

export function ExecutionDetailContent({ executionId, cl, orgSetup, pack }: Props) {
  const [activeFinding, setActiveFinding] = useState<Record<string, boolean>>({})

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

  const responsesByKey = useMemo(() => {
    const list = cl.responsesByExecutionId[executionId] ?? []
    const map: Record<string, ComplianceResponseRow> = {}
    for (const r of list) map[r.item_key] = r
    return map
  }, [cl.responsesByExecutionId, executionId])

  if (!execution) {
    return <p className="py-8 text-center text-sm text-neutral-500">Laster …</p>
  }

  const requiredCount = definition.items.filter((i) => i.required).length
  const requiredAnswered = definition.items.filter(
    (i) => i.required && responsesByKey[i.key],
  ).length
  const findingsCount = Object.values(responsesByKey).filter((r) => r.is_finding).length
  const readOnly = execution.status === 'signed'

  return (
    <div className="space-y-5">
      {/* Status + progress */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={statusVariant(execution.status)}>{STATUS_LABEL[execution.status] ?? execution.status}</Badge>
        <span className="text-sm text-neutral-600">
          {requiredAnswered} / {requiredCount} påkrevde besvart
        </span>
        {findingsCount > 0 && (
          <span className="text-sm text-neutral-600">· {findingsCount} funn</span>
        )}
      </div>

      {readOnly && (
        <InfoBox>
          Sjekklisten er signert
          {execution.signed_at
            ? ` (${new Date(execution.signed_at).toLocaleString('nb-NO')})`
            : ''}
          . Svar og spørsmål er låst, men tittel, sammendrag og deltakere kan
          fortsatt redigeres som etterregistrering.
        </InfoBox>
      )}

      <ExecutionMetadataPanel
        execution={execution}
        templateMetadataSchema={template?.metadata_schema ?? null}
        assignableUsers={cl.assignableUsers}
        locations={orgSetup.locations}
        departments={orgSetup.departments}
        teams={orgSetup.teams}
        members={orgSetup.members}
        onSave={(payload) => cl.updateExecutionMetadata({ executionId, ...payload })}
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
          Besvar hvert punkt. Marker som funn for å registrere avvik — kritiske funn
          oppretter automatisk et avvik.
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
                      {item.required && (
                        <span className="ml-1.5 text-xs font-normal text-red-600">Påkrevd</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.law_ref ?? item.iso_clause ?? ''}
                      {item.help ? ` · ${item.help}` : ''}
                    </p>
                  </div>
                  {response?.is_finding && response.severity && (
                    <SeverityBadge severity={response.severity} />
                  )}
                </div>

                <div className="mt-3">
                  <ItemControl
                    item={item}
                    response={response}
                    readOnly={readOnly}
                    onCommit={(value) =>
                      cl.saveResponse({
                        executionId,
                        itemKey: item.key,
                        value,
                        comment: response?.comment ?? undefined,
                        severity: response?.severity ?? undefined,
                      })
                    }
                    onUploadAttachment={(file) =>
                      cl.uploadResponseAttachment({ executionId, itemKey: item.key, file })
                    }
                    onRemoveAttachment={(storagePath) =>
                      cl.removeResponseAttachment({ executionId, itemKey: item.key, storagePath })
                    }
                    signUrl={cl.signAttachmentUrl}
                  />
                </div>

                {!readOnly && (
                  <div className="mt-3 border-t border-neutral-200/80 pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setActiveFinding((prev) => ({ ...prev, [item.key]: !isFindingExpanded }))
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

                    {isFindingExpanded && (
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {(['low', 'medium', 'high', 'critical'] as ComplianceSeverity[]).map(
                            (s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant={response?.severity === s ? 'primary' : 'secondary'}
                                onClick={() =>
                                  cl.saveResponse({
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
                            ),
                          )}
                        </div>
                        <StandardTextarea
                          value={response?.comment ?? ''}
                          onChange={(e) =>
                            cl.saveResponse({
                              executionId,
                              itemKey: item.key,
                              value: response?.value ?? {},
                              comment: e.target.value,
                              severity:
                                response?.severity ?? item.severity_default ?? 'medium',
                            })
                          }
                          placeholder="Beskriv funnet …"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </ModuleSectionCard>
    </div>
  )
}

// ── Per-type item response control ──────────────────────────────────────────

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
          // 'na' only active when the row was explicitly saved — 'ok' key must be present
          // in the stored value, not just absent (which would also produce current === null)
          const active =
            (o.id === 'yes' && current === true) ||
            (o.id === 'no' && current === false) ||
            (o.id === 'na' && current === null && response !== undefined && 'ok' in value)
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
