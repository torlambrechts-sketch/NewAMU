// "Del med revisor" for the controls layer.
//
// Mints a token via the existing `create_compliance_auditor_token` RPC
// with sentinel `framework_id='controls'`, captures a snapshot of the
// org's controls + clauses + statuses at click-time, and surfaces the
// share URL in a modal. Mirrors the pattern in
// `src/pages/overview/internkontroll/ShareWithAuditorButton.tsx` so the
// auditor-side UX is consistent.

import { useState } from 'react'
import { Loader2, Share2, X } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { Button } from '../../../src/components/ui/Button'
import { useControlClauses } from '../useControlClauses'
import { useInternalControls } from '../useInternalControls'

const BURGUNDY = '#7F1D1D'

/**
 * Sentinel `framework_id` used for compliance-layer auditor tokens.
 * Shared with `useAuditorTokens({ frameworkFilter })` callers + the
 * server-side guard in `compliance_auditor_token_verify(text, text)`.
 */
export const CONTROLS_FRAMEWORK_ID = 'controls'

export function ShareControlsWithAuditorButton() {
  const { supabase } = useOrgSetupContext()
  const {
    controls,
    status,
    loading: controlsLoading,
  } = useInternalControls({ supabase })
  const {
    junctions,
    clausesById,
    loading: clausesLoading,
  } = useControlClauses({ supabase })

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (!supabase) return null

  // Gate on data-loading so we don't snapshot an empty payload while
  // the hooks are still resolving against Supabase.
  const dataLoading = controlsLoading || clausesLoading

  const handleCreate = async () => {
    if (dataLoading) {
      setError('Data laster fortsatt — vent til kontrollene er ferdig lest.')
      return
    }
    setCreating(true)
    setError(null)

    // Snapshot shape consumed by ControlsAuditorPage. Filter retired /
    // inactive controls upstream so the auditor view's KPIs sum cleanly
    // (the bucket switch on the auditor page has no `retired` branch).
    const activeControls = controls.filter(
      (c) => c.is_active && c.status !== 'retired',
    )
    const activeIds = new Set(activeControls.map((c) => c.id))
    const snapshot = {
      controls: activeControls.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        purpose: c.purpose,
        control_family: c.control_family,
        frequency_hint: c.frequency_hint,
        owner_role: c.owner_role,
        status: c.status,
        is_system: c.is_system,
      })),
      status: status
        .filter((s) => activeIds.has(s.control_id))
        .map((s) => ({
          control_id: s.control_id,
          status_label: s.status_label,
          last_occurred_at: s.last_occurred_at,
          next_due_at: s.next_due_at,
          total_executions: s.total_executions,
          last12m_executions: s.last12m_executions,
        })),
      junctions: junctions
        .filter((j) => activeIds.has(j.control_id))
        .map((j) => ({
          control_id: j.control_id,
          clause_id: j.clause_id,
          coverage_level: j.coverage_level,
          clause_code: clausesById[j.clause_id]?.code ?? j.clause_id,
          clause_title: clausesById[j.clause_id]?.title ?? '',
          regulation_id: clausesById[j.clause_id]?.regulation_id ?? '',
        })),
    }

    const { data, error: rpcErr } = await supabase.rpc(
      'create_compliance_auditor_token',
      {
        p_framework_id: CONTROLS_FRAMEWORK_ID,
        p_scope_label: 'Internkontroller — revisor-visning',
        p_snapshot: snapshot as unknown as Record<string, unknown>,
        // Layout left empty; ControlsAuditorPage renders its own bespoke
        // table, not a dashboard layout. The RPC param is jsonb, so an
        // empty array is a valid payload — keep the cast precise rather
        // than pretending it's a Record.
        p_layout: [] as unknown as Record<string, unknown>[],
        p_expires_in_days: 30,
      },
    )
    setCreating(false)
    if (rpcErr || typeof data !== 'string') {
      setError(rpcErr?.message ?? 'Kunne ikke opprette revisor-lenke.')
      return
    }
    const url = `${window.location.origin}/auditor/controls/${data}`
    setShareUrl(url)
    setOpen(true)
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Clipboard API not available — user can select manually.
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCreate}
        disabled={creating || dataLoading || controls.length === 0}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        title="Lag en frosset lenke som revisor kan åpne uten innlogging"
      >
        {creating ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Share2 className="size-4" style={{ color: BURGUNDY }} aria-hidden />
        )}
        {creating ? 'Genererer …' : 'Del med revisor'}
      </Button>

      {error ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {open && shareUrl ? (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-pointer bg-neutral-900/40"
          />
          <div className="absolute left-1/2 top-1/2 w-[min(560px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  Revisor-lenke opprettet
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Gyldig i 30 dager. Snapshotet er frosset på dette tidspunktet
                  — endringer i kontrollene etter dette vises ikke for revisor.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Lukk"
                className="h-auto w-auto rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs text-neutral-800 break-all">
              {shareUrl}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                Lukk
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="rounded-md bg-[#7F1D1D] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#5b1414]"
              >
                Kopier lenke
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
