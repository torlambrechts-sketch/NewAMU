import { useEffect, useState } from 'react'
import { Database, Loader2 } from 'lucide-react'
import { getSupabasePublicConfig } from '../lib/supabaseClient'

type Status = 'idle' | 'loading' | 'ok' | 'error' | 'missing'

export function SupabaseStatusCard() {
  const [status, setStatus] = useState<Status>('idle')
  const [detail, setDetail] = useState<string>('')

  useEffect(() => {
    const cfg = getSupabasePublicConfig()
    if (!cfg) {
      queueMicrotask(() => {
        setStatus('missing')
        setDetail(
          'Sett VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY (eller NEXT_PUBLIC_* på Vercel) og bygg på nytt.',
        )
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      setStatus('loading')
      setDetail('')
    })

    const run = async () => {
      try {
        const res = await fetch(`${cfg.url}/auth/v1/health`, {
          headers: {
            apikey: cfg.anonKey,
            Authorization: `Bearer ${cfg.anonKey}`,
          },
        })
        if (cancelled) return
        if (!res.ok) {
          setStatus('error')
          setDetail(`Auth API: HTTP ${res.status}`)
          return
        }
        setStatus('ok')
        setDetail(cfg.url.replace(/^https?:\/\//, ''))
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setDetail(e instanceof Error ? e.message : 'Nettverksfeil')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mb-5 rounded-xl border border-neutral-200/90 bg-gradient-to-br from-[#f0f7f4] to-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1a3d32]/10 text-[#1a3d32]">
          <Database className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">Supabase</h3>
          <p className="mt-1 text-xs text-neutral-600">
            Offentlig URL + anon-nøkkel (kun det som er trygt i nettleseren). MCP og Vercel-vars
            brukes ikke før de leses inn i bygget.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {status === 'loading' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Sjekker tilkobling…
              </span>
            )}
            {status === 'missing' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                Ikke konfigurert
              </span>
            )}
            {status === 'ok' && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                Tilkoblet
              </span>
            )}
            {status === 'error' && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                Feil
              </span>
            )}
          </div>
          {detail ? (
            <p className="mt-2 break-all text-xs text-neutral-500">{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
