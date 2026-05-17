/**
 * gov-altinn-submit — generic Altinn 3 REST envelope.
 *
 * Used directly by the workflow action `altinn_send_melding`, and also
 * the transport layer that gov-nav-sykefravar (DSOP) calls into.
 *
 * Auth: Maskinporten JWT bearer-grant signed with virksomhetssertifikat.
 * Endpoint: POST {altinn_base}/storage/api/v1/instances + body envelope.
 *
 * Per-skjema TT02 sandbox availability varies — the activation wizard
 * MUST verify TT02 works for the requested skjema before flipping
 * environment=prod. We don't sanity-check it here at submission time.
 *
 * _127600: respects per-rule runtime_environment. When payload.runtime
 * _environment === 'test' we force TT02 regardless of the org-level
 * integration status (defence-in-depth — the canvas UI promotion guard
 * is the primary control, but the edge fn must not trust it alone).
 */
import {
  getMaskinportenAccessToken,
  resolveMaskinportenCredentials,
  type MaskinportenEnv,
} from '../_shared/maskinporten.ts'
import {
  buildIdempotencyKey,
  recordRegulatorEvidence,
  serviceRoleClient,
  type CommonRequestBody,
} from '../_shared/govEvidence.ts'

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

const ALTINN_SCOPE_DEFAULT = 'altinn:instances.write altinn:serviceowner/instances.write'

type Payload = {
  tjeneste: string
  skjema: string
  recipientOrgnr?: string
  bodyJson?: string
  attachments?: { name: string; storagePath: string }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: CommonRequestBody & { dryRun?: boolean }
  try {
    body = (await req.json()) as CommonRequestBody & { dryRun?: boolean }
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  // Short-circuit for setup-wizard "Test forbindelsen". No regulator call,
  // no evidence write — we just confirm the function is wired up.
  if (body.dryRun === true) {
    return json({ ok: true, mode: 'dry-run', detail: 'altinn-submit reachable' })
  }
  const { organization_id, rule_id, run_id, payload } = body
  if (!organization_id || !rule_id || !run_id || !payload) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  const p = payload as Partial<Payload>
  if (!p.tjeneste || !p.skjema) {
    return json({ ok: false, error: 'missing_tjeneste_or_skjema' }, 400)
  }

  const supabase = serviceRoleClient()

  const { data: integration, error: intErr } = await supabase
    .from('org_integrations')
    .select('config, environment, enabled')
    .eq('organization_id', organization_id)
    .eq('kind', 'altinn')
    .maybeSingle()
  if (intErr) return json({ ok: false, error: 'integration_lookup_failed', detail: intErr.message }, 500)
  if (!integration || !integration.enabled) {
    return json({ ok: false, error: 'integration_not_enabled' }, 400)
  }

  // _127600: per-rule runtime_environment overrides org_integrations.status.
  // When the rule is 'test' we force TT02 endpoints regardless of how the
  // integration row is configured. Default 'test' if missing (defence-in-
  // depth — a missing field must never accidentally hit production).
  const ruleRuntimeEnv: 'test' | 'prod' =
    (payload as Record<string, unknown>).runtime_environment === 'prod' ? 'prod' : 'test'
  const orgEnv = (integration.environment as MaskinportenEnv) ?? 'tt02'
  const environment: MaskinportenEnv = ruleRuntimeEnv === 'test' ? 'tt02' : orgEnv
  const config = (integration.config as Record<string, string> | null) ?? {}
  const clientId = config.client_id
  if (!clientId) return json({ ok: false, error: 'missing_client_id_in_config' }, 400)
  const altinnBase =
    environment === 'tt02'
      ? config.altinn_base_url ?? 'https://platform.tt02.altinn.no'
      : config.altinn_base_url ?? 'https://platform.altinn.no'

  let privateKeyPem: string
  let kid: string
  try {
    const creds = await resolveMaskinportenCredentials(supabase, organization_id, 'altinn', environment)
    privateKeyPem = creds.privateKeyPem
    kid = creds.kid
  } catch (err) {
    return json({ ok: false, error: 'maskinporten_credentials_missing', detail: (err as Error).message }, 500)
  }

  const idempotencyKey = await buildIdempotencyKey(body)

  let accessToken: string
  try {
    const tok = await getMaskinportenAccessToken({
      clientId,
      scope: config.scope ?? ALTINN_SCOPE_DEFAULT,
      environment,
      privateKeyPem,
      kid,
    })
    accessToken = tok.accessToken
  } catch (err) {
    return json({ ok: false, error: 'maskinporten_failed', detail: (err as Error).message }, 502)
  }

  const submissionBody = JSON.stringify(
    {
      tjeneste: p.tjeneste,
      skjema: p.skjema,
      recipientOrgnr: p.recipientOrgnr ?? config.default_recipient ?? null,
      body: p.bodyJson ? JSON.parse(p.bodyJson) : {},
      attachments: p.attachments ?? [],
    },
    null,
    2,
  )

  const endpoint = `${altinnBase}/storage/api/v1/instances`

  let receipt: Record<string, unknown> = {}
  let status = 0
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: submissionBody,
    })
    status = res.status
    receipt = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      return json({ ok: false, error: 'altinn_rejected', status, detail: receipt }, 502)
    }
  } catch (err) {
    return json({ ok: false, error: 'altinn_unreachable', detail: (err as Error).message }, 502)
  }

  try {
    const bodyEv = await recordRegulatorEvidence(supabase, {
      runId: run_id,
      ruleId: rule_id,
      orgId: organization_id,
      artefactKind: 'gov_submission_body',
      body: submissionBody,
      mimeType: 'application/json',
      fileNameSuffix: `altinn-${p.skjema}-submission.json`,
      lawRefs: [],
      frameworks: [],
      metadata: {
        environment,
        ruleRuntimeEnv,
        orgEnv,
        idempotencyKey,
        tjeneste: p.tjeneste,
        skjema: p.skjema,
      },
    })
    const receiptEv = await recordRegulatorEvidence(supabase, {
      runId: run_id,
      ruleId: rule_id,
      orgId: organization_id,
      artefactKind: 'regulator_receipt',
      body: JSON.stringify(receipt, null, 2),
      mimeType: 'application/json',
      fileNameSuffix: `altinn-${p.skjema}-receipt.json`,
      lawRefs: [],
      frameworks: [],
      metadata: {
        environment,
        ruleRuntimeEnv,
        orgEnv,
        status,
        regulator: 'altinn',
        tjeneste: p.tjeneste,
        skjema: p.skjema,
      },
    })

    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'ok' })
      .eq('organization_id', organization_id)
      .eq('kind', 'altinn')

    return json({
      ok: true,
      idempotencyKey,
      environment,
      receipt: { id: receiptEv.evidenceId, checksum: receiptEv.checksum, storagePath: receiptEv.storagePath },
      submission: { id: bodyEv.evidenceId, checksum: bodyEv.checksum },
    })
  } catch (err) {
    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'failed' })
      .eq('organization_id', organization_id)
      .eq('kind', 'altinn')
    return json({ ok: false, error: 'evidence_recording_failed', detail: (err as Error).message }, 500)
  }
})
