// Shared layout for all public marketing routes.
// Sticky nav + Suspense + footer; child page renders inside <Outlet/>.

import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MarketingNav } from './MarketingNav'
import { MarketingFooter } from './MarketingFooter'

export function MarketingShell() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <MarketingNav />
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
      <MarketingFooter />
    </div>
  )
}
