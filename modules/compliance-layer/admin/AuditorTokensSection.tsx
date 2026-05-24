// AuditorTokensSection — list + revoke active auditor share-tokens.
//
// Renders the org's outstanding `compliance_auditor_tokens` rows via the
// `compliance_auditor_tokens_safe` view (no bearer secret in the
// payload — see migration 20260926140000). Framework-agnostic:
// `frameworkFilter` scopes the list (e.g. `'controls'` on the controls
// admin page, or NULL on a generic surface).
//
// Used by:
//   - modules/compliance-layer/admin/KontrollerInnstillingerPage.tsx
//     (frameworkFilter='controls')
//   - src/pages/overview/internkontroll/InternkontrollGapSystemReport.tsx
//     (frameworkFilter=<active framework>)

import { useEffect, useMemo, useState } from 'react'
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { useAuditorTokens } from './useAuditorTokens'

type Props = {
  /** Optional filter — e.g. 'controls' to scope to the controls auditor surface. */
  frameworkFilter?: string | null
  /** Display title — defaults to "Aktive revisor-lenker". */
  title?: string
  /** Optional descriptive subtitle. */
  description?: string
  /**
   * Maximum rows visible before "Vis alle" is offered. Defaults to 10
   * so a long list doesn't push the rest of the admin page off-screen
   * on a fresh org with many outstanding tokens.
   */
  visibleLimit?: number
}

/**
 * Calendar-day difference between now (Oslo wall clock) and an ISO
 * timestamp. Returns 0 if the date is today, 1 if tomorrow, -1 if
 * yesterday — independent of how many ms remain in the day. Avoids the
 * Math.ceil(ms / 86_400_000) bug where "5 minutes from now" reads as
 * "tomorrow".
 */
function calendarDaysUntil(iso: string): number {
  const target = new Date(iso)
  const now = new Date()
  // Compare local-zone dates (Date.getFullYear/Month/Date returns
  // wall-clock values). Sufficient for the admin UI even though the
  // app's tz config may differ — both targets use the same conversion.
  const t = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime()
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((t - n) / 86_400_000)
}

export function AuditorTokensSection({
  frameworkFilter = null,
  title = 'Aktive revisor-lenker',
  description,
  visibleLimit = 10,
}: Props) {
  const { tokens, loading, error, revoke } = useAuditorTokens({
    frameworkFilter,
  })
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Sort by expiry (soon-to-expire first) so the most urgent rows sit
  // at the top — matches the priority an admin uses when triaging.
  const sorted = useMemo(
    () =>
      [...tokens].sort(
        (a, b) =>
          new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime(),
      ),
    [tokens],
  )
  const visible = expanded ? sorted : sorted.slice(0, visibleLimit)
  const hiddenCount = Math.max(0, sorted.length - visibleLimit)

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    await revoke(id)
    setRevokingId(null)
    setConfirmingId(null)
  }

  // Escape dismisses the inline confirm prompt — matches the affordance
  // pattern across the rest of the app (slide-panels, modals).
  useEffect(() => {
    if (confirmingId === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmingId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmingId])

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
            {title} ({tokens.length})
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-neutral-600">{description}</p>
          ) : null}
        </div>
      </div>
      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden />
          Laster aktive lenker…
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </div>
      ) : null}
      {!loading && tokens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
          Ingen aktive lenker. Bruk «Del med revisor» øverst for å lage en.
        </p>
      ) : null}
      {visible.length > 0 ? (
        <ul
          aria-live="polite"
          className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm"
        >
          {visible.map((t) => {
            const days = calendarDaysUntil(t.expires_at)
            const ringClass =
              days < 0
                ? 'bg-rose-50 text-rose-900 ring-rose-200'
                : days <= 3
                  ? 'bg-amber-50 text-amber-900 ring-amber-200'
                  : 'bg-emerald-50 text-emerald-900 ring-emerald-200'
            const isConfirming = confirmingId === t.id
            const isRevoking = revokingId === t.id
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-neutral-900">
                    <ShieldCheck
                      className="size-3.5 text-amber-700"
                      aria-hidden
                    />
                    {t.scope_label}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    <span className="font-mono">{t.framework_id}</span>
                    {' · opprettet '}
                    <time dateTime={t.created_at}>
                      {new Date(t.created_at).toLocaleDateString('nb-NO')}
                    </time>
                    {' · '}
                    <span className="font-mono text-neutral-700">
                      {t.token_prefix}…{t.token_suffix}
                    </span>
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${ringClass}`}
                  title={`Utløper ${new Date(t.expires_at).toLocaleString('nb-NO')}`}
                >
                  {days < 0
                    ? 'Utløpt'
                    : days === 0
                      ? 'Utløper i dag'
                      : days === 1
                        ? 'Utløper i morgen'
                        : `${days} d igjen`}
                </span>
                {isConfirming ? (
                  <div
                    className="flex items-center gap-1.5"
                    role="group"
                    aria-label="Bekreft tilbakekalling"
                  >
                    <span className="text-xs text-neutral-700">Sikker?</span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleRevoke(t.id)}
                      disabled={isRevoking}
                    >
                      {isRevoking ? 'Tilbakekaller…' : 'Ja, tilbakekall'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmingId(null)}
                      disabled={isRevoking}
                    >
                      Avbryt
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingId(t.id)}
                    aria-label={`Tilbakekall revisor-lenken «${t.scope_label}»`}
                    className="inline-flex items-center gap-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Tilbakekall
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
      {hiddenCount > 0 ? (
        <div className="flex justify-center pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-neutral-600 hover:text-neutral-900"
          >
            {expanded ? 'Vis færre' : `Vis alle (${sorted.length})`}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
