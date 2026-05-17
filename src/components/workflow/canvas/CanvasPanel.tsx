// CanvasPanel — the visual canvas tab in /workflow/v3.
//
// Wraps the existing WorkflowFlowBuilder (which already implements
// drag-drop linear + XOR flows) and exposes it for any of the org's
// active rules. The user picks a rule, optionally a starting flow
// document (or empty), and edits.  Save commits the compiled
// condition_json + actions_json + flow_graph_json back to workflow_rules.
//
// As of the sentence-builder MVP the panel mounts one of two editors:
//   - "Setning"  → <SentenceBuilder>: Norwegian-prose row of chips
//                  (NÅR / HVOR / HVIS / DA / HVIS feiler). Reads/writes
//                  the same flow_graph_json via compile.ts.
//   - "Avansert flyt" → the existing WorkflowFlowBuilder for XOR /
//                       parallel / multi-trigger / sub-flow editing.
//
// The mode preference is persisted to localStorage per rule so the user
// doesn't bounce between modes on every open. Rules whose graph contains
// constructs the sentence model can't losslessly express default to
// advanced mode and show a small badge.
//
// UX Run 2 surface (orphans #1 + #6): when the active rule contains a
// gov-action, this panel renders <ConsequenceCard> above the canvas
// (audit story — what the rule will actually send, plus prerequisite
// checklist) and a TEST/PROD runtime toggle (migration _127600) so the
// author can keep the rule pinned to TT02 sandbox even when the org's
// integrations are wired to prod. Promotion to PRODUKSJON requires
// typing the phrase verbatim via the shared ConfirmDialog.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileWarning, PowerOff, Save, ShieldAlert, Workflow, Zap } from 'lucide-react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { ConfirmDialog } from '../../../pages/admin/ConfirmDialog'
import { useOrgIntegrations } from '../../../hooks/useOrgIntegrations'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { WorkflowFlowBuilder } from '../WorkflowFlowBuilder'
import { SentenceBuilder } from '../sentence/SentenceBuilder'
import { SentenceEmptyState } from '../sentence/SentenceEmptyState'
import { ConsequenceCard } from './ConsequenceCard'
import {
  actionsJsonToFallbackSentence,
  emptySentence,
  flowGraphToSentence,
  sentenceToFlowGraph,
} from '../sentence/compile'
import {
  flowGraphToPlainNorwegianSections,
  sentenceToPlainNorwegian,
} from '../sentence/plainNorwegian'
import type { SentenceModel } from '../sentence/sentenceModel'
import { getWorkflowScope } from '../../../lib/workflows/workflowRegistry'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { Tabs } from '../../ui/Tabs'
import { isGovernmentActionType } from '../../../types/workflow'
import type {
  WorkflowAction,
  WorkflowSourceModule,
  WorkflowXorActionsEnvelope,
} from '../../../types/workflow'
import {
  defaultWorkflowFlowDocument,
  compileWorkflowFlow,
  parseFlowDocument,
  type WorkflowFlowDocument,
} from '../../../lib/workflowFlowTypes'

function ruleContainsGovAction(actions: WorkflowAction[] | WorkflowXorActionsEnvelope): boolean {
  if (Array.isArray(actions)) {
    return actions.some((x) => isGovernmentActionType((x as { type: string }).type))
  }
  if (actions && 'mode' in actions && actions.mode === 'xor_branches') {
    return actions.branches.some((b) =>
      (b.actions as WorkflowAction[]).some((x) => isGovernmentActionType((x as { type: string }).type)),
    )
  }
  return false
}

/**
 * Returns the (unique) gov-action-type strings inside the rule's actions_json
 * envelope. The `isGovernmentActionType` predicate covers the canonical 5
 * types; helsetilsynet adds two more (`meld_helsetilsynet`, `meld_ukom`)
 * that the ConsequenceCard knows about so we widen the union here to keep
 * the audit text accurate.
 */
