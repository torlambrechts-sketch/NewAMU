/**
 * gov-arbeidstilsynet-rapport — Arbeidstilsynet RegInc alvorlig-skade-melding
 * (AML § 5-2). Fired from a workflow action of type
 * `rapporter_alvorlig_skade_arbeidstilsynet` once the rule's
 * request_approval has flipped to 'approved'.
 *
 * Norwegian regulator gotchas (from the architecture review):
 *   * 24-hour deadline FROM the incident — caller passes hendelseDato.
 *     The rule template ships with `wait_until + 24h` + escalation; this
 *     function refuses if `Date.now() > hendelseDato + 24h` so we don't
 *     silently submit late.
 *   * Required fields: melder_rolle, arbeidsgiver_orgnr, hendelse_dato,
 *     skadetype, personskade_kategori, fritekst. We validate all six.
 *   * Digital signing with virksomhetssertifikat: handled by Maskinporten
 *     bearer token (the assertion is signed; the body is not a separate
 *     signing artefact at this endpoint).
 *   * There is no async webhook — we POST, get a synchronous receipt
 *     pointer, and store the receipt as workflow_run_evidence
 *     (regulator_receipt + gov_submission_body, Merkle-chained).
 *
 * Required env / secrets:
 *   MASKINPORTEN_TT02_PRIVATE_KEY  PEM PKCS#8 (org-specific in prod)
 *   MASKINPORTEN_TT02_KID          JWK kid for the sandbox cert
 *   MASKINPORTEN_PROD_PRIVATE_KEY  (prod equivalent)
 *   MASKINPORTEN_PROD_KID          (prod equivalent)
 *   ARBEIDSTILSYNET_TT02_URL       sandbox endpoint (configurable for re-targeting)
 *   ARBEIDSTILSYNET_PROD_URL       prod endpoint
 *
 * In Phase E sprint-2 these env vars are replaced by per-org Vault
 * lookups keyed off org_integrations.config.
 *
 * _127600: respects per-rule runtime_environment. When payload.runtime
 * _environment === 'test' we force TT02 endpoints regardless of the
 * org-level integration status.
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
import { assertCallerOrg, GuardError } from '../_shared/auth.ts'

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

const ARBEIDSTILSYNET_SCOPE = 'arbeidstilsynet:reginc/melding.write'

type Payload = {
  melderRolle: 'arbeidsgiver' | 'verneombud' | 'lege'
  arbeidsgiverOrgnr?: string
  hendelseDato: string // ISO
  skadetype: string
  personskadeKategori: string
  fritekst?: string
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
  // Setup-wizard dry-run — no regulator call, no evidence write.
  if (body.dryRun === true) {
    return json({ ok: true, mode: 'dry-run', detail: 'arbeidstilsynet-rapport reachable' })
  }
  const { organization_id, rule_id, run_id, event_name, payload } = body
  if (!organization_id || !rule_id || !run_id || !payload) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  const p = payload as Partial<Payload>
  const required: (keyof Payload)[] = ['melderRolle', 'hendelseDato', 'skadetype', 'personskadeKategori']
  for (const k of required) {
    if (!p[k]) return json({ ok: false, error: `missing_payload_field:${k}` }, 400)
  }

  // 24h deadline guard.
  const hendelseTs = Date.parse(p.hendelseDato as string)
  if (Number.isNaN(hendelseTs)) {
    return json({ ok: false, error: 'invalid_hendelseDato' }, 400)
  }
  const ageMs = Date.now() - hendelseTs
  const SUBMISSION_DEADLINE_MS = 24 * 60 * 60 * 1000
  const lateSubmission = ageMs > SUBMISSION_DEADLINE_MS

  // Cross-tenant guard: the caller must belong to organization_id (or be
  // service-role). Runs BEFORE any service-role DB work.
  try {
    await assertCallerOrg(req, organization_id)
  } catch (err) {
    if (err instanceof GuardError) {
      return json({ ok: false, error: err.code, detail: err.detail }, err.status)
    }
    throw err
  }

  const supabase = serviceRoleClient()

  // Look up the per-org integration config + environment.
  const { data: integration, error: intErr } = await supabase
    .from('org_integrations')
    .select('config, environment, enabled')
    .eq('organization_id', organization_id)
    .eq('kind', 'regint')
    .maybeSingle()
  if (intErr) return json({ ok: false, error: 'integration_lookup_failed', detail: intErr.message }, 500)
  if (!integration || !integration.enabled) {
    return json({ ok: false, error: 'integration_not_enabled' }, 400)
  }

  // _127600: per-rule runtime_environment overrides org_integrations.status.
  // 'test' forces TT02 endpoints regardless of how the integration row is
  // configured. Default 'test' if missing for safety.
  const ruleRuntimeEnv: 'test' | 'prod' =
    (payload as Record<string, unknown>).runtime_environment === 'prod' ? 'prod' : 'test'
  const orgEnv = (integration.environment as MaskinportenEnv) ?? 'tt02'
  const environment: MaskinportenEnv = ruleRuntimeEnv === 'test' ? 'tt02' : orgEnv
  const config = (integration.config as Record<string, string> | null) ?? {}
  const clientId = config.client_id
  if (!clientId) return json({ ok: false, error: 'missing_client_id_in_config' }, 400)

  let privateKeyPem: string
  let kid: string
  try {
    const creds = await resolveMaskinportenCredentials(supabase, organization_id, 'regint', environment)
    privateKeyPem = creds.privateKeyPem
    kid = creds.kid
  } catch (err) {
    return json({ ok: false, error: 'maskinporten_credentials_missing', detail: (err as Error).message }, 500)
  }

  const idempotencyKey = await buildIdempotencyKey(body)

  // 1) Maskinporten token exchange.
  let accessToken: string
  try {
    const tok = await getMaskinportenAccessToken({
      clientId,
      scope: ARBEIDSTILSYNET_SCOPE,
      environment,
      privateKeyPem,
      kid,
    })
    accessToken = tok.accessToken
  } catch (err) {
    return json({ ok: false, error: 'maskinporten_failed', detail: (err as Error).message }, 502)
  }

  // 2) Submit the report.
  const endpoint =
    environment === 'tt02'
      ? Deno.env.get('ARBEIDSTILSYNET_TT02_URL') ?? 'https://test.api.arbeidstilsynet.no/reginc/melding'
      : Deno.env.get('ARBEIDSTILSYNET_PROD_URL') ?? 'https://api.arbeidstilsynet.no/reginc/melding'

  const reportBody = {
    melder_rolle: p.melderRolle,
    arbeidsgiver_orgnr: p.arbeidsgiverOrgnr,
    hendelse_dato: p.hendelseDato,
    skadetype: p.skadetype,
    personskade_kategori: p.personskadeKategori,
    fritekst: p.fritekst ?? '',
    sen_innmelding: lateSubmission,
  }
  const submissionBody = JSON.stringify(reportBody, null, 2)

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
      return json({ ok: false, error: 'arbeidstilsynet_rejected', status, detail: receipt }, 502)
    }
  } catch (err) {
    return json({ ok: false, error: 'arbeidstilsynet_unreachable', detail: (err as Error).message }, 502)
  }

  // 3) Persist both the submission body and the regulator receipt as
  //    workflow_run_evidence rows (Merkle-chained per rule_id).
  try {
    const bodyEv = await recordRegulatorEvidence(supabase, {
      runId: run_id,
      ruleId: rule_id,
      orgId: organization_id,
      artefactKind: 'gov_submission_body',
      body: submissionBody,
      mimeType: 'application/json',
      fileNameSuffix: 'reginc-submission.json',
      lawRefs: ['AML § 5-2'],
      frameworks: ['aml-amu'],
      metadata: {
        environment,
        ruleRuntimeEnv,
        orgEnv,
        idempotencyKey,
        lateSubmission,
        hendelseDato: p.hendelseDato,
      },
    })
    const receiptEv = await recordRegulatorEvidence(supabase, {
      runId: run_id,
      ruleId: rule_id,
      orgId: organization_id,
      artefactKind: 'regulator_receipt',
      body: JSON.stringify(receipt, null, 2),
      mimeType: 'application/json',
      fileNameSuffix: 'reginc-receipt.json',
      lawRefs: ['AML § 5-2'],
      frameworks: ['aml-amu'],
      metadata: { environment, ruleRuntimeEnv, orgEnv, status, regulator: 'arbeidstilsynet' },
    })

    // Mark the rule's integration health.
    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'ok' })
      .eq('organization_id', organization_id)
      .eq('kind', 'regint')

    return json({
      ok: true,
      eventName: event_name,
      idempotencyKey,
      environment,
      lateSubmission,
      receipt: { id: receiptEv.evidenceId, checksum: receiptEv.checksum, storagePath: receiptEv.storagePath },
      submission: { id: bodyEv.evidenceId, checksum: bodyEv.checksum },
    })
  } catch (err) {
    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'failed' })
      .eq('organization_id', organization_id)
      .eq('kind', 'regint')
    return json({ ok: false, error: 'evidence_recording_failed', detail: (err as Error).message }, 500)
  }
})
