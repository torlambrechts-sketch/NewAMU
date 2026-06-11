// Five-column footer with the full link map (no href="#" placeholders).
// Used on every marketing page via MarketingShell.

import { Link } from 'react-router-dom'
import { KlarertLogo } from '../../../components/brand/KlarertLogo'
import {
  FOOTER_PRODUCT,
  getFooterCompliance,
  getFooterCompany,
  getFooterLegal,
} from '../content/navigation'
import { useT } from '../../../hooks/useT'
import { TEAL } from '../theme'

function FooterLink({ to, label, external }: { to: string; label: string; external?: boolean }) {
  if (external || to.startsWith('mailto:') || to.startsWith('http')) {
    return (
      <a href={to} className="block text-sm text-neutral-600 transition-colors hover:text-neutral-900">
        {label}
      </a>
    )
  }
  return (
    <Link to={to} className="block text-sm text-neutral-600 transition-colors hover:text-neutral-900">
      {label}
    </Link>
  )
}

export function MarketingFooter() {
  const { t } = useT()
  const footerCompliance = getFooterCompliance(t)
  const footerCompany = getFooterCompany(t)
  const footerLegal = getFooterLegal(t)
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-6">
          <div className="md:col-span-2">
            <KlarertLogo size={22} variant="onLight" />
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-neutral-500">
              {t('marketing.footer.blurb')}
            </p>
            <p className="mt-4 text-xs text-neutral-400">
              <span className="font-semibold" style={{ color: TEAL }}>{t('marketing.footer.euHosting')}</span> · Supabase Frankfurt + Stockholm
            </p>
          </div>
          <nav aria-label={t('marketing.footer.colProduct')} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">{t('marketing.footer.colProduct')}</p>
            {FOOTER_PRODUCT.map((l) => (
              <FooterLink key={l.label} {...l} />
            ))}
          </nav>
          <nav aria-label={t('marketing.footer.colCompliance')} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">{t('marketing.footer.colCompliance')}</p>
            {footerCompliance.map((l) => (
              <FooterLink key={l.label} {...l} />
            ))}
          </nav>
          <nav aria-label={t('marketing.footer.colCompany')} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">{t('marketing.footer.colCompany')}</p>
            {footerCompany.map((l) => (
              <FooterLink key={l.label} {...l} />
            ))}
          </nav>
        </div>
        <div className="mt-12 border-t border-neutral-100 pt-6 text-xs text-neutral-500">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: '#22c55e' }} />
              {t('marketing.footer.datacenter')}
            </span>
            <span>{t('marketing.footer.orgnr')}</span>
            <span>{t('marketing.footer.location')}</span>
            <a href="mailto:hei@klarert.com" className="transition-colors hover:text-neutral-700">
              hei@klarert.com
            </a>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-neutral-400">
            <p>© {new Date().getFullYear()} Klarert.com. {t('marketing.footer.rights')}</p>
            <div className="flex gap-6">
              {footerLegal.map((l) => (
                <Link key={l.label} to={l.to} className="transition-colors hover:text-neutral-600">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
