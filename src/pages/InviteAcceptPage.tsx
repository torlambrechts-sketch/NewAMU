import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const supabase = getSupabaseBrowserClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !token) return

    let cancelled = false
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        setStatus('idle')
        setMessage('Logg inn med samme e-post som invitasjonen er sendt til.')
        return
      }
      setStatus('working')
      const { error } = await supabase.rpc('accept_invitation', { p_token: token })
      if (cancelled) return
      if (error) {
        setStatus('error')
        setMessage(error.message)
        return
      }
      setStatus('done')
      navigate('/', { replace: true })
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, token, navigate])

  const retry = async () => {
    if (!supabase || !token) return
    setStatus('working')
    setMessage(null)
    const { error } = await supabase.rpc('accept_invitation', { p_token: token })
    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }
    navigate('/', { replace: true })
  }

  if (!supabase) {
    return <p className="p-8 text-center text-neutral-600">Supabase er ikke konfigurert.</p>
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-xl text-[#1a3d32]">Invitasjon</h1>
        {status === 'working' ? (
          <div className="mt-6 flex justify-center gap-2 text-neutral-600">
            <Loader2 className="size-6 animate-spin" />
            Behandler…
          </div>
        ) : null}
        {message ? <p className="mt-4 text-sm text-neutral-700">{message}</p> : null}
        {status === 'idle' || status === 'error' ? (
          <div className="mt-6 space-y-3">
            <Link
              to={`/login?redirect=${encodeURIComponent(`/invite/${token ?? ''}`)}`}
              className="block rounded-lg bg-[#1a3d32] py-2.5 text-sm font-semibold text-white"
            >
              Logg inn for å godta
            </Link>
            {status === 'error' ? (
              <button
                type="button"
                onClick={() => void retry()}
                className="w-full rounded-lg border border-neutral-200 py-2 text-sm"
              >
                Prøv igjen
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
