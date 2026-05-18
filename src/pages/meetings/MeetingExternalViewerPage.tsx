// Token-gated public meeting view for external invitees (§8.33).
// Reached via /meetings/external/:token. No auth required; the RPC
// meetings_external_redeem_token validates token + expiry, stamps
// used_at, and returns the meeting payload scoped to the invitee's
// access_level (observer | speak | vote).

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Calendar, MapPin, ShieldCheck, ListChecks } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { Badge } from '../../components/ui/Badge'
import { WarningBox } from '../../components/ui/AlertBox'

const ACCENT = '#0891b2'

type Payload = {
  invitee: {
    name: string
    role: string | null
    access_level: 'observer' | 'speak' | 'vote'
    org_affiliation: string | null
  }
  meeting: {
    id: string
    title: string
    description: string | null
    status: string
    scheduled_at: string | null
    ends_at: string | null
    location_label: string | null
    confidentiality_level: string
  }
  agenda: Array<{
    position: number
    title: string
    description: string | null
    minutes_summary: string | null
    decision_text: string | null
    decision_status: string | null
  }>
  protocol_signed_at: string | null
  redeemed_at: string
}

const ACCESS_LABEL: Record<Payload['invitee']['access_level'], string> = {
  observer: 'Observatør',
  speak: 'Talerett',
  vote: 'Stemmerett',
}

function fmtDateNb(iso: string | null): string {
  if (!iso) return 'Tidspunkt ikke fastsatt'
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      dateStyle: 'full',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function MeetingExternalViewerPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!token) {
      // Defer to next tick so the synchronous-setState lint rule is satisfied.
      const t = window.setTimeout(() => {
        if (cancelled) return
        setError('Manglende token')
        setLoading(false)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }
    // Create an unauthenticated client for the public route. The RPC is
    // SECURITY DEFINER + granted to anon; RLS isn't applied.
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) {
      const t = window.setTimeout(() => {
        if (cancelled) return
        setError('Supabase-konfigurasjon mangler')
        setLoading(false)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }
    const supabase = createClient(url, key)
    void supabase
      .rpc('meetings_external_redeem_token', { p_token: token })
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          const msg = res.error.message ?? ''
          if (msg.includes('invite_not_found')) setError('Lenken er ikke gyldig.')
          else if (msg.includes('invite_expired')) setError('Lenken er utløpt.')
          else if (msg.includes('meeting_not_found')) setError('Møtet er ikke tilgjengelig.')
          else if (msg.includes('invalid_token')) setError('Lenken er ikke gjenkjennelig.')
          else setError(msg)
          setLoading(false)
          return
        }
        setPayload(res.data as Payload)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F2]">
        <div className="text-sm text-neutral-600">Laster møteinformasjon …</div>
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F2] px-4">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="text-base font-semibold text-amber-900">Tilgang ikke mulig</p>
              <p className="mt-1 text-amber-800">{error ?? 'Ukjent feil'}</p>
              <p className="mt-3 text-[11px] text-amber-700/80">
                Kontakt møteleder dersom du mener dette er en feil.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const m = payload.meeting
  const inv = payload.invitee
  const canSeeMinutes = inv.access_level === 'speak' || inv.access_level === 'vote'

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      {/* Header band */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: ACCENT }}
          >
            Møteinnsyn — ekstern lenke
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900 md:text-3xl">
            {m.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              {fmtDateNb(m.scheduled_at)}
            </span>
            {m.location_label ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {m.location_label}
              </span>
            ) : null}
            {payload.protocol_signed_at ? (
              <Badge variant="signed">
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                Protokoll signert
              </Badge>
            ) : (
              <Badge variant="info">{m.status === 'in_progress' ? 'Pågår' : 'Planlagt'}</Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8">
        {/* Invitee identity */}
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Deg som ekstern deltaker
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-base font-semibold text-neutral-900">{inv.name}</p>
            <Badge variant="info">{ACCESS_LABEL[inv.access_level]}</Badge>
            {inv.org_affiliation ? (
              <span className="text-sm text-neutral-600">· {inv.org_affiliation}</span>
            ) : null}
          </div>
          {inv.role ? <p className="mt-1 text-sm text-neutral-600">{inv.role}</p> : null}
        </section>

        {m.description ? (
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Beskrivelse
            </p>
            <p className="mt-2 text-sm text-neutral-800">{m.description}</p>
          </section>
        ) : null}

        {/* Confidentiality warning */}
        {m.confidentiality_level !== 'standard' ? (
          <WarningBox>
            Dette møtet er merket som <strong>{m.confidentiality_level}</strong>. Innholdet
            skal ikke deles videre uten samtykke fra møteleder.
          </WarningBox>
        ) : null}

        {/* Agenda */}
        <section className="rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-4">
            <ListChecks className="h-4 w-4 text-neutral-500" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Saksliste</h2>
            <span className="ml-auto text-xs text-neutral-500">{payload.agenda.length} saker</span>
          </div>
          {payload.agenda.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">Ingen saker registrert ennå.</p>
          ) : (
            <ol className="divide-y divide-neutral-100">
              {payload.agenda.map((it) => (
                <li key={it.position} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums text-white"
                      style={{ background: ACCENT }}
                    >
                      {it.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900">{it.title}</p>
                      {it.description ? (
                        <p className="mt-1 text-xs text-neutral-600">{it.description}</p>
                      ) : null}
                      {canSeeMinutes && it.minutes_summary ? (
                        <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-700">
                          {it.minutes_summary}
                        </p>
                      ) : null}
                      {canSeeMinutes && it.decision_text ? (
                        <div className="mt-2 rounded border border-cyan-200 bg-cyan-50/60 p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-900">
                            Vedtak
                          </p>
                          <p className="mt-1 text-xs text-neutral-800">{it.decision_text}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {!canSeeMinutes ? (
          <p className="text-center text-[11px] italic text-neutral-500">
            Du har observatør-tilgang — referat og vedtak vises ikke. Kontakt møteleder for utvidet
            tilgang.
          </p>
        ) : null}

        <footer className="pt-4 text-center text-[11px] text-neutral-400">
          Innsyn fra ekstern lenke · Token registrert {fmtDateNb(payload.redeemed_at)}
        </footer>
      </main>
    </div>
  )
}
