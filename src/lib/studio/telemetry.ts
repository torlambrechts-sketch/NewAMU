// Studio Builder — telemetry sink (Phase 1 Task 1.3).
//
// Single emit-point that the studio shell + hooks call. Phase 1 wires
// console + (optional) Vercel Analytics; a real backend pipe lands in
// Phase 2a once the event volume justifies it.
//
// Type union lives in studioTypes.ts so consumers can subscribe without
// pulling in this module's runtime sink.

import type { StudioTelemetryEvent } from './studioTypes'

declare global {
  interface Window {
    va?: (event: 'event', name: string, props: Record<string, unknown>) => void
  }
}

export function emitStudioTelemetry(event: StudioTelemetryEvent): void {
  // 1. Dev console — quick smoke test signal.
  if (import.meta.env.DEV) {
    console.debug('[studio:telemetry]', event.type, event)
  }

  // 2. Vercel Analytics if available — non-blocking, ignore errors.
  // Schema mirrors the event union so downstream dashboards stay aligned
  // with the type definition.
  if (typeof window !== 'undefined' && typeof window.va === 'function') {
    try {
      window.va('event', event.type, { ...event })
    } catch {
      /* analytics is best-effort */
    }
  }
}
