/**
 * Level 1 "system signatures": stable JSON + SHA-256 for integrity evidence.
 * Not a qualified eIDAS signature — see roadmap for BankID / QES (level 2).
 */

import type { Level1SystemSignatureMeta } from '../types/level1Signature'

export const LEVEL1_ALGORITHM = 'SHA-256' as const

/** Short UI line for signed records (full hash in DB + on object). */
export function formatLevel1AuditLine(meta?: Level1SystemSignatureMeta | null): string | null {
  if (!meta?.documentHashSha256) return null
  const short = meta.documentHashSha256.slice(0, 14)
  return `Nivå 1 (${meta.algorithm ?? LEVEL1_ALGORITHM}): ${short}… · ${new Date(meta.recordedAt).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}`
}

export type Level1SignatureEvidence = Level1SystemSignatureMeta

/** Deterministic JSON for hashing (sorted object keys). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableStringify(x)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export async function sha256HexUtf8(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = enc.encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashDocumentPayload(payload: unknown): Promise<string> {
  return sha256HexUtf8(stableStringify(payload))
}

/** Best-effort public IP for audit trail (may fail offline / strict networks). */
export async function fetchClientIpBestEffort(timeoutMs = 2500): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = window.setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal })
    window.clearTimeout(t)
    if (!res.ok) return null
    const j = (await res.json()) as { ip?: string }
    return typeof j.ip === 'string' && j.ip.length > 0 ? j.ip : null
  } catch {
    return null
  }
}
