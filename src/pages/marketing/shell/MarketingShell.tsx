// Shared layout for all public marketing routes.
// Provides: sticky nav, skip-to-content link, <main> landmark, scroped focus rings,
// a thin loading bar fallback for lazy chunks, and reliable scroll-to-anchor.

import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MarketingNav } from './MarketingNav'
import { MarketingFooter } from './MarketingFooter'
import { TEAL, SANS } from '../theme'

function LazyLoadingBar() {
  return (
    <div role="progressbar" aria-busy="true" aria-label="Laster inn side" className="h-1 w-full overflow-hidden bg-neutral-100">
      <div className="h-full w-1/3 animate-[shimmer_1.2s_linear_infinite] rounded-full" style={{ background: TEAL }} />
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
    </div>
  )
}

export function MarketingShell() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    let cancelled = false
    let attempts = 0
    const tick = () => {
      if (cancelled) return
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (attempts++ < 20) requestAnimationFrame(tick)
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
        className="sr-only z-[60] rounded-md bg-white px-4 py-2 text-sm font-semibold shadow-lg ring-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        style={{ color: '#1a3d32', borderColor: TEAL }}
      >
        Hopp til hovedinnhold
      </a>
      <MarketingNav />
      <main id="hovedinnhold" tabIndex={-1}>
        <Suspense fallback={<LazyLoadingBar />}>
          <Outlet />
        </Suspense>
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
