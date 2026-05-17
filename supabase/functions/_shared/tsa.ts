// RFC 3161 Time-Stamping Authority client.
//
// One submit() per supported provider (Buypass, DigiCert, Difi). The
// transport is identical (HTTP POST application/timestamp-query); only
// the endpoint URL and authentication scheme differs.
//
// PRODUCTION: each provider URL is read from env vars:
//   TSA_BUYPASS_URL  / TSA_BUYPASS_BASIC_AUTH
//   TSA_DIGICERT_URL / TSA_DIGICERT_BASIC_AUTH
//   TSA_DIFI_URL     / TSA_DIFI_BASIC_AUTH
// When set, we build a real RFC 3161 TimeStampReq (ASN.1 DER) over the
// supplied merkle root, POST it, and parse the TimeStampToken from the
// TimeStampResp body.
//
// STUB MODE: when the URL env var is unset, submit() returns a synthetic
// token so the rest of the pipeline (compose / verify / UI) can be tested
// end-to-end without a vendor contract. The stub clearly marks the
// serial with 'STUB-' so audit reviewers cannot confuse it with a real
// qualified timestamp.
//
// TODO (vendor-contract gates):
//   1. Buypass — Qualified Timestamp service requires a signed avtale.
//      RFC 3161 endpoint: https://timestamp.buypass.com/. Basic-auth
//      with client id + shared secret.
//   2. DigiCert — Universal Timestamp Service. RFC 3161 endpoint:
//      http://timestamp.digicert.com (free for non-commercial; QTSP
//      tier requires contract).
//   3. Difi-TSA — when available (currently Difi delegates timestamping
//      to Buypass under the eIDAS QTSP framework — implementation TBD).

export type TsaProvider = 'buypass' | 'digicert' | 'difi'

/**
 * Effective provider written into workflow_evidence_anchors.tsa_provider.
 * In STUB mode this is the literal 'stub' so anchor rows reflect the
 * fact-of-stubbing even though the caller requested e.g. 'buypass'.
 * (The DB check constraint was extended to accept 'stub' in
 * migration _125000_tsa_provider_stub_value.)
 */
export type TsaEffectiveProvider = TsaProvider | 'stub'

export type TsaResponse = {
  serial: string
  token: Uint8Array
  signedAt: string
  stub: boolean
  /** What the caller should write to workflow_evidence_anchors.tsa_provider. */
  effectiveProvider: TsaEffectiveProvider
}

/**
 * Submit a Merkle root to a TSA provider for RFC 3161 timestamping.
 *
 * @param merkleRoot Hex-encoded sha256 over the anchor's leaves.
 * @param provider   'buypass' | 'digicert' | 'difi'.
 */
