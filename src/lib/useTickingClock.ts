// Shared 60-second-resolution wall clock for components that need to react
// to elapsed time (e.g. the 15-minute comment edit window, retention
// countdowns). Built on useSyncExternalStore so React 19 is happy: the
// snapshot is referentially stable between timer ticks and the subscribe
// function is symmetric.
//
// Multiple consumers share one interval — we ref-count subscribers and
// stop ticking when nobody is listening.

import { useSyncExternalStore } from 'react'

const TICK_MS = 60_000

let cachedNow = Date.now()
const listeners = new Set<() => void>()
let intervalHandle: ReturnType<typeof setInterval> | null = null

function ensureTicking() {
  if (intervalHandle !== null) return
  intervalHandle = setInterval(() => {
    cachedNow = Date.now()
    for (const cb of listeners) cb()
  }, TICK_MS)
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  ensureTicking()
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && intervalHandle !== null) {
      clearInterval(intervalHandle)
      intervalHandle = null
    }
  }
}

function getSnapshot(): number {
  return cachedNow
}

export function useTickingClock(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
