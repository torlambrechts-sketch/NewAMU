import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '../i18n/strings'
import { useI18n } from '../hooks/useI18n'
import { SearchableSelect } from './ui/SearchableSelect'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="hidden text-xs text-white/70 sm:inline">{t('shell.language')}</span>
      <div className="max-w-[9rem]">
        <SearchableSelect
          value={locale}
          onChange={(v) => void setLocale(v as AppLocale)}
          options={APP_LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
        />
      </div>
    </label>
  )
}
