// useIntervalWhenVisible — visibility-aware polling primitive.
//
// Wraps setInterval so the timer only runs when the tab is visible.
// Sidebar badge feeds (gov-outbox, amu-agenda, cert-expiry) all poll on
// a fixed cadence; pausing while document.hidden is true cuts background
// load by an admin browser's worth of requests per minute. When the tab
// becomes visible again we fire one immediate fetch and resume the
// interval, so badges feel fresh on tab-switch.

import { useEffect, useRef } from 'react'

export function useIntervalWhenVisible(callback: () => void, intervalMs: number, enabled = true) {
  const cbRef = useRef(callback)
  useEffect(() => {
    cbRef.current = callback
  }, [callback])
  useEffect(() => {
    if (!enabled) return
    let id: ReturnType<typeof setInterval> | null = null
    const tick = () => cbRef.current()
    const start = () => {
      if (id !== null) return
      tick()
      id = setInterval(tick, intervalMs)
    }
    const stop = () => {
      if (id !== null) {
        clearInterval(id)
        id = null
      }
    }
    const onVis = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVis)
    if (!document.hidden) start()
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      stop()
    }
  }, [intervalMs, enabled])
}
