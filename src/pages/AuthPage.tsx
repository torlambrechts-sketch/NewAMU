import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'

type Mode = 'login' | 'signup'

export function AuthPage({ mode }: { mode: Mode }) {
  const supabase = getSupabaseBrowserClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!supabase) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-neutral-600">
        Supabase er ikke konfigurert. Bruk appen uten innlogging (localStorage) eller sett miljøvariabler.
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
        navigate(redirect, { replace: true })
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || email.split('@')[0] },
          },
        })
        if (err) throw err
        setMessage(
          'Konto opprettet. Sjekk e-post for bekreftelse hvis det er påkrevd, deretter logg inn.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-[#1a3d32]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {mode === 'login'
            ? 'Koble til din organisasjon etter innlogging.'
            : 'Registrering uten organisasjon — du blir bedt om å koble til eller opprette virksomhet etterpå.'}
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          {mode === 'signup' ? (
            <div>
              <label className="block text-sm font-medium text-neutral-800">Visningsnavn</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                autoComplete="name"
              />
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-neutral-800">E-post</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800">Passord</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1a3d32] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === 'login' ? 'Logg inn' : 'Registrer'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          {mode === 'login' ? (
            <>
              Har du ikke konto?{' '}
              <Link to="/signup" className="font-medium text-[#1a3d32] underline">
                Registrer deg
              </Link>
            </>
          ) : (
            <>
              Har du allerede konto?{' '}
              <Link to="/login" className="font-medium text-[#1a3d32] underline">
                Logg inn
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