const GOV_ACTION_TYPE_KEYS = new Set<string>([
  'rapporter_alvorlig_skade_arbeidstilsynet',
  'meld_personvernbrudd_datatilsynet',
  'varsel_ldo_export',
  'nav_sykefravar_oppfolging',
  'altinn_send_melding',
  'meld_helsetilsynet',
  'meld_ukom',
])

function collectGovActionTypes(
  actions: WorkflowAction[] | WorkflowXorActionsEnvelope,
): string[] {
  const out = new Set<string>()
  const visit = (xs: WorkflowAction[]) => {
    for (const x of xs) {
      const t = (x as { type?: string }).type
      if (t && GOV_ACTION_TYPE_KEYS.has(t)) out.add(t)
    }
  }
  if (Array.isArray(actions)) {
    visit(actions)
  } else if (actions && 'mode' in actions && actions.mode === 'xor_branches') {
    for (const b of actions.branches) visit(b.actions as WorkflowAction[])
  }
  return Array.from(out)
}

type EditorMode = 'plain' | 'sentence' | 'advanced'

function modeStorageKey(ruleId: string): string {
  return `workflow_editor_mode_${ruleId}`
}

function readPersistedMode(ruleId: string): EditorMode | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(modeStorageKey(ruleId))
    return v === 'sentence' || v === 'advanced' || v === 'plain' ? v : null
  } catch {
    return null
  }
}

function persistMode(ruleId: string, mode: EditorMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(modeStorageKey(ruleId), mode)
  } catch {
    // ignore quota / privacy errors
  }
}

