// snapshotDatasets — turn a live dataset map into a JSON-safe, immutable
// blob suitable for storage in dashboard_layouts.snapshot_data. The publish
// RPC enforces a 4 MB ceiling; this util surfaces that limit client-side
// so the builder can show a friendly error before round-tripping.

const REPLACER_MARKER = '__type__' as const

export const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024

export class SnapshotTooLargeError extends Error {
  bytes: number
  constructor(bytes: number) {
    super(`Snapshot is ${bytes} bytes, exceeds ${MAX_SNAPSHOT_BYTES} ceiling.`)
    this.name = 'SnapshotTooLargeError'
    this.bytes = bytes
  }
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return { [REPLACER_MARKER]: 'Date', iso: value.toISOString() }
  }
  if (value instanceof Map) {
    return { [REPLACER_MARKER]: 'Map', entries: [...value.entries()] }
  }
  if (value instanceof Set) {
    return { [REPLACER_MARKER]: 'Set', values: [...value.values()] }
  }
  if (typeof value === 'bigint') {
    return { [REPLACER_MARKER]: 'BigInt', value: value.toString() }
  }
  return value
}

/**
 * Deep-clone the live dataset map into a JSON-safe structure. Map / Set /
 * Date / bigint values are encoded with a discriminator so a later viewer
 * could rehydrate them (the PDF + read-only renderers don't need to —
 * they treat snapshots as opaque JSON).
 */
export function snapshotDatasets(datasets: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(datasets, replacer)
  return JSON.parse(json) as Record<string, unknown>
}

export function snapshotSizeBytes(snapshot: unknown): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength
}

/**
 * Convenience: snapshot + size-guard in one call. Throws SnapshotTooLargeError
 * when the encoded JSON exceeds the publish-RPC limit, so the builder can
 * trap it and show a Norwegian error message instead of round-tripping.
 */
export function snapshotForPublish(datasets: Record<string, unknown>): Record<string, unknown> {
  const snap = snapshotDatasets(datasets)
  const bytes = snapshotSizeBytes(snap)
  if (bytes >= MAX_SNAPSHOT_BYTES) throw new SnapshotTooLargeError(bytes)
  return snap
}
