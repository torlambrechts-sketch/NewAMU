import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, User } from 'lucide-react'
import { ModulePageIcon } from '../components/ModulePageIcon'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '../i18n/strings'
import { useI18n } from '../hooks/useI18n'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'

export function ProfilePage() {
  const { t, locale: ctxLocale } = useI18n()
  const { user, profile, supabaseConfigured, updateDisplayName, updateLocale } = useOrgSetupContext()
  const [name, setName] = useState('')
  const [loc, setLoc] = useState<AppLocale>('nb')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? '')
      const l = profile.locale
      setLoc(l === 'en' || l === 'nb' ? l : ctxLocale)
    }
  }, [profile, ctxLocale])

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <p className="text-neutral-600">Supabase er ikke konfigurert.</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <p className="text-neutral-600">
          <Link to="/login" className="text-[#1a3d32] underline">
            {t('shell.logIn')}
          </Link>
        </p>
      </div>
    )
  }

  const save = async () => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      await updateDisplayName(name.trim() || profile?.display_name || 'Bruker')
      await updateLocale(loc)
      setMsg(t('profile.saved'))
    } catch (e) {
      setErr(getSupabaseErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-start gap-4">
        <ModulePageIcon className="bg-[#1a3d32] text-[#c9a227]">
          <User className="size-9 md:size-10" strokeWidth={1.5} aria-hidden />
        </ModulePageIcon>
        <div className="min-w-0">
          <h1
            className="font-serif text-2xl text-[#1a3d32]"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {t('profile.title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">{t('profile.subtitle')}</p>
        </div>
      </div>

      <div className="mt-8 max-w-lg space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-neutral-800">{t('profile.displayName')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-800">{t('profile.locale')}</label>
          <select
            value={loc}
            onChange={(e) => setLoc(e.target.value as AppLocale)}
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            {APP_LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_LABELS[code]}
              </option>
            ))}
          </select>
        </div>
        {err ? <p className="text-sm text-red-700">{err}</p> : null}
        {msg ? <p className="text-sm text-emerald-800">{msg}</p> : null}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? t('profile.saving') : t('profile.save')}
          </button>
          <Link
            to="/"
            className="inline-flex items-center rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
          >
            {t('profile.backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
