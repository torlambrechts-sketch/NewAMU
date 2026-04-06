import { useState, type FormEvent, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2, Shield } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { mapAuthError } from '../../lib/authErrors'

export function PlatformAdminLoginPage() {
  const supabase = getSupabaseBrowserClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/platform-admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        navigate(redirect, { replace: true })
      }
    })
  }, [supabase, navigate, redirect])

  if (!supabase) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-neutral-600">
        Supabase er ikke konfigurert.
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (err) throw err
      if (!data.session) {
        setError('Ingen aktiv sesjon etter innlogging.')
        return
      }
      navigate(redirect, { replace: true })
    } catch (err: unknown) {
      setError(mapAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-16 text-neutral-100">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <Shield className="size-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Plattformadministrator</h1>
          <p className="text-sm text-neutral-400">
            Egen innlogging for drift av tenants og fakturagrunnlag. Vanlig app finner du på{' '}
            <Link to="/login" className="text-amber-400/90 underline hover:text-amber-300">
              /login
            </Link>
            .
          </p>
        </div>

        <form
          onSubmit={(e) => void submit(e)}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur"
        >
          {error && (
            <div className="mb-4 flex gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
          <label className="block text-xs font-medium text-neutral-400">E-post</label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 placeholder:text-neutral-500"
            required
          />
          <label className="mt-4 block text-xs font-medium text-neutral-400">Passord</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Logg inn
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Første gang: kjør SQL i Supabase for å legge inn din <code className="rounded bg-white/10 px-1">user_id</code> i{' '}
          <code className="rounded bg-white/10 px-1">platform_admins</code>.
        </p>
      </div>
    </div>
  )
}
