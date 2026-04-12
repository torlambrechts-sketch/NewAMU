import { lazy, Suspense } from 'react'

const SafeAnalytics = lazy(() =>
  import('@vercel/analytics/react')
    .then((m) => ({ default: m.Analytics }))
    .catch(() => ({ default: () => null })),
)

const SafeSpeedInsights = lazy(() =>
  import('@vercel/speed-insights/react')
    .then((m) => ({ default: m.SpeedInsights }))
    .catch(() => ({ default: () => null })),
)

/**
 * Lazy-load Vercel metrics; if the chunk fails (CDN, adblock, bundler), the app still mounts.
 */
export function OptionalVercelMetrics() {
  return (
    <Suspense fallback={null}>
      <SafeAnalytics />
      <SafeSpeedInsights />
    </Suspense>
  )
}
