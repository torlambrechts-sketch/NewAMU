// ConflictModal — last-writer-wins resolution UI.
//
// Spec §3 decision: "Last-writer-wins with optimistic-lock via
// updated_at. On save, server checks updated_at = client.lastSeen;
// mismatch → 409 + diff modal asks the user to merge or overwrite."
//
// This is the diff modal. Caller passes server + client copies of the
// row payload. User picks one of three resolutions:
//   - 'use_server' — discard local changes, reload server
//   - 'use_client' — overwrite the server (writer wins)
//   - 'merge'      — caller is responsible for the merge; modal just
//                    returns the choice
//
// Mirrors the EmbedderConflictResolution union in studioTypes.ts.

import { Button } from '../../ui/Button'
import type { EmbedderConflictResolution } from '../../../lib/studio/studioTypes'

export type ConflictModalProps = {
  open: boolean
  rowTable: string
  serverPayload: Record<string, unknown>
  clientPayload: Record<string, unknown>
  serverUpdatedAt: string | null
  /** Called with the resolution; modal closes when the promise resolves. */
  onResolve: (resolution: EmbedderConflictResolution) => void | Promise<void>
  onClose: () => void
}

function diffKeys(server: Record<string, unknown>, client: Record<string, unknown>): string[] {
  const keys = new Set<string>([...Object.keys(server), ...Object.keys(client)])
  const out: string[] = []
  for (const k of keys) {
    if (JSON.stringify(server[k]) !== JSON.stringify(client[k])) out.push(k)
  }
  return out
}

export function ConflictModal({
  open,
  rowTable,
  serverPayload,
  clientPayload,
  serverUpdatedAt,
  onResolve,
  onClose,
}: ConflictModalProps) {
  if (!open) return null
  const changed = diffKeys(serverPayload, clientPayload)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="conflict-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 px-5 py-3">
          <h3 id="conflict-modal-title" className="text-sm font-semibold text-neutral-900 font-serif">
            Konflikt — noen andre har endret raden
          </h3>
          <p className="mt-1 text-xs text-neutral-600">
            Tabell <code className="font-mono">{rowTable}</code>
            {serverUpdatedAt ? ` · servernes versjon ble lagret ${new Date(serverUpdatedAt).toLocaleString('nb')}` : ''}.
          </p>
        </header>
        <div className="px-5 py-4">
          {changed.length === 0 ? (
            <p className="text-sm text-neutral-600">Ingen synlige forskjeller — sjekk din versjon før lagring.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-neutral-600">Felter med forskjell mellom server + dine endringer:</p>
              <ul className="space-y-1.5 text-xs">
                {changed.map((k) => (
                  <li key={k} className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <div className="font-mono text-[11px] font-semibold text-neutral-900">{k}</div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <div className="font-semibold text-neutral-500">Server</div>
                        <pre className="mt-0.5 overflow-auto whitespace-pre-wrap break-words text-neutral-700">
                          {JSON.stringify(serverPayload[k], null, 0)}
                        </pre>
                      </div>
                      <div>
                        <div className="font-semibold text-neutral-500">Dine endringer</div>
                        <pre className="mt-0.5 overflow-auto whitespace-pre-wrap break-words text-neutral-700">
                          {JSON.stringify(clientPayload[k], null, 0)}
                        </pre>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => void onResolve('use_server')}>
            Forkast mine endringer
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void onResolve('merge')}>
            Slå sammen manuelt
          </Button>
          <Button variant="primary" size="sm" onClick={() => void onResolve('use_client')}>
            Overskriv server
          </Button>
        </footer>
      </div>
    </div>
  )
}
