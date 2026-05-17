// RulesPanel — "Mine arbeidsflyter" list view.
//
// Lists every workflow_rules row for the current org with status badge,
// scope chip, law_refs, gov-action flag, active toggle and per-row
// actions (rediger → canvas, kjøringer → run history filtered,
// endringslogg → revisions filtered, slett).
//
// The Mal-bibliotek tab shows TEMPLATES (workflow_rule_catalog). This
// tab shows the actual installed workflow_rules — the rows that
// actually run when their triggers fire.

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  FileWarning,
  History,
  Pencil,
  PlayCircle,
  ScrollText,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { isGovernmentActionType } from '../../../types/workflow'
import type { WorkflowAction, WorkflowRuleRow, WorkflowXorActionsEnvelope } from '../../../types/workflow'
import { getWorkflowScope, listWorkflowScopes } from '../../../lib/workflows/workflowRegistry'
import { Badge } from '../../ui/Badge'

function ruleContainsGovAction(rule: WorkflowRuleRow): boolean {
  const a = rule.actions_json
  if (Array.isArray(a)) {
    return a.some((x) => isGovernmentActionType((x as { type: string }).type))
  }
  const envelope = a as WorkflowXorActionsEnvelope
  if (envelope && 'mode' in envelope && envelope.mode === 'xor_branches') {
    return envelope.branches.some((b) =>
      (b.actions as WorkflowAction[]).some((x) => isGovernmentActionType((x as { type: string }).type)),
    )
  }
  return false
}

export function RulesPanel({
  onEdit,
  onViewRuns,
  onViewRevisions,
}: {
  onEdit: (ruleId: string) => void
  onViewRuns: (ruleId: string) => void
  onViewRevisions: (ruleId: string) => void
}) {
  const { rules, loading, error, setRuleActive, deleteRule, canCompose, canActivate, canActivateExternal } =
    useWorkflows()
  const [searchParams] = useSearchParams()
  const initialScope = searchParams.get('source_module') ?? 'all'
  const [scopeFilter, setScopeFilter] = useState<string>(initialScope)
  const [search, setSearch] = useState('')
  const [showOnlyActive, setShowOnlyActive] = useState(false)

  // Mirror the source_module query param if it changes (e.g. another
  // deep-link arrives without a fresh mount).
  useEffect(() => {
    const next = searchParams.get('source_module')
    if (next && next !== scopeFilter) setScopeFilter(next)
    // intentionally exhaustive-deps-disabled: only react to the URL param
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const scopes = listWorkflowScopes()

  const filtered = useMemo(() => {
    return rules.filter((r) => {
      if (scopeFilter !== 'all' && r.source_module !== scopeFilter) return false
      if (showOnlyActive && !r.is_active) return false
      if (search) {
        const hay = `${r.name} ${r.slug} ${r.description ?? ''} ${(r.law_refs ?? []).join(' ')}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [rules, scopeFilter, showOnlyActive, search])

  const handleToggleActive = async (rule: WorkflowRuleRow) => {
    const isGov = ruleContainsGovAction(rule)
    const willActivate = !rule.is_active
    if (willActivate) {
      if (isGov && !canActivateExternal) {
        alert('Du må ha workflows.activate_external for å aktivere regler med statlig melding.')
        return
      }
      if (!isGov && !canActivate) {
        alert('Du må ha workflows.activate for å aktivere regler.')
        return
      }
    }
    await setRuleActive(rule.id, willActivate)
  }

  const handleDelete = async (rule: WorkflowRuleRow) => {
    if (!canCompose) return
    if (!confirm(`Slette regelen "${rule.name}"? Kan ikke angres.`)) return
    await deleteRule(rule.id)
  }

  if (loading && rules.length === 0) {
    return <div className="p-6 text-sm text-neutral-500">Laster regler …</div>
  }
  if (error) {
    return <div className="p-6 text-sm text-red-700">Kunne ikke laste regler: {error}</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Mine arbeidsflyter</h2>
        <span className="text-xs text-neutral-500">
          {rules.length} totalt · {filtered.length} viser nå · {rules.filter((r) => r.is_active).length} aktive
        </span>
        <span className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk navn / slug / law ref …"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        />
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="all">Alle moduler</option>
          {scopes.map((s) => (
            <option key={s.scopeId} value={s.scopeId}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={showOnlyActive}
            onChange={(e) => setShowOnlyActive(e.target.checked)}
          />
          Kun aktive
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          {rules.length === 0
            ? 'Ingen regler installert ennå. Åpne Mal-bibliotek og klikk «Installer pakke».'
            : 'Ingen regler matcher filtrene.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Navn</th>
                <th className="px-3 py-2 text-left">Modul</th>
                <th className="px-3 py-2 text-left">Trigger</th>
                <th className="px-3 py-2 text-left">Law refs</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((rule) => {
                const isGov = ruleContainsGovAction(rule)
                const scope = getWorkflowScope(rule.source_module)
                return (
                  <tr key={rule.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{rule.name}</span>
                        {isGov && (
                          <Badge variant="warning">
                            <ShieldAlert className="mr-1 inline h-3 w-3" />
                            Statlig
                          </Badge>
                        )}
                        {rule.catalog_slug && (
                          <Badge variant="info">Mal v{rule.catalog_version ?? 1}</Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{rule.description}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                        style={{ borderColor: scope?.accent ?? '#d4d4d4', color: scope?.accent ?? '#525252' }}
                      >
                        {scope?.label ?? rule.source_module}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-700">
                      {rule.trigger_event_name ? (
                        <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px]">{rule.trigger_event_name}</code>
                      ) : rule.schedule_cron ? (
                        <span>
                          <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px]">{rule.schedule_cron}</code>
                          <span className="ml-1 text-neutral-500">(cron)</span>
                        </span>
                      ) : (
                        <span className="text-neutral-400">payload {rule.trigger_on}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-700">
                      {(rule.law_refs ?? []).length === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        (rule.law_refs ?? []).slice(0, 2).join(' · ') +
                        ((rule.law_refs ?? []).length > 2 ? ` +${(rule.law_refs ?? []).length - 2}` : '')
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(rule)}
                        disabled={!canCompose}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          rule.is_active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        } disabled:opacity-50`}
                        title={rule.is_active ? 'Klikk for å deaktivere' : 'Klikk for å aktivere'}
                      >
                        {rule.is_active ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Aktiv
                          </>
                        ) : (
                          <>
                            <FileWarning className="h-3 w-3" /> Inaktiv
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(rule.id)}
                          className="rounded p-1 text-neutral-600 hover:bg-neutral-100"
                          title="Rediger flyt"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewRuns(rule.id)}
                          className="rounded p-1 text-neutral-600 hover:bg-neutral-100"
                          title="Kjøringer"
                        >
                          <PlayCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewRevisions(rule.id)}
                          className="rounded p-1 text-neutral-600 hover:bg-neutral-100"
                          title="Endringslogg"
                        >
                          <ScrollText className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rule)}
                          disabled={!canCompose}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                          title="Slett"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        <History className="mr-1 inline h-3 w-3" />
        Statusendringer logges automatisk i <code>workflow_rule_revisions</code> (RLS-låst, ikke
        redigerbar). Statlige regler kan kun aktiveres av brukere med{' '}
        <code>workflows.activate_external</code> + dobbel godkjenning før innsending.
      </p>
    </div>
  )
}
