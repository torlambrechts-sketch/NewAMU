// Shared layout for all public marketing routes.
// Provides: sticky nav, skip-to-content link, <main> landmark, scroped focus rings,
// a thin loading bar fallback for lazy chunks, and reliable scroll-to-anchor.

import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MarketingNav } from './MarketingNav'
import { MarketingFooter } from './MarketingFooter'
import { TEAL, SANS } from '../theme'
import { RouteErrorBoundary } from '../../../components/RouteErrorBoundary'
import { useT } from '../../../hooks/useT'

function LazyLoadingBar() {
  const { t } = useT()
  return (
    <div role="progressbar" aria-busy="true" aria-label={t('marketing.shell.loadingPage')} className="h-1 w-full overflow-hidden bg-neutral-100">
      <div className="marketing-shimmer h-full w-1/3 rounded-full" style={{ background: TEAL }} />
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
        .marketing-shimmer { animation: shimmer 1.2s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .marketing-shimmer { animation: none; opacity: 0.6; width: 100%; }
        }
      `}</style>
    </div>
  )
}

export function MarketingShell() {
  const { t } = useT()
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    let cancelled = false
    let attempts = 0
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const tick = () => {
      if (cancelled) return
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
        return
      }
      if (attempts++ < 60) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => {
      cancelled = true
    }
  }, [pathname, hash])

  return (
    <div data-marketing-shell style={{ fontFamily: SANS }}>
      <a
        href="#hovedinnhold"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
        style={{ color: '#1a3d32' }}
      >
        {t('marketing.shell.skipToContent')}
      </a>
      <MarketingNav />
      <main id="hovedinnhold" tabIndex={-1}>
        <RouteErrorBoundary title={t('marketing.shell.pageError')}>
          <Suspense fallback={<LazyLoadingBar />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <MarketingFooter />
      <style>{`
        [data-marketing-shell] a:focus-visible,
        [data-marketing-shell] button:focus-visible,
        [data-marketing-shell] summary:focus-visible {
          outline: 2px solid ${TEAL};
          outline-offset: 3px;
          border-radius: 6px;
        }
        [data-marketing-shell] main:focus { outline: none; }
      `}</style>
    </div>
  )
}
