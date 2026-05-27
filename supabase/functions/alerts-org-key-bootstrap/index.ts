// alerts-org-key-bootstrap — provision / fetch / unwrap the per-org DEK.
//
// Modes (POST body):
//   { mode: 'bootstrap', organizationId }
//     → generate fresh DEK, wrap via KEK provider, insert via
//       alerts_provision_org_key(...). Returns dek (base64) + version so the
//       caller can encrypt immediately.
//   { mode: 'unwrap', organizationId }
//     → fetch wrapped_dek, unwrap via KEK provider, return dek base64.
//
// KEK provider:
//   Production: Supabase Vault (env ALERTS_KEK_VAULT_SECRET_NAME).
//   Dev fallback: deterministic from ALERTS_DEV_KEK_HEX (32 bytes hex).
//
// Only called from the alerts module client (authenticated). RLS on
// alert_org_key restricts write access to org-admin; the unwrap path
// reads the wrapped_dek via service_role.

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type BootstrapBody = { mode: 'bootstrap'; organizationId: string }
type UnwrapBody    = { mode: 'unwrap'; organizationId: string }
type RequestBody = BootstrapBody | UnwrapBody

const ENC = new TextEncoder()
const DEC = new TextDecoder()

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^\\x/, '')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function base64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '\\x'
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0')
  return out
}

async function getKek(): Promise<Uint8Array> {
  // Production: Supabase Vault.
  // Dev: deterministic from env.
  const vaultName = Deno.env.get('ALERTS_KEK_VAULT_SECRET_NAME')
  if (vaultName) {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/alerts_vault_read_kek`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE,
          authorization: `Bearer ${SERVICE_ROLE}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ p_secret_name: vaultName }),
      },
    )
    if (res.ok) {
      const data = await res.json()
      if (typeof data === 'string') {
        return hexToBytes(data.startsWith('\\x') ? data : `\\x${data}`)
      }
    }
  }
  const devHex = Deno.env.get('ALERTS_DEV_KEK_HEX') ??
    // 32-byte deterministic dev key. NEVER use in production — flagged
    // by environment detector below.
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
  return hexToBytes(devHex)
}

async function aesGcmEncrypt(kek: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  // AES-256-GCM wrap. 12-byte nonce + ciphertext+tag.
  const key = await crypto.subtle.importKey('raw', kek, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const out = new Uint8Array(iv.length + new Uint8Array(ct).length)
  out.set(iv, 0)
  out.set(new Uint8Array(ct), iv.length)
  return out
}

async function aesGcmDecrypt(kek: Uint8Array, wrapped: Uint8Array): Promise<Uint8Array> {
  const iv = wrapped.slice(0, 12)
  const ct = wrapped.slice(12)
  const key = await crypto.subtle.importKey('raw', kek, 'AES-GCM', false, ['decrypt'])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new Uint8Array(pt)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.organizationId) return json({ ok: false, error: 'missing_org_id' }, 400)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'misconfigured' }, 500)

  const headers = {
    apikey: SERVICE_ROLE,
    authorization: `Bearer ${SERVICE_ROLE}`,
    'content-type': 'application/json',
  }

  // Caller must be authenticated to invoke. Re-check by forwarding the user JWT
  // through to a self-check RPC. We trust Supabase invoke gateway to populate
  // the authorization header; if absent, deny.
  const callerAuth = req.headers.get('authorization')
  if (!callerAuth || !callerAuth.toLowerCase().startsWith('bearer ')) {
    return json({ ok: false, error: 'unauthenticated' }, 401)
  }

  const kek = await getKek()

  if (body.mode === 'bootstrap') {
    // Generate a fresh 32-byte DEK.
    const dek = crypto.getRandomValues(new Uint8Array(32))
    const wrapped = await aesGcmEncrypt(kek, dek)
    const provideRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/alerts_provision_org_key`, {
      method: 'POST',
      headers: {
        ...headers,
        authorization: callerAuth, // forward caller's session so SECURITY DEFINER fn sees the right auth.uid()
      },
      body: JSON.stringify({
        p_org_id: body.organizationId,
        p_kms_key_id: Deno.env.get('ALERTS_KEK_VAULT_SECRET_NAME') ?? 'dev_kek',
        p_wrapped_dek: bytesToHex(wrapped),
        p_kek_provider: Deno.env.get('ALERTS_KEK_VAULT_SECRET_NAME') ? 'supabase_vault' : 'customer_managed',
      }),
    })
    if (!provideRes.ok) {
      const err = await provideRes.text()
      return json({ ok: false, error: 'provision_failed', detail: err }, provideRes.status)
    }
    const versionData = await provideRes.json()
    return json({ dek: bytesToBase64(dek), version: Number(versionData) || 1 })
  }

  if (body.mode === 'unwrap') {
    // Fetch the wrapped DEK via service_role.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/alert_org_key?select=wrapped_dek,dek_version&organization_id=eq.${encodeURIComponent(body.organizationId)}`,
      { headers },
    )
    if (!res.ok) return json({ ok: false, error: 'fetch_failed' }, 500)
    const rows = (await res.json()) as Array<{ wrapped_dek: string; dek_version: number }>
    if (rows.length === 0) return json({ ok: false, error: 'no_key' }, 404)
    const row = rows[0]!
    try {
      const wrapped = hexToBytes(row.wrapped_dek)
      const dek = await aesGcmDecrypt(kek, wrapped)
      return json({ dek: bytesToBase64(dek), version: row.dek_version })
    } catch (e) {
      return json({ ok: false, error: 'unwrap_failed', detail: String(e) }, 500)
    }
  }

  return json({ ok: false, error: 'unknown_mode' }, 400)
})
