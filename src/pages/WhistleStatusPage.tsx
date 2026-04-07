import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'

const R = 'rounded-none'

export function WhistleStatusPage() {
  const [searchParams] = useSearchParams()
  const initial = searchParams.get('key') ?? ''
  const [key, setKey] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const supabase = getSupabaseBrowserClient()

  async function lookup() {
    if (!supabase || !key.trim()) return
    setBusy(true)
    setResult(null)
    const { data, error } = await supabase.rpc('public_whistleblowing_status', { p_access_key: key.trim() })
    setBusy(false)
    if (error) setResult({ error: error.message })
    else setResult(data)
  }

  const r = result as { found?: boolean; status?: string; updatedAt?: string; error?: string } | null

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-2xl font-semibold text-[#1a3d32]">Status for varsel</h1>
        <p className="mt-2 text-sm text-neutral-600">Lim inn saksnøkkelen du fikk ved innsending.</p>
        <div className={`${R} mt-6 space-y-3 border border-neutral-200 bg-white p-5`}>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Saksnøkkel (UUID)"
            className={`${R} w-full border border-neutral-300 px-3 py-2 font-mono text-sm`}
          />
          <button
            type="button"
            onClick={() => void lookup()}
            disabled={busy || !key.trim()}
            className={`${R} w-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white disabled:opacity-50`}
          >
            {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : 'Hent status'}
          </button>
          {r?.error ? <p className="text-sm text-red-700">{r.error}</p> : null}
          {r && 'found' in r && r.found === false ? <p className="text-sm text-neutral-600">Ukjent nøkkel.</p> : null}
          {r && r.found ? (
            <div className="text-sm text-neutral-800">
              <p>
                <strong>Status:</strong> {r.status}
              </p>
              {r.updatedAt ? (
                <p className="mt-1 text-neutral-600">Sist oppdatert: {new Date(r.updatedAt).toLocaleString('no-NO')}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="mt-6 text-center text-xs">
          <Link to="/login" className="text-[#1a3d32] underline">
            Innlogging
          </Link>
        </p>
      </div>
    </div>
  )
}
