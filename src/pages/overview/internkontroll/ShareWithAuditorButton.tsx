// "Del med revisor" — mints an auditor token for the active framework
// and shows the resulting share URL in a modal. Snapshot + layout are
// captured at click-time so the auditor always sees what the admin saw.
//
// Renders nothing while there's no organisation context (e.g. the page
// is still resolving auth).

import { useState } from 'react'
import { Loader2, Share2, X } from 'lucide-react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { Button } from '../../../components/ui/Button'
import type { ReportModule } from '../../../types/reportBuilder'
import { FRAMEWORKS, type FrameworkId } from './frameworkParagraphs'

const BURGUNDY = '#7F1D1D'

export function ShareWithAuditorButton({
  framework,
  scopeLabel,
  snapshot,
  layout,
}: {
  framework: FrameworkId
  scopeLabel: string
  snapshot: Record<string, unknown>
  layout: ReportModule[]
}) {
  const { supabase } = useOrgSetupContext()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (!supabase) return null

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    const { data, error: rpcErr } = await supabase.rpc(
      'create_compliance_auditor_token',
      {
        p_framework_id: framework,
        p_scope_label: `${scopeLabel} · ${FRAMEWORKS[framework].shortLabel}`,
        p_snapshot: snapshot,
        p_layout: layout,
        p_expires_in_days: 30,
      },
    )
    setCreating(false)
    if (rpcErr || typeof data !== 'string') {
      setError(rpcErr?.message ?? 'Kunne ikke opprette revisor-lenke.')
      return
    }
    const url = `${window.location.origin}/auditor/internkontroll/${data}`
    setShareUrl(url)
    setOpen(true)
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Clipboard API not available; user can select manually.
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleCreate}
        disabled={creating}
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
        <p className="mt-1 text-xs text-red-700">{error}</p>
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
                  Gyldig i 30 dager. Snapshotet er frosset på dette tidspunktet —
                  endringer i orgen etter dette vises ikke for revisor.
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
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                Lukk
              </Button>
              <Button
                variant="ghost"
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
