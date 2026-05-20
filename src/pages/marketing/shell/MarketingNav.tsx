// Sticky top nav for marketing pages — onDark variant on top of forest backgrounds.
// Hash links resolve relative to /; React Router handles cross-page anchors.

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { KlarertLogo } from '../../../components/brand/KlarertLogo'
import { getNavLinks } from '../content/navigation'
import { useT } from '../../../hooks/useT'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'

export function MarketingNav() {
  const { t } = useT()
  const navLinks = getNavLinks(t)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const navBg = isLanding ? FOREST : '#ffffff'
  const linkColor = isLanding ? 'text-white/70' : 'text-neutral-600'
  const hoverColor = isLanding ? 'hover:text-white' : 'hover:text-neutral-900'
  const borderColor = isLanding ? 'border-white/10' : 'border-neutral-200'
  const logoVariant = isLanding ? 'onDark' : 'onLight'

  return (
    <header className={`sticky top-0 z-50 border-b ${borderColor}`} style={{ background: navBg }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <Link to="/" aria-label={t('marketing.nav.toFrontpage')}>
          <KlarertLogo size={24} variant={logoVariant} />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          {navLinks.map(({ label, to }) => (
            <Link key={label} to={to} className={`${linkColor} ${hoverColor} transition-colors`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className={`hidden rounded-md px-4 py-2 text-sm font-medium transition md:inline-flex ${
              isLanding ? 'border border-white/30 text-white hover:bg-white/10' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t('marketing.nav.login')}
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{ background: TEAL, color: FOREST }}
          >
            {t('marketing.nav.tryFree')}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={t('marketing.nav.menu')}
            aria-expanded={open}
            className={`flex size-9 items-center justify-center rounded-md md:hidden ${
              isLanding ? 'text-white hover:bg-white/10' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
              {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className={`border-t md:hidden ${borderColor}`} style={{ background: navBg }}>
          <div className="mx-auto max-w-6xl px-4 py-4 md:px-8">
            <div className="flex flex-col gap-3 text-sm font-medium">
              {navLinks.map(({ label, to }) => (
                <Link
                  key={label}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={`${linkColor} ${hoverColor} transition-colors`}
                >
                  {label}
                </Link>
              ))}
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className={`${linkColor} ${hoverColor} transition-colors`}
              >
                {t('marketing.nav.login')}
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