export function CanvasPanel({ initialRuleId }: { initialRuleId?: string | null } = {}) {
  const { rules, upsertRule, setRuleActive, canCompose } = useWorkflows()
  const { supabase, organization } = useOrgSetupContext()
  const { rows: integrationRows } = useOrgIntegrations()
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRuleId ?? '')
  const [doc, setDoc] = useState<WorkflowFlowDocument>(defaultWorkflowFlowDocument())
  const [sentence, setSentence] = useState<SentenceModel | null>(null)
  const [mode, setMode] = useState<EditorMode>('sentence')
  /** TRUE when the persisted graph couldn't reverse-compile to a sentence. */
  const [sentenceLocked, setSentenceLocked] = useState(false)
  /** TRUE when the rule has no flow yet — show empty-state tiles. */
  const [isEmpty, setIsEmpty] = useState(false)
  /** TRUE when the rule has legacy actions_json but no flow_graph_json yet — banner before save overwrites. */
  const [legacyFallback, setLegacyFallback] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Per-rule TEST/PROD toggle (migration _127600). Always starts as 'test'. */
  const [runtimeEnv, setRuntimeEnv] = useState<'test' | 'prod'>('test')
  /** PROD-promotion typed-confirmation modal state. */
  const [promoteOpen, setPromoteOpen] = useState(false)
  /** Activation-guard mirrors: filled from supabase after rule hydration. */
  const [hasSecondApprover, setHasSecondApprover] = useState(false)
  const [dryRunSuccessful, setDryRunSuccessful] = useState(false)
  /**
   * Tracks which rule id is currently hydrated into local state so the
   * post-save `useWorkflows` refetch doesn't stomp pending edits. P1 #5.
   */
  const hydratedRuleIdRef = useRef<string | null>(null)

  // ─── Hydration ─────────────────────────────────────────────────────────
  const hydrate = (id: string) => {
    setSelectedRuleId(id)
    setSaved(false)
    setError(null)
    const found = rules.find((r) => r.id === id)
    if (!found) {
      setDoc(defaultWorkflowFlowDocument())
      setSentence(null)
      setIsEmpty(false)
      setLegacyFallback(false)
      setRuntimeEnv('test')
      hydratedRuleIdRef.current = id
      return
    }
    // _127600: pin to the rule's persisted runtime_environment. Fallback
    // to 'test' for rows pre-dating the column.
    setRuntimeEnv(found.runtime_environment === 'prod' ? 'prod' : 'test')

    const parsed = found.flow_graph_json
      ? parseFlowDocument(found.flow_graph_json as unknown)
      : null
    const sourceModule = found.source_module as WorkflowSourceModule
    const eventName = found.trigger_event_name ?? ''

    if (!parsed) {
      // No flow_graph_json. Try to recover from legacy actions_json before
      // showing the empty state — otherwise users on legacy rules would
      // lose all their actions the moment they save from sentence mode.
      // P0 #2.
      const legacy = actionsJsonToFallbackSentence({
        source_module: found.source_module,
        trigger_event_name: found.trigger_event_name,
        condition_json: found.condition_json,
        actions_json: found.actions_json,
      })
      if (legacy) {
        setDoc(defaultWorkflowFlowDocument())
        setSentence(legacy)
        setIsEmpty(false)
        setLegacyFallback(true)
        const persisted = readPersistedMode(id)
        setMode(persisted ?? 'sentence')
        setSentenceLocked(false)
        hydratedRuleIdRef.current = id
        return
      }
      const legacyActionsArr = Array.isArray(found.actions_json)
        ? (found.actions_json as unknown[])
        : []
      const hasLegacyActions = legacyActionsArr.length > 0
      // Legacy actions exist but can't be expressed in sentence mode →
      // force advanced and warn before overwriting.
      if (hasLegacyActions) {
        setDoc(defaultWorkflowFlowDocument())
        setSentence(emptySentence(sourceModule, eventName))
        setIsEmpty(false)
        setLegacyFallback(true)
        setSentenceLocked(true)
        setMode('advanced')
        hydratedRuleIdRef.current = id
        return
      }
      // Rule truly has no flow yet — empty state + clean sentence skeleton.
      setDoc(defaultWorkflowFlowDocument())
      setSentence(emptySentence(sourceModule, eventName))
      setIsEmpty(true)
      setLegacyFallback(false)
      const persisted = readPersistedMode(id)
      setMode(persisted ?? 'sentence')
      setSentenceLocked(false)
      hydratedRuleIdRef.current = id
      return
    }

    setDoc(parsed)
    setIsEmpty(false)
    setLegacyFallback(false)

    const reverse = flowGraphToSentence(parsed, sourceModule, eventName)
    if (reverse.ok) {
      setSentence(reverse.sentence)
      setSentenceLocked(false)
      const persisted = readPersistedMode(id)
      setMode(persisted ?? 'sentence')
    } else {
      // Couldn't roundtrip — keep a skeleton sentence for display but
      // default to advanced.
      setSentence(emptySentence(sourceModule, eventName))
      setSentenceLocked(true)
      setMode('advanced')
    }
    hydratedRuleIdRef.current = id
  }

  useEffect(() => {
    if (initialRuleId && initialRuleId !== hydratedRuleIdRef.current) {
      // Only re-hydrate when the rule identity actually changes — the
      // `rules` array reference flips after every `upsertRule` because
      // `useWorkflows` refetches, and we mustn't stomp local edits each
      // time. P1 #5.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      hydrate(initialRuleId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRuleId, rules])

  // _127600 / UX Run 2 — mirror the activation prerequisites the DB guard
  // gates on, so the ConsequenceCard can render them as a read-only
  // checklist. We don't enforce here (the trigger does); we surface.
  useEffect(() => {
    if (!supabase || !selectedRuleId) {
      setHasSecondApprover(false)
      setDryRunSuccessful(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        // workflow_rule_activations: any non-revoked, approved-by-someone-
        // -other-than-requester row in the last 7 days satisfies the guard.
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: actData } = await supabase
          .from('workflow_rule_activations')
          .select('approver_user_id, requested_by, approved_at, revoked_at')
          .eq('rule_id', selectedRuleId)
          .not('approved_at', 'is', null)
          .is('revoked_at', null)
          .gte('approved_at', sevenDaysAgo)
          .order('approved_at', { ascending: false })
          .limit(1)
        if (cancelled) return
        const top = (actData ?? [])[0] as
          | { approver_user_id?: string; requested_by?: string }
          | undefined
        setHasSecondApprover(
          !!top &&
            !!top.approver_user_id &&
            top.approver_user_id !== top.requested_by,
        )

        const { data: runData } = await supabase
          .from('workflow_runs')
          .select('id, status, dry_run')
          .eq('rule_id', selectedRuleId)
          .eq('dry_run', true)
          .order('created_at', { ascending: false })
          .limit(1)
        if (cancelled) return
        const lastDry = (runData ?? [])[0] as { status?: string } | undefined
        setDryRunSuccessful(!!lastDry && (lastDry.status === 'ok' || lastDry.status === 'success'))
      } catch {
        // Tolerate — schema may not be present in dev DBs; the card just
        // shows "Ikke gjennomført" / "NEI" which is the safe default.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, selectedRuleId])

  const rule = useMemo(
    () => rules.find((r) => r.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  )

  // UX Run 2 — gov-action surface for the ConsequenceCard + TEST/PROD
  // toggle. Computed once per rule mutation; cheap walk.
  const govActionTypes = useMemo(
    () => (rule ? collectGovActionTypes(rule.actions_json) : []),
    [rule],
  )
  const containsGov = govActionTypes.length > 0

  // Map org_integrations rows (`enabled + environment`) → ConsequenceCard's
  // {active|test|missing} tri-state.
  const integrationStatus = useMemo(() => {
    const map = (
      row: { enabled?: boolean; environment?: 'tt02' | 'prod' } | null | undefined,
    ): 'active' | 'test' | 'missing' => {
      if (!row || !row.enabled) return 'missing'
      return row.environment === 'prod' ? 'active' : 'test'
    }
    return {
      altinn: map(integrationRows.altinn),
      datatilsynet: map(integrationRows.datatilsynet),
      regint: map(integrationRows.regint),
      nav: map(integrationRows.nav),
      helsetilsynet: map(integrationRows.helsetilsynet),
    }
  }, [integrationRows])

  // PROD-promotion confirmation. Switching TEST → PROD requires typing
  // "PRODUKSJON" verbatim — surfaced via the shared ConfirmDialog.
  const requestPromote = useCallback(() => {
    setPromoteOpen(true)
  }, [])
  const confirmPromote = useCallback(() => {
    setRuntimeEnv('prod')
    setPromoteOpen(false)
  }, [])
  const cancelPromote = useCallback(() => {
    setPromoteOpen(false)
  }, [])

  // When the picker changes, hydrate the flow document from the rule's
  // flow_graph_json if present; otherwise start from the default.
  const selectRule = (id: string) => {
    hydrate(id)
  }

  // ─── Deactivate prod gov-rule (P0 UX Run 2) ───────────────────────────
  // Deactivating a rule that runs against PROD endpoints AND contains a
  // gov-action is one of the few destructive ops we want to brake-pedal.
  // Type "DEAKTIVER" to confirm. See ConfirmDialog `confirmPhrase`.
  const [pendingDeactivate, setPendingDeactivate] = useState(false)
  const ruleIsProdGov =
    !!rule &&
    rule.is_active &&
    (rule.runtime_environment ?? 'test') === 'prod' &&
    ruleContainsGovAction(rule.actions_json)

  const confirmDeactivate = useCallback(async () => {
    if (!rule) return
    setPendingDeactivate(false)
    await setRuleActive(rule.id, false)
  }, [rule, setRuleActive])

  function switchMode(next: EditorMode) {
    if (next === 'sentence' && sentenceLocked) return
    setMode(next)
    if (rule) persistMode(rule.id, next)
  }

  // Keep `doc` in sync with `sentence` while the user edits in sentence mode,
  // so flipping to advanced mode shows the same flow rather than a stale one.
  // Pass the current `doc` as `previousGraph` so step IDs are reused
  // position-by-position — keystroke-level edits don't churn the audit log
  // with fresh UUIDs. P1 #8.
  function applySentence(next: SentenceModel) {
    setSentence(next)
    const compiled = sentenceToFlowGraph(next, doc)
    setDoc(compiled)
  }

  const save = async () => {
    if (!rule) return
    setSaving(true)
    setError(null)
    setSaved(false)
    // Lower the active editor's state into a WorkflowFlowDocument first.
    let nextDoc: WorkflowFlowDocument
    if (mode === 'sentence' && sentence) {
      nextDoc = sentenceToFlowGraph(sentence, doc)
    } else {
      nextDoc = doc
    }
    const compiled = compileWorkflowFlow(nextDoc)
    if ('error' in compiled) {
      setError(compiled.error)
      setSaving(false)
      return
    }
    // When the active editor is the SentenceBuilder, the trigger may have
    // been edited via EventChip — surface sourceModule + eventName to the
    // upsert payload so the engine actually fires on the new event. P0 #1.
    const triggerEventName =
      mode === 'sentence' && sentence
        ? sentence.trigger.eventName || null
        : (rule.trigger_event_name ?? null)
    const sourceModule =
      mode === 'sentence' && sentence ? sentence.trigger.sourceModule : rule.source_module
    const result = await upsertRule({
      id: rule.id,
      slug: rule.slug,
      name: rule.name,
      description: rule.description,
      source_module: sourceModule,
      trigger_event_name: triggerEventName,
      trigger_on: rule.trigger_on,
      is_active: rule.is_active,
      condition_json: compiled.condition_json,
      actions_json: compiled.actions_json,
      flow_graph_json: nextDoc as unknown as Record<string, unknown>,
      priority: rule.priority,
      runtime_environment: runtimeEnv,
    })
    setSaving(false)
    if (result?.ok) {
      setSaved(true)
      setIsEmpty(false)
      setLegacyFallback(false)
      setDoc(nextDoc)
      // The post-save refetch will set `rules` to a fresh array with the
      // new flow_graph_json. Mark this rule as already hydrated so the
      // useEffect doesn't re-run hydrate() and stomp the canonical state.
      hydratedRuleIdRef.current = rule.id
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <Workflow className="h-4 w-4 text-[#1a3d32]" />
        <h2 className="text-sm font-semibold text-neutral-900">Visuell canvas</h2>
        <span className="flex-1" />
        <div className="w-80">
          <SearchableSelect
            value={selectedRuleId}
            onChange={selectRule}
            options={[
              { value: '', label: '— velg en regel —' },
              ...rules.map((r) => ({ value: r.id, label: `${r.name} (${r.source_module})` })),
            ]}
          />
        </div>
        {rule && canCompose && ruleIsProdGov && (
          <Button
            type="button"
            size="sm"
            variant="danger"
            icon={<PowerOff className="h-3.5 w-3.5" />}
            onClick={() => setPendingDeactivate(true)}
            disabled={saving}
          >
            Deaktiver
          </Button>
        )}
        {rule && canCompose && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={<Save className="h-3.5 w-3.5" />}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Lagrer …' : 'Lagre'}
          </Button>
        )}
      </div>
      {pendingDeactivate && rule && (
        <ConfirmDialog
          title="Deaktivere produksjons-regel med statlig melding?"
          body={`Regelen «${rule.name}» kjører i PROD og inneholder en statlig melding (⚖️). Deaktivering stopper alle videre utløsere — pågående kjøringer fullføres, men nye triggere ignoreres. Skriv DEAKTIVER for å bekrefte.`}
          confirmLabel="Deaktiver"
          tone="danger"
          confirmPhrase="DEAKTIVER"
          confirmPhraseLabel='Skriv "{phrase}" for å bekrefte:'
          onConfirm={() => void confirmDeactivate()}
          onCancel={() => setPendingDeactivate(false)}
        />
      )}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {saved && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Flyt lagret. Reglens condition_json + actions_json + flow_graph_json er oppdatert.
        </p>
      )}
      {!rule ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Velg en regel for å redigere flyten visuelt. Trekker du ikke noen i listen — installer
          startpakker fra Mal-bibliotek først.
        </div>
      ) : (
        <>
          {/* Rule-context header card — surfaces the metadata the canvas alone hides */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-neutral-900">{rule.name}</h3>
                  {rule.is_active ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      Aktiv
                    </Badge>
                  ) : (
                    <Badge variant="neutral">
                      <FileWarning className="mr-1 inline h-3 w-3" />
                      Inaktiv
                    </Badge>
                  )}
                  {ruleContainsGovAction(rule.actions_json) && (
                    <Badge variant="warning">
                      <ShieldAlert className="mr-1 inline h-3 w-3" />
                      Statlig melding
                    </Badge>
                  )}
                  {rule.catalog_slug && (
                    <Badge variant="info">Mal v{rule.catalog_version ?? 1}</Badge>
                  )}
                </div>
                {rule.description && (
                  <p className="mt-1 text-sm text-neutral-600">{rule.description}</p>
                )}
                <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-neutral-500">Modul</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                      style={{
                        borderColor: getWorkflowScope(rule.source_module)?.accent ?? '#d4d4d4',
                        color: getWorkflowScope(rule.source_module)?.accent ?? '#525252',
                      }}
                    >
                      {getWorkflowScope(rule.source_module)?.label ?? rule.source_module}
                    </span>
                    <code className="text-[10px] text-neutral-500">{rule.source_module}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-neutral-500">Trigger</span>
                    {rule.trigger_event_name ? (
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">
                        {rule.trigger_event_name}
                      </code>
                    ) : rule.schedule_cron ? (
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">
                        {rule.schedule_cron} (cron)
                      </code>
                    ) : (
                      <span className="text-neutral-500">
                        Payload-endring ({rule.trigger_on})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-neutral-500">Lov-referanser</span>
                    {(rule.law_refs ?? []).length === 0 ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {(rule.law_refs ?? []).map((l) => (
                          <code key={l} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-800">
                            {l}
                          </code>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide text-neutral-500">Konfidensialitet</span>
                    <span className="text-neutral-700">
                      {rule.confidentiality_level === 'confidential'
                        ? 'Konfidensielt'
                        : rule.confidentiality_level === 'restricted'
                          ? 'Begrenset'
                          : 'Standard'}
                    </span>
                  </div>
                </div>
              </div>
              <Zap className="mt-1 h-5 w-5 shrink-0 text-[#1a3d32]" aria-hidden />
            </div>
          </div>

          {/* ConsequenceCard — UX Run 2 #1. Renders only when the rule
              contains a gov-action; otherwise nothing above the canvas. */}
          {containsGov && (
            <ConsequenceCard
              rule={rule}
              containsGovAction={containsGov}
              govActionTypes={govActionTypes}
              integrationStatus={integrationStatus}
              hasSecondApprover={hasSecondApprover}
              dryRunSuccessful={dryRunSuccessful}
              orgName={organization?.name}
            />
          )}

          {/* TEST / PROD runtime toggle — UX Run 2 #6 + migration _127600.
              Only meaningful for gov-rules so we hide it on non-gov rules
              to reduce clutter for non-regulatory authors. */}
          {containsGov && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2">
              <span className="text-sm font-medium text-neutral-800">Kjøremiljø:</span>
              <div role="radiogroup" aria-label="Kjøremiljø" className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  role="radio"
                  aria-checked={runtimeEnv === 'test'}
                  onClick={() => setRuntimeEnv('test')}
                  disabled={!canCompose}
                  className={
                    runtimeEnv === 'test'
                      ? 'rounded-full border border-amber-400 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100 hover:text-amber-900 disabled:opacity-50'
                      : 'rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50'
                  }
                >
                  TEST (sandbox)
                </Button>
                <Button
                  variant="ghost"
                  role="radio"
                  aria-checked={runtimeEnv === 'prod'}
                  onClick={() => {
                    if (runtimeEnv === 'prod') return
                    requestPromote()
                  }}
                  disabled={!canCompose || runtimeEnv === 'prod'}
                  className={
                    runtimeEnv === 'prod'
                      ? 'rounded-full border border-rose-500 bg-rose-100 px-3 py-1 text-xs font-bold text-rose-900 shadow-sm hover:bg-rose-100 hover:text-rose-900 disabled:opacity-80'
                      : 'rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50'
                  }
                >
                  PRODUKSJON
                </Button>
              </div>
              {runtimeEnv === 'prod' && canCompose && (
                <Button
                  variant="ghost"
                  onClick={() => setRuntimeEnv('test')}
                  className="rounded-none p-0 text-[11px] font-medium text-neutral-500 underline underline-offset-2 hover:bg-transparent hover:text-neutral-700"
                >
                  Tilbake til TEST
                </Button>
              )}
              <span className="ml-2 text-[11px] text-neutral-500">
                {runtimeEnv === 'test'
                  ? 'Tørrløp mot TT02-endepunkter — ingen melding sendes til forvaltningen.'
                  : 'Lagring sender meldinger til ekte forvaltnings-endepunkter. Krav i ConsequenceCard må være oppfylt.'}
              </span>
            </div>
          )}

          {promoteOpen && (
            <ConfirmDialog
              title="Promotér regelen til PRODUKSJON?"
              body={
                'Du flytter denne regelen fra TT02-sandbox til ekte forvaltnings-endepunkter.\n\n' +
                'Ved neste lagring vil edge-funksjonene sende statlige meldinger til Datatilsynet / Arbeidstilsynet / NAV / Altinn / Helsetilsynet på vegne av virksomheten — disse meldingene kan ikke trekkes tilbake.\n\n' +
                'Sjekk at ConsequenceCard-kravene er oppfylt og at to-personer-godkjenningen er gyldig. Skriv PRODUKSJON for å bekrefte.'
              }
              confirmLabel="Promotér til PRODUKSJON"
              tone="danger"
              confirmPhrase="PRODUKSJON"
              confirmPhraseLabel='Skriv "{phrase}" for å bekrefte:'
              onConfirm={confirmPromote}
              onCancel={cancelPromote}
            />
          )}

          {/* Mode toggle — Plain-Norsk first reinforces "this is what the rule
              says, plain language" before the user dives into structural editing. */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2">
            <Tabs
              items={[
                { id: 'plain', label: 'Plain-norsk' },
                { id: 'sentence', label: 'Setning', disabled: sentenceLocked },
                { id: 'advanced', label: 'Avansert flyt' },
              ]}
              activeId={mode}
              onChange={(id) => switchMode(id as EditorMode)}
            />
            {sentenceLocked ? (
              <Badge variant="warning">
                Denne flyten har avanserte konstruksjoner og kan kun redigeres i avansert visning
              </Badge>
            ) : null}
          </div>

          {/* Legacy actions_json without flow_graph_json — about to be overwritten on save. P0 #2. */}
          {legacyFallback && mode === 'sentence' ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Denne regelen har eksisterende handlinger lagret i gammelt format. Lagring fra
                setnings-redigereren vil erstatte dem. Bytt til{' '}
                <Button
                  variant="ghost"
                  className="inline rounded-none p-0 font-semibold underline underline-offset-2 hover:bg-transparent hover:no-underline"
                  onClick={() => switchMode('advanced')}
                >
                  Avansert flyt
                </Button>{' '}
                hvis du vil bevare dem.
              </p>
            </div>
          ) : null}
          {mode === 'plain' ? (
            <PlainNorwegianInspector
              sentence={sentence}
              doc={doc}
              sentenceLocked={sentenceLocked}
              onSwitchToAdvanced={() => switchMode('advanced')}
            />
          ) : mode === 'sentence' && sentence ? (
            isEmpty ? (
              <SentenceEmptyState
                onStartBlank={() => {
                  setIsEmpty(false)
                }}
                onOpenLibrary={() => {
                  // Library lives on a sibling tab — the page-level
                  // shell handles tab navigation.
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href)
                    url.searchParams.set('tab', 'library')
                    window.location.href = url.toString()
                  }
                }}
                onOpenDryRun={() => {
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href)
                    url.searchParams.set('tab', 'dry-run')
                    window.location.href = url.toString()
                  }
                }}
              />
            ) : (
              <SentenceBuilder
                value={sentence}
                onChange={applySentence}
                readOnly={!canCompose}
                onSwitchToAdvanced={() => switchMode('advanced')}
              />
            )
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <WorkflowFlowBuilder
                value={doc}
                onChange={setDoc}
                sourceModule={rule.source_module}
                compileError={error}
              />
            </div>
          )}
        </>
      )}
      <p className="text-xs text-neutral-500">
        Når flyten lagres kompileres den til <code>condition_json</code> +{' '}
        <code>actions_json</code>. Selve grafen lagres i <code>flow_graph_json</code> så åpning
        ser identisk ut. Aktivering av en regel som inneholder en statlig handling (⚖️) krever{' '}
        <code>workflows.activate_external</code> og er beskyttet av activation-guard-trigger fra
        migrasjon <code>_20260905120900</code>.
      </p>
    </div>
  )
}

/**
 * PlainNorwegianInspector — read-only "this is what the rule says" tab.
 *
 * For sentence-expressible flows we delegate to `sentenceToPlainNorwegian`
 * (the same prose the SentenceBuilder used to show in its accordion). For
 * advanced flows that can't roundtrip to a SentenceModel we fall back to
 * `flowGraphToPlainNorwegianSections` — a sequential list of action labels
 * in plain Norwegian, grouped by branch when the doc is in XOR mode. That
 * keeps the tab useful even when the rule is too complex for the chip-row.
 */
function PlainNorwegianInspector({
  sentence,
  doc,
  sentenceLocked,
  onSwitchToAdvanced,
}: {
  sentence: SentenceModel | null
  doc: WorkflowFlowDocument
  sentenceLocked: boolean
  onSwitchToAdvanced: () => void
}) {
  // Prefer the sentence path when available — it produces a single Norwegian
  // sentence ("Når X i Y, vil systemet …") rather than a list of step labels.
  if (!sentenceLocked && sentence) {
    const prose = sentenceToPlainNorwegian(sentence)
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Hva regelen sier (vanlig norsk)
        </h3>
        <p className="text-base leading-relaxed text-neutral-800">{prose}</p>
        <p className="mt-4 text-xs text-neutral-500">
          Denne fanen er kun for lesing. Bytt til <strong>Setning</strong> eller{' '}
          <Button
            variant="ghost"
            className="inline rounded-none p-0 font-semibold underline underline-offset-2 hover:bg-transparent hover:no-underline"
            onClick={onSwitchToAdvanced}
          >
            Avansert flyt
          </Button>{' '}
          for å endre.
        </p>
      </div>
    )
  }

  // Advanced-only flow: emit a sectioned list, one section per branch.
  const sections = flowGraphToPlainNorwegianSections(doc)
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Hva regelen sier (vanlig norsk)
      </h3>
      <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Denne flyten er for kompleks til naturlig norsk-oversettelse — bruk{' '}
        <Button
          variant="ghost"
          className="inline rounded-none p-0 font-semibold underline underline-offset-2 hover:bg-transparent hover:no-underline"
          onClick={onSwitchToAdvanced}
        >
          Avansert flyt
        </Button>{' '}
        visning for full oversikt. Under er handlingene listet på vanlig norsk uten struktur.
      </p>
      {sections.length === 0 ? (
        <p className="text-sm text-neutral-500">Ingen handlinger registrert.</p>
      ) : (
        <div className="space-y-4">
          {sections.map((sec, idx) => (
            <div key={idx}>
              <h4 className="mb-1 text-sm font-semibold text-neutral-700">{sec.heading}</h4>
              {sec.lines.length === 0 ? (
                <p className="text-sm italic text-neutral-500">Ingen handlinger.</p>
              ) : (
                <ol className="ml-5 list-decimal space-y-1 text-sm text-neutral-800">
                  {sec.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
