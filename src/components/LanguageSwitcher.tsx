import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '../i18n/strings'
import { useI18n } from '../hooks/useI18n'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="hidden text-xs text-white/70 sm:inline">{t('shell.language')}</span>
      <select
        value={locale}
        onChange={(e) => void setLocale(e.target.value as AppLocale)}
        className="max-w-[9rem] rounded-lg border border-white/25 bg-white/10 py-1 pl-2 pr-7 text-xs text-white focus:border-[#c9a227] focus:outline-none focus:ring-1 focus:ring-[#c9a227]"
        aria-label={t('shell.language')}
      >
        {APP_LOCALES.map((code) => (
          <option key={code} value={code} className="bg-[#1a3d32] text-white">
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  )
}
