import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { KlarertLogo } from '../components/brand/KlarertLogo'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { mapAuthError } from '../lib/authErrors'
import { postLoginRedirectPath } from '../lib/authRedirect'

type Mode = 'login' | 'signup'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'

// ─── Left panel illustration ──────────────────────────────────────────────────

const CAROUSEL = [
  {
    title: 'Del avvik, når som helst',
    desc: 'La ansatte rapportere HMS-hendelser fra hvor som helst — mobil, nettbrett eller PC.',
  },
  {
    title: 'Automatiske frister',
    desc: 'Sykefraværsfrister, AMU-møter og vernerunder planlegges automatisk av systemet.',
  },
  {
    title: 'Compliance innebygd fra start',
    desc: 'Norsk arbeidsrett er arkitekturen — ikke en sjekkliste du fyller ut etterpå.',
  },
]

function LeftPanel({ mode }: { mode: Mode }) {
  return (
    <div
      className="hidden flex-col justify-between p-10 lg:flex"
      style={{ background: FOREST, minHeight: '100vh', width: '44%' }}
    >
      {/* Logo */}
      <div>
        <KlarertLogo size={26} variant="onDark" />
      </div>

      {/* Illustration area */}
      <div className="flex flex-col items-center text-center">
        {/* SVG illustration */}
        <div className="mb-8 flex items-center justify-center" style={{ height: 220 }}>
          <svg viewBox="0 0 320 220" fill="none" className="w-full max-w-xs" aria-hidden>
            {/* Background blobs */}
            <ellipse cx="160" cy="110" rx="130" ry="80" fill="rgba(45,212,191,0.07)" />
            {/* Cloud left */}
            <ellipse cx="55" cy="68" rx="22" ry="13" fill="rgba(255,255,255,0.12)" />
            <ellipse cx="72" cy="63" rx="18" ry="12" fill="rgba(255,255,255,0.12)" />
            {/* Cloud right */}
            <ellipse cx="258" cy="55" rx="20" ry="12" fill="rgba(255,255,255,0.10)" />
            <ellipse cx="272" cy="50" rx="15" ry="10" fill="rgba(255,255,255,0.10)" />
            {/* Document / shield shape */}
            <rect x="115" y="40" width="90" height="115" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <rect x="128" y="57" width="64" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
            <rect x="128" y="70" width="48" height="6" rx="3" fill="rgba(255,255,255,0.15)" />
            <rect x="128" y="83" width="56" height="6" rx="3" fill="rgba(255,255,255,0.15)" />
            <rect x="128" y="96" width="40" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
            {/* Teal checkmark badge */}
            <circle cx="205" cy="130" r="22" fill={TEAL} />
            <path d="M196 130l6 6 11-11" stroke={FOREST} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {/* Person silhouette */}
            <circle cx="160" cy="168" r="16" fill="rgba(255,255,255,0.13)" />
            <rect x="148" y="184" width="24" height="22" rx="8" fill="rgba(255,255,255,0.10)" />
            {/* Stars / sparkles */}
            <path d="M88 105 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill={TEAL} opacity=".6" />
            <path d="M238 95 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill={TEAL} opacity=".5" />
          </svg>
        </div>

        {/* Slide text */}
        <h2
          className="mb-3 text-2xl font-bold text-white"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {mode === 'signup' ? CAROUSEL[0].title : 'Logg inn til Klarert'}
        </h2>
        <p className="max-w-xs text-sm leading-relaxed text-white/60">
          {mode === 'signup'
            ? CAROUSEL[0].desc
            : 'Koble til din organisasjon og fortsett med lovpålagt HMS-arbeid der du slapp.'}
        </p>

        {/* Carousel dots */}
        {mode === 'signup' && (
          <div className="mt-6 flex gap-2">
            <span className="size-2 rounded-full bg-white" />
            <span className="size-2 rounded-full bg-white/30" />
            <span className="size-2 rounded-full bg-white/30" />
          </div>
        )}
      </div>

      {/* Bottom: pricing badge */}
      <div className="flex items-center justify-center gap-3">
        <div
          className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <span className="font-bold text-white">
            fra 690 <span className="font-normal text-white/50">kr/mnd</span>
          </span>
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/60">
            Månedlig
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AuthPage({ mode }: { mode: Mode }) {
  const supabase = getSupabaseBrowserClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/app'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
        if (!data.session) {
          setError('Ingen aktiv sesjon etter innlogging. Sjekk at e-post er bekreftet eller kontakt administrator.')
          return
        }
        const { data: verify } = await supabase.auth.getSession()
        if (!verify.session) {
          setError('Sesjonen ble ikke lagret. Prøv å oppdatere siden eller sjekk at informasjonskapsler er tillatt.')
          return
        }
        navigate(postLoginRedirectPath(redirect), { replace: true })
      } else {
        const name = fullName.trim()
        if (!name) { setError('Skriv inn fullt navn.'); return }
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name, display_name: name } },
        })
        if (err) throw err
        if (data.session) {
          const { data: verify } = await supabase.auth.getSession()
          if (verify.session) { navigate(postLoginRedirectPath(redirect), { replace: true }); return }
        }
        setMessage('Konto opprettet. Hvis prosjektet krever e-postbekreftelse, sjekk innboksen — åpne lenken før du logger inn.')
      }
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen">

      {/* Left panel */}
      <LeftPanel mode={mode} />

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16" style={{ background: '#fafaf9' }}>

        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Link to="/home" aria-label="Klarert — hjem">
            <KlarertLogo size={30} variant="onLight" />
          </Link>
        </div>

        <div className="w-full max-w-md">

          {/* Step badge (signup only) */}
          {mode === 'signup' && (
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-neutral-400">
              Steg 1 av 2
            </p>
          )}

          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}
          >
            {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {mode === 'login'
              ? 'Koble til din organisasjon etter innlogging.'
              : 'Opprett bruker med fullt navn. Deretter kobler du til eller oppretter virksomhet i veiviseren.'}
          </p>

          <form onSubmit={(e) => void submit(e)} className="mt-7 space-y-4">

            {mode === 'signup' && (
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-neutral-700">
                  Fullt navn <span className="text-red-500">*</span>
                </label>
                <input
                  id="full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-transparent focus:ring-2"
                  style={{ '--tw-ring-color': TEAL } as React.CSSProperties}
                  autoComplete="name"
                  placeholder="Fornavn Etternavn"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-neutral-700">
                E-post <span className="text-red-500">*</span>
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-transparent focus:ring-2"
                style={{ '--tw-ring-color': TEAL } as React.CSSProperties}
                autoComplete="email"
                placeholder="din@epost.no"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-neutral-700">
                Passord <span className="text-red-500">*</span>
              </label>
              <input
                id="auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-transparent focus:ring-2"
                style={{ '--tw-ring-color': TEAL } as React.CSSProperties}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                placeholder={mode === 'signup' ? 'Minst 6 tegn' : ''}
              />
            </div>

            {error && (
              <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: FOREST, color: '#fff' }}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
            </button>
          </form>

          {/* Whistle link (login only) */}
          {mode === 'login' && (
            <p className="mt-6 border-t border-neutral-200 pt-5 text-center text-xs text-neutral-500">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Varsling (AML kap. 2A)</span>
              <span className="mt-2 block leading-relaxed">
                Varsle om kritikkverdige forhold <strong>uten å logge inn</strong> via lenken du har fått fra arbeidsgiver.
              </span>
              <Link to="/varsle/0000000000004000a000000000000001" className="mt-2 inline-block font-medium underline" style={{ color: FOREST }}>
                Varsle anonymt (demo)
              </Link>
              <span className="mx-2 text-neutral-300">·</span>
              <Link to="/varsle/status" className="font-medium underline" style={{ color: FOREST }}>Sjekk status</Link>
            </p>
          )}

          {/* Switch mode */}
          <p className="mt-6 text-center text-sm text-neutral-500">
            {mode === 'login' ? (
              <>Har du ikke konto?{' '}
                <Link to={signupHref} className="font-semibold underline" style={{ color: FOREST }}>Registrer deg</Link>
              </>
            ) : (
              <>Har du allerede konto?{' '}
                <Link to={loginHref} className="font-semibold underline" style={{ color: FOREST }}>Logg inn</Link>
              </>
            )}
          </p>

          {/* Team sign-in note (signup only) */}
          {mode === 'signup' && (
            <p className="mt-3 text-center text-xs text-neutral-400">
              Teamet ditt har allerede en konto?{' '}
              <Link to={loginHref} className="font-medium" style={{ color: FOREST }}>Logg inn</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
