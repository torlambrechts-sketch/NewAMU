// Envelope encryption for the alerts module (v1.1 §1).
//
// Implements XChaCha20-Poly1305-IETF via @noble/ciphers (pure JS, no WASM).
// Storage format per spec: version(1 byte) || nonce(24 bytes) || ciphertext.
// Key hierarchy: External KMS / Supabase Vault → Per-org KEK → Per-org DEK
// (wrapped, stored in alert_org_key) → Per-record encryption with fresh nonce.
//
// The DEK is fetched once per session via `alerts-org-key-bootstrap` (which
// has KEK access on the server side) and cached in memory only. Never
// persisted to localStorage.

import type { SupabaseClient } from '@supabase/supabase-js'
import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'

const VERSION_BYTE = 0x01
const NONCE_LEN = 24
const VERSION_LEN = 1

type CachedKey = {
  orgId: string
  dek: Uint8Array
  dekVersion: number
  expiresAt: number
}

let cachedKey: CachedKey | null = null

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(out)
    return out
  }
  // Fallback — shouldn't happen in browsers; keeps SSR happy.
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

function fromBase64(b64: string): Uint8Array {
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Fetches and caches the per-org DEK for the calling user's organisation.
 * The DEK lives only in memory; reload page or change org → fresh fetch.
 */
export async function getOrgKey(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ dek: Uint8Array; version: number } | null> {
  if (cachedKey && cachedKey.orgId === orgId && cachedKey.expiresAt > Date.now()) {
    return { dek: cachedKey.dek, version: cachedKey.dekVersion }
  }
  // The DEK lives wrapped in alert_org_key.wrapped_dek. We fetch the wrapped
  // material + ask the edge function to unwrap (since unwrap requires KEK
  // access via Vault / KMS). For dev mode without a configured KEK, the edge
  // function returns the DEK directly from a deterministic seed.
  const { data, error } = await supabase.functions.invoke('alerts-org-key-bootstrap', {
    body: { mode: 'unwrap', organizationId: orgId },
  })
  if (error || !data || typeof data !== 'object') return null
  const payload = data as { dek?: string; version?: number }
  if (!payload.dek || typeof payload.version !== 'number') return null
  const dek = fromBase64(payload.dek)
  cachedKey = {
    orgId,
    dek,
    dekVersion: payload.version,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  return { dek, version: payload.version }
}

export function clearKeyCache(): void {
  if (cachedKey) {
    // Best-effort zeroisation.
    cachedKey.dek.fill(0)
    cachedKey = null
  }
}

/**
 * Encrypts a string field with the org's DEK. Returns the wire format:
 * [version|nonce|ciphertext] as a Uint8Array.
 */
export async function encryptField(
  supabase: SupabaseClient,
  orgId: string,
  plaintext: string,
): Promise<{ ciphertext: Uint8Array; version: number } | null> {
  const keyMaterial = await getOrgKey(supabase, orgId)
  if (!keyMaterial) return null
  const nonce = randomBytes(NONCE_LEN)
  const cipher = xchacha20poly1305(keyMaterial.dek, nonce)
  const message = new TextEncoder().encode(plaintext)
  const ciphertext = cipher.encrypt(message)
  const out = new Uint8Array(VERSION_LEN + NONCE_LEN + ciphertext.length)
  out[0] = VERSION_BYTE
  out.set(nonce, VERSION_LEN)
  out.set(ciphertext, VERSION_LEN + NONCE_LEN)
  return { ciphertext: out, version: keyMaterial.version }
}

/**
 * Decrypts a [version|nonce|ciphertext] blob. Returns null on failure (bad
 * key, tampered ciphertext, wrong version).
 */
export async function decryptField(
  supabase: SupabaseClient,
  orgId: string,
  blob: Uint8Array,
): Promise<string | null> {
  if (blob.length < VERSION_LEN + NONCE_LEN + 16) return null
  if (blob[0] !== VERSION_BYTE) return null
  const keyMaterial = await getOrgKey(supabase, orgId)
  if (!keyMaterial) return null
  const nonce = blob.slice(VERSION_LEN, VERSION_LEN + NONCE_LEN)
  const ciphertext = blob.slice(VERSION_LEN + NONCE_LEN)
  try {
    const cipher = xchacha20poly1305(keyMaterial.dek, nonce)
    const plaintext = cipher.decrypt(ciphertext)
    return new TextDecoder().decode(plaintext)
  } catch {
    return null
  }
}

/**
 * HMAC an email for lookup ("reporter_email_for_notification_hashed"). The
 * MAC is keyed by the org's DEK so different orgs produce different MACs
 * for the same email — keeps cross-tenant correlation impossible.
 */
export async function hmacEmail(
  supabase: SupabaseClient,
  orgId: string,
  email: string,
): Promise<Uint8Array | null> {
  const keyMaterial = await getOrgKey(supabase, orgId)
  if (!keyMaterial) return null
  const normalised = email.trim().toLowerCase()
  return hmac(sha256, keyMaterial.dek, new TextEncoder().encode(normalised))
}

/**
 * Convenience: convert a Uint8Array to a hex string for storage in bytea
 * columns when going through PostgREST (which serialises bytea as \\x-prefixed
 * hex). PostgREST accepts both Buffer-style base64 and the hex form.
 */
export function bytesToHex(buf: Uint8Array): string {
  let out = '\\x'
  for (let i = 0; i < buf.length; i++) {
    out += buf[i]!.toString(16).padStart(2, '0')
  }
  return out
}

/**
 * Convenience: parse the \\x-prefixed hex string PostgREST returns for bytea
 * back into a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array | null {
  if (!hex.startsWith('\\x')) return null
  const body = hex.slice(2)
  if (body.length % 2 !== 0) return null
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(body.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    out[i] = byte
  }
  return out
}

/** Read a coalesced field: encrypted variant first, plaintext fallback. */
export async function readEncryptedOrPlaintext(
  supabase: SupabaseClient,
  orgId: string,
  encryptedHex: string | null,
  plaintext: string | null,
): Promise<string | null> {
  if (encryptedHex) {
    const bytes = hexToBytes(encryptedHex)
    if (bytes) {
      const plain = await decryptField(supabase, orgId, bytes)
      if (plain !== null) return plain
    }
  }
  return plaintext
}
