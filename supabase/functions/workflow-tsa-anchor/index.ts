/**
 * workflow-tsa-anchor — RFC 3161 timestamper for evidence anchors.
 *
 * Input: { anchor_id: uuid, organization_id?: uuid }
 *
 * Flow:
 *   1. Load the pending anchor (workflow_evidence_anchors).
 *   2. Pick a TSA provider (env: TSA_DEFAULT_PROVIDER, default 'buypass').
 *   3. submitToTsa(merkle_root, provider) — returns { serial, token,
 *      signedAt }. In STUB MODE (no TSA_<PROVIDER>_URL env var) this is
 *      a synthetic token clearly marked 'STUB-<uuid>'.
 *   4. Upload the token bytes to the workflow-tsa-tokens bucket at
 *      <org_id_or___platform__>/<anchor_id>.tsr.
 *   5. RPC workflow_record_anchor_signed to commit the metadata
 *      (pending → signed) and append a 'sign' build log row.
 *
 * Auth: invoked by the monthly cron via pg_net (Authorization: service
 * role) or manually by an org admin via the AnchorStatusCard
 * "Re-sign" affordance.
 *
 * On any failure, calls workflow_record_anchor_failed so the anchor
 * surfaces in the UI with a clear reason.
 *
 * Arbeidstilsynet self-audit: GDPR Art. 32, Arkivforskriften § 7, eIDAS
 * Trust Services Regulation. The anchor is the external trust point that
 * upgrades our internal Merkle chain from "tamper-evident" to "legally
 * binding evidence".
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { submitToTsa, type TsaProvider, TsaError } from '../_shared/tsa.ts'
import { assertCallerOrg, GuardError, isServiceRole } from '../_shared/auth.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Body = {
  anchor_id?: string
  organization_id?: string
  provider?: TsaProvider
}

type AnchorRow = {
  id: string
  organization_id: string | null
  merkle_root_sha256: string
  status: string
  period_start: string
  period_end: string
}

function serviceRoleClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const anchorId = body.anchor_id
  if (!anchorId) {
    return json({ error: 'anchor_id_required' }, 400)
  }
  const provider: TsaProvider =
    body.provider ?? ((Deno.env.get('TSA_DEFAULT_PROVIDER') as TsaProvider) || 'buypass')

  if (!['buypass', 'digicert', 'difi'].includes(provider)) {
    return json({ error: 'unknown_provider', provider }, 400)
  }

  const supabase = serviceRoleClient()

  // 1. Load the anchor.
  const { data: anchor, error: aErr } = await supabase
    .from('workflow_evidence_anchors')
    .select('id, organization_id, merkle_root_sha256, status, period_start, period_end')
    .eq('id', anchorId)
    .maybeSingle<AnchorRow>()

  if (aErr) {
    return json({ error: 'anchor_lookup_failed', detail: aErr.message }, 500)
  }
  if (!anchor) {
    return json({ error: 'anchor_not_found', anchor_id: anchorId }, 404)
  }
  if (anchor.status !== 'pending') {
    return json(
      { error: 'anchor_not_pending', status: anchor.status, anchor_id: anchorId },
      409,
    )
  }

  // Cross-tenant guard: now that the anchor row is loaded, verify the
  // caller belongs to the anchor's org. Platform-wide anchors
  // (organization_id IS NULL) are signable by the monthly cron only —
  // i.e. service-role — so a non-service caller is rejected outright.
  if (anchor.organization_id) {
    try {
      await assertCallerOrg(req, anchor.organization_id)
    } catch (err) {
      if (err instanceof GuardError) {
        return json({ error: err.code, detail: err.detail }, err.status)
      }
      throw err
    }
  } else if (!isServiceRole(req.headers.get('Authorization') ?? '')) {
    return json({ error: 'cross_org_denied', anchor_id: anchorId }, 403)
  }
  if (!anchor.merkle_root_sha256) {
    await markFailed(supabase, anchorId, 'missing_merkle_root', {})
    return json({ error: 'missing_merkle_root', anchor_id: anchorId }, 500)
  }

  // 2 + 3. Submit to TSA.
  let tsaResult
  try {
    tsaResult = await submitToTsa(anchor.merkle_root_sha256, provider)
  } catch (e) {
    const reason =
      e instanceof TsaError
        ? e.message
        : `tsa_unexpected: ${e instanceof Error ? e.message : String(e)}`
    await markFailed(supabase, anchorId, reason, { provider })
    return json({ error: 'tsa_submit_failed', detail: reason }, 502)
  }

  // 4. Upload token bytes to workflow-tsa-tokens bucket.
  const folder = anchor.organization_id ?? '__platform__'
  const tokenPath = `${folder}/${anchor.id}.tsr`

  const { error: upErr } = await supabase.storage
    .from('workflow-tsa-tokens')
    .upload(tokenPath, tsaResult.token, {
      contentType: tsaResult.stub
        ? 'application/json'
        : 'application/timestamp-reply',
      upsert: true,
    })

  if (upErr) {
    await markFailed(supabase, anchorId, `storage_upload_failed: ${upErr.message}`, {
      provider,
    })
    return json({ error: 'storage_upload_failed', detail: upErr.message }, 500)
  }

  // 5. Commit (pending → signed). We pass the token bytes inline only
  // if they're small (≤ 64 KiB); otherwise we leave it null and rely
  // on the storage path. Limits a 4 MB RPC payload.
  const inlineToken =
    tsaResult.token.byteLength <= 64 * 1024 ? bytesToBase64(tsaResult.token) : null

  const { error: rpcErr } = await supabase.rpc('workflow_record_anchor_signed', {
    p_anchor_id: anchorId,
    // Use the effective provider — 'stub' when STUB MODE is active so
    // workflow_evidence_anchors.tsa_provider reflects fact-of-stubbing.
    p_provider: tsaResult.effectiveProvider,
    p_serial: tsaResult.serial,
    p_token_path: tokenPath,
    // bytea via supabase-js: PostgREST accepts \\x-prefixed hex strings.
    p_token: inlineToken ? `\\x${base64ToHex(inlineToken)}` : null,
    p_signed_at: tsaResult.signedAt,
  })

  if (rpcErr) {
    await markFailed(supabase, anchorId, `rpc_record_signed_failed: ${rpcErr.message}`, {
      provider,
    })
    return json({ error: 'rpc_record_signed_failed', detail: rpcErr.message }, 500)
  }

  return json({
    ok: true,
    anchor_id: anchorId,
    provider,
    serial: tsaResult.serial,
    token_path: tokenPath,
    signed_at: tsaResult.signedAt,
    stub: tsaResult.stub,
  })
})

async function markFailed(
  supabase: ReturnType<typeof serviceRoleClient>,
  anchorId: string,
  reason: string,
  detail: Record<string, unknown>,
) {
  try {
    await supabase.rpc('workflow_record_anchor_failed', {
      p_anchor_id: anchorId,
      p_reason: reason,
      p_detail: detail,
    })
  } catch (e) {
    console.error('workflow-tsa-anchor: markFailed RPC errored:', e)
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function base64ToHex(b64: string): string {
  const bin = atob(b64)
  let hex = ''
  for (let i = 0; i < bin.length; i++) {
    const h = bin.charCodeAt(i).toString(16)
    hex += h.length === 1 ? '0' + h : h
  }
  return hex
}
