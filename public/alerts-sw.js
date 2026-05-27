// Alerts intake — service worker.
//
// Caches the public intake shell so a returning user can at least open the
// page and see the danger banner offline. Submit + status RPCs require
// network; we explicitly do NOT cache those.
//
// Same-origin only. Never caches any third-party origin.

const CACHE_NAME = 'alerts-public-v1'
const SHELL = [
  '/alerts/public',
  '/alerts/public/resume',
  '/alerts-manifest.webmanifest',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => null)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Same-origin only.
  if (url.origin !== self.location.origin) return

  // NEVER cache the public RPC paths — they must always hit the network.
  if (
    url.pathname.startsWith('/rest/v1/rpc/public_') ||
    url.pathname.startsWith('/functions/v1/alerts-')
  ) {
    return
  }

  // Cache-first for shell assets.
  if (SHELL.some((p) => url.pathname === p || url.pathname.startsWith(p))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => null)
          }
          return res
        }).catch(() => caches.match('/alerts/public') as Promise<Response>)
      }),
    )
    return
  }

  // Network-first for everything else under /alerts/public.
  if (url.pathname.startsWith('/alerts/public')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request) as Promise<Response>),
    )
  }
})