export async function submitToTsa(
  merkleRoot: string,
  provider: TsaProvider,
): Promise<TsaResponse> {
  const envKey = `TSA_${provider.toUpperCase()}_URL`
  const authKey = `TSA_${provider.toUpperCase()}_BASIC_AUTH`
  const url = Deno.env.get(envKey)
  const basicAuth = Deno.env.get(authKey)

  if (!url) {
    // STUB MODE — no vendor URL configured. Promote the log line to
    // error-level so production log filters surface the warning; a real
    // production deployment must set TSA_<PROVIDER>_URL.
    console.error(
      `[TSA STUB MODE] ${envKey} is unset. Returning synthetic timestamp ` +
        'for development. Set the env var to a real RFC 3161 endpoint in production.',
    )
    return buildStubResponse(merkleRoot, provider)
  }

  // REAL MODE — build the TimeStampReq and POST to the provider.
  const reqBody = buildTimeStampReq(merkleRoot)

  const headers: Record<string, string> = {
    'Content-Type': 'application/timestamp-query',
    Accept: 'application/timestamp-reply',
  }
  if (basicAuth) {
    headers.Authorization = `Basic ${basicAuth}`
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: reqBody,
    })
  } catch (e) {
    throw new TsaError(
      `tsa.submit(${provider}): network error: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  if (!res.ok) {
    throw new TsaError(
      `tsa.submit(${provider}): HTTP ${res.status} ${res.statusText}`,
    )
  }

  const buf = new Uint8Array(await res.arrayBuffer())
  const parsed = parseTimeStampResp(buf)

  return {
    serial: parsed.serial,
    token: parsed.token,
    signedAt: parsed.signedAt ?? new Date().toISOString(),
    stub: false,
    effectiveProvider: provider,
  }
}

// ─── Stub helpers ────────────────────────────────────────────────────────

function buildStubResponse(merkleRoot: string, provider: TsaProvider): TsaResponse {
  const serial = `STUB-${provider.toUpperCase()}-${crypto.randomUUID()}`
  const tokenPayload = JSON.stringify({
    _stub: true,
    provider,
    merkleRoot,
    serial,
    signedAt: new Date().toISOString(),
    _note: 'This is NOT a real RFC 3161 token. Set TSA_<PROVIDER>_URL to enable production signing.',
  })
  return {
    serial,
    token: new TextEncoder().encode(tokenPayload),
    signedAt: new Date().toISOString(),
    stub: true,
    // 'stub' propagates into workflow_evidence_anchors.tsa_provider so
    // ops can monitor stub-vs-real anchor counts (see view
    // workflow_evidence_anchors_stub_count in migration _125000).
    effectiveProvider: 'stub',
  }
}

// ─── ASN.1 / RFC 3161 helpers (minimal) ──────────────────────────────────
//
// We build a TimeStampReq as a DER-encoded SEQUENCE:
//   version (INTEGER 1)
//   messageImprint (SEQUENCE {hashAlgorithm, hashedMessage})
//   reqPolicy (OPTIONAL — omitted)
//   nonce (INTEGER — random)
//   certReq (BOOLEAN — true)
// This is a hand-rolled minimal encoder so we don't pull a full ASN.1
// library into the edge function. It's only used in production path; the
// stub never calls it. If we ever need richer ASN.1 (parsing the
// TimeStampToken's signed attributes, validating the TSA cert chain),
// swap in `npm:asn1js` via esm.sh.

function buildTimeStampReq(merkleRootHex: string): Uint8Array {
  const hashAlgOid = oidSha256()
  const hashedMessage = hexToBytes(merkleRootHex)

  const messageImprint = derSequence(
    derSequence(hashAlgOid, derNull()), // AlgorithmIdentifier
    derOctetString(hashedMessage),
  )

  const nonce = crypto.getRandomValues(new Uint8Array(8))
  const certReq = new Uint8Array([0x01, 0x01, 0xff]) // BOOLEAN TRUE
  certReq[0] = 0x01 // tag
  certReq[1] = 0x01 // length
  certReq[2] = 0xff // value

  return derSequence(
    derInteger(new Uint8Array([0x01])), // version 1
    messageImprint,
    derInteger(nonce),
    certReq,
  )
}

function parseTimeStampResp(buf: Uint8Array): {
  serial: string
  token: Uint8Array
  signedAt?: string
} {
  // A TimeStampResp is SEQUENCE { PKIStatusInfo, TimeStampToken OPTIONAL }.
  // We don't fully parse it here — that would require an ASN.1 library.
  // Instead we:
  //   * extract the entire response as the "token" (callers store the raw
  //     DER bytes; offline verifiers like openssl can re-validate)
  //   * fish out a serial-like hex chunk from the response for indexing
  //     (best-effort — the real serial is inside the SignedData's
  //     SignerInfo serialNumber field)
  //
  // For the substrate, this is sufficient: production verifiers will use
  // openssl ts -verify against the stored .tsr bytes; our DB-side serial
  // is just a human-friendly lookup key.

  const serialDigest = sha256HexSync(buf)
  return {
    serial: `RFC3161-${serialDigest.slice(0, 32)}`,
    token: buf,
    signedAt: new Date().toISOString(),
  }
}

// ─── DER primitives ──────────────────────────────────────────────────────

function derLength(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len])
  if (len < 0x100) return new Uint8Array([0x81, len])
  if (len < 0x10000) return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff])
  if (len < 0x1000000)
    return new Uint8Array([0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff])
  return new Uint8Array([
    0x84,
    (len >> 24) & 0xff,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff,
  ])
}

function derWrap(tag: number, content: Uint8Array): Uint8Array {
  const lenBytes = derLength(content.byteLength)
  const out = new Uint8Array(1 + lenBytes.byteLength + content.byteLength)
  out[0] = tag
  out.set(lenBytes, 1)
  out.set(content, 1 + lenBytes.byteLength)
  return out
}

function derSequence(...parts: Uint8Array[]): Uint8Array {
  return derWrap(0x30, concat(parts))
}

function derInteger(bytes: Uint8Array): Uint8Array {
  // Ensure leading byte is < 0x80 (positive integer).
  let v = bytes
  if (v.length > 0 && v[0] >= 0x80) {
    const padded = new Uint8Array(v.length + 1)
    padded[0] = 0x00
    padded.set(v, 1)
    v = padded
  }
  return derWrap(0x02, v)
}

function derOctetString(bytes: Uint8Array): Uint8Array {
  return derWrap(0x04, bytes)
}

function derNull(): Uint8Array {
  return new Uint8Array([0x05, 0x00])
}

function oidSha256(): Uint8Array {
  // 2.16.840.1.101.3.4.2.1
  return new Uint8Array([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01])
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.byteLength, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.byteLength
  }
  return out
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '').toLowerCase()
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16)
  }
  return out
}

function sha256HexSync(buf: Uint8Array): string {
  // Synchronous-looking signature but we actually need WebCrypto async.
  // Use a tiny FNV-1a fallback for the indexing serial — this is NOT a
  // cryptographic substitute, just a human-readable handle.
  let h = 0x811c9dc5
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i]
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return ('00000000' + h.toString(16)).slice(-8).padEnd(32, '0')
}
// (Note: the parseTimeStampResp serial is a non-crypto digest for index
// lookups. The real RFC 3161 serial is inside the SignedData.SignerInfo
// — extract that with openssl ts -text -in <token>.)

// ─── Error type ──────────────────────────────────────────────────────────

export class TsaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TsaError'
  }
}
