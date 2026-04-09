import { useState, type FormEvent, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { KlarertLogo } from '../components/brand/KlarertLogo'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { mapAuthError } from '../lib/authErrors'
import { postLoginRedirectPath } from '../lib/authRedirect'
import { DEMO_QUERY_PARAM, persistDemoSessionFlag } from '../lib/demoOrg'

type Mode = 'login' | 'signup'

export function AuthPage({ mode }: { mode: Mode }) {
  const supabase = getSupabaseBrowserClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const reason = searchParams.get('reason')
  const demoParam = searchParams.get(DEMO_QUERY_PARAM)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [demoStarting, setDemoStarting] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const demoAutoStarted = useRef(false)

  /** Auto anonymous sign-in when opening /login?demo=1 — demo does not use email/password. */
  useEffect(() => {
    if (mode !== 'login' || !supabase) return
    if (demoParam !== '1') return
    if (demoAutoStarted.current) return
    demoAutoStarted.current = true
    let cancelled = false
    void (async () => {
      setDemoStarting(true)
      setDemoError(null)
      const { error: anonErr } = await supabase.auth.signInAnonymously()
      if (cancelled) return
      if (anonErr) {
        setDemoError(
          `${anonErr.message} — Sjekk Supabase → Authentication → Providers at «Anonymous sign-ins» er på. Legg også Vercel-URL i Authentication → URL Configuration → Redirect URLs / Site URL.`,
        )
        setDemoStarting(false)
        demoAutoStarted.current = false
        return
      }
      persistDemoSessionFlag(true)
      const base = postLoginRedirectPath(redirect)
      const withDemo =
        base.includes(`${DEMO_QUERY_PARAM}=`) || base.includes(`${DEMO_QUERY_PARAM}=1`)
          ? base
          : `${base}${base.includes('?') ? '&' : '?'}${DEMO_QUERY_PARAM}=1`
      navigate(withDemo, { replace: true })
      setDemoStarting(false)
    })()
    return () => {
      cancelled = true
    }
  }, [mode, supabase, demoParam, redirect, navigate])

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
      <div className="mx-auto mb-8 flex max-w-md justify-center">
        <Link to="/" className="rounded-none p-1 hover:opacity-90" aria-label="Klarert — hjem">
          <KlarertLogo size={32} className="text-[#1a3d32]" />
        </Link>
      </div>
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

        {demoStarting && (
          <p className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
            <Loader2 className="size-4 animate-spin" /> Starter demo (anonym innlogging)…
          </p>
        )}
        {demoError && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
            {demoError}
          </div>
        )}

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

        {mode === 'login' && (
          <div className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <div>
                <p className="font-medium text-amber-950">Demo uten passord</p>
                <p className="mt-1 text-xs text-amber-900/90">
                  <strong>Ikke bruk e-postfeltet over</strong> — demo er en anonym Supabase-bruker, ikke en e-postkonto.
                  Krever <strong>Anonymous</strong> i Supabase (Authentication → Providers) og at migrasjonen for
                  demo-org er kjørt.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    to={`/?${DEMO_QUERY_PARAM}=1`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a3d32] px-3 py-2 text-xs font-semibold text-white hover:bg-[#142e26]"
                  >
                    Start demo (forside)
                  </Link>
                  <Link
                    to={`/login?${DEMO_QUERY_PARAM}=1&redirect=${encodeURIComponent('/reports')}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-700/40 bg-white/80 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-white"
                  >
                    Demo → Rapporter
                  </Link>
                </div>
                <p className="mt-2 text-[11px] text-amber-800/80">
                  Legg Vercel-domenet inn under Authentication → URL Configuration (Site URL / Redirect URLs), ellers
                  blir ikke sesjonen lagret.
                </p>
              </div>
            </div>
          </div>
        )}

        {mode === 'login' ? (
          <p className="mt-6 border-t border-neutral-200 pt-5 text-center text-xs text-neutral-600">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Varsling (AML kap. 2A)</span>
            <span className="mt-2 block leading-relaxed">
              Ønsker du å varsle om kritikkverdige forhold <strong>uten å logge inn</strong>? Bruk lenken du har fått fra
              arbeidsgiver, eller demo-lenken under.
            </span>
            <Link
              to="/varsle/0000000000004000a000000000000001"
              className="mt-2 inline-block font-medium text-[#1a3d32] underline"
            >
              Varsle anonymt (demo-virksomhet)
            </Link>
            <span className="mx-2 text-neutral-300">·</span>
            <Link to="/varsle/status" className="font-medium text-[#1a3d32] underline">
              Sjekk status med saksnøkkel
            </Link>
          </p>
        ) : null}

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
