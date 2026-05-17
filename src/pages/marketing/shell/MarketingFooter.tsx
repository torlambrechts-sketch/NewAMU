// Five-column footer with the full link map (no href="#" placeholders).
// Used on every marketing page via MarketingShell.

import { Link } from 'react-router-dom'
import { KlarertLogo } from '../../../components/brand/KlarertLogo'
import {
  FOOTER_PRODUCT,
  FOOTER_COMPLIANCE,
  FOOTER_COMPANY,
  FOOTER_LEGAL,
} from '../content/navigation'

const TEAL = '#2dd4bf'

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
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-6">
          <div className="md:col-span-2">
            <KlarertLogo size={22} variant="onLight" />
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-neutral-500">
              Norsk HMS- og compliance-plattform for virksomheter med 5–500 ansatte.
              Bygget på arbeidsmiljøloven, internkontrollforskriften og GDPR — ikke tilpasset etterpå.
            </p>
            <p className="mt-4 text-xs text-neutral-400">
              <span className="font-semibold" style={{ color: TEAL }}>EU-hosting</span> · Supabase Frankfurt + Stockholm
            </p>
          </div>
          <nav aria-label="Produkt" className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Produkt</p>
            {FOOTER_PRODUCT.map((l) => (
              <FooterLink key={l.label} {...l} />
            ))}
          </nav>
          <nav aria-label="Compliance" className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Compliance</p>
            {FOOTER_COMPLIANCE.map((l) => (
              <FooterLink key={l.label} {...l} />
            ))}
          </nav>
          <nav aria-label="Selskapet" className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Selskapet</p>
            {FOOTER_COMPANY.map((l) => (
              <FooterLink key={l.label} {...l} />
            ))}
          </nav>
        </div>
        <div className="mt-12 border-t border-neutral-100 pt-6 text-xs text-neutral-500">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: '#22c55e' }} />
              Datasenter: EU (Frankfurt + Stockholm)
            </span>
            <span>Org.nr.: TBD</span>
            <span>Oslo, Norge</span>
            <a href="mailto:hei@klarert.com" className="transition-colors hover:text-neutral-700">
              hei@klarert.com
            </a>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-neutral-400">
            <p>© {new Date().getFullYear()} Klarert.com. Alle rettigheter forbeholdt.</p>
            <div className="flex gap-6">
              {FOOTER_LEGAL.map((l) => (
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
