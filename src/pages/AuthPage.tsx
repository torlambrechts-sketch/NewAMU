import { useState, type FormEvent, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { mapAuthError } from '../lib/authErrors'
import { postLoginRedirectPath } from '../lib/authRedirect'

type Mode = 'login' | 'signup'

export function AuthPage({ mode }: { mode: Mode }) {
  const supabase = getSupabaseBrowserClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const reason = searchParams.get('reason')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (reason === 'no_session') {
      setError(
        'Sesjonen ble ikke gjenkjent etter forrige forsøk. Prøv å logge inn på nytt. Hvis det gjentar seg: sjekk at du er på samme domene som i Supabase (Authentication → URL Configuration) og at informasjonskapsler er tillatt.',
      )
    }
  }, [reason])

  const signupHref = `/signup?redirect=${encodeURIComponent(redirect)}`
  const loginHref = `/login?redirect=${encodeURIComponent(redirect)}`

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
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (err) throw err

        if (!data.session) {
          setError(
            'Ingen aktiv sesjon etter innlogging. Dette skjer ofte hvis e-post ikke er bekreftet — sjekk innboksen for en lenke fra Supabase, eller kontakt administrator.',
          )
          return
        }

        const { data: verify } = await supabase.auth.getSession()
        if (!verify.session) {
          setError('Sesjonen ble ikke lagret. Prøv å oppdatere siden eller sjekk at informasjonskapsler er tillatt for dette domenet.')
          return
        }

        // Client-side navigate + route sync in useOrgSetup picks up session (avoids full reload losing session on some hosts)
        navigate(postLoginRedirectPath(redirect), { replace: true })
      } else {
        const name = fullName.trim()
        if (!name) {
          setError('Skriv inn fullt navn.')
          return
        }
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name,
              display_name: name,
            },
          },
        })
        if (err) throw err

        if (data.session) {
          const { data: verify } = await supabase.auth.getSession()
          if (verify.session) {
            navigate(postLoginRedirectPath(redirect), { replace: true })
            return
          }
        }

        setMessage(
          'Konto opprettet. Hvis prosjektet krever e-postbekreftelse, har vi sendt deg en lenke — åpne den før du logger inn. Deretter kan du logge inn her.',
        )
      }
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1
          className="font-serif text-2xl text-[#1a3d32]"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {mode === 'login'
            ? 'Koble til din organisasjon etter innlogging.'
            : 'Opprett bruker med fullt navn. Deretter kobler du til eller oppretter virksomhet i veiviseren.'}
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          {mode === 'signup' ? (
            <div>
              <label htmlFor="full-name" className="block text-sm font-medium text-neutral-800">
                Fullt navn <span className="text-red-600">*</span>
              </label>
              <input
                id="full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                autoComplete="name"
                placeholder="Fornavn Etternavn"
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-neutral-800">
              E-post <span className="text-red-600">*</span>
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-neutral-800">
              Passord <span className="text-red-600">*</span>
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
            />
            {mode === 'signup' ? (
              <p className="mt-1 text-xs text-neutral-500">Minst 6 tegn (krav kan være høyere i Supabase).</p>
            ) : null}
          </div>

          {error ? (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
          {message ? (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"
            >
              {message}
            </div>
          ) : null}

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
              <Link to={signupHref} className="font-medium text-[#1a3d32] underline">
                Registrer deg
              </Link>
            </>
          ) : (
            <>
              Har du allerede konto?{' '}
              <Link to={loginHref} className="font-medium text-[#1a3d32] underline">
                Logg inn
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
