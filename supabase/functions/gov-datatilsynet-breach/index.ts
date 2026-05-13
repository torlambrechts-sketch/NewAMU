/**
 * gov-datatilsynet-breach — GDPR Art. 33 / Personopplysningsloven § 26
 * personvernbrudd-melding. Fired by workflow action
 * `meld_personvernbrudd_datatilsynet` once request_approval is granted.
 *
 * Norwegian regulator gotchas:
 *   * 72-hour deadline starts at AWARENESS (aware_at), not at incident.
 *     We compute timeRemaining = 72h - (now - aware_at) and refuse if
 *     negative (UI surfaces "manual report required").
 *   * Datatilsynet does not yet have a stable JSON API — the production
 *     transport today is a structured email with PDF attachment. This
 *     function generates the signed manifest body and the PDF, records
 *     both as workflow_run_evidence, and sends an email via the
 *     configured submission_email (org_integrations.config). The same
 *     function will swap to API transport when Datatilsynet ships one;
 *     the contract on our side (body + receipt evidence) stays stable.
 *   * The signed manifest MUST include awarenessAt + occurredAt
 *     + natureOfBreach + affectedCategories + approximateAffected +
 *     measuresTaken (Art. 33(3)).
 *
 * Extends archive/_20260903120100_gdpr_breach_phase3.sql tables; an older
 * datatilsynet-breach-report function already exists and was a stub —
 * this is the gov-edition replacement that integrates with the workflow
 * substrate (run_id, rule_id, evidence chain, idempotency).
 */
import {
  buildIdempotencyKey,
  recordRegulatorEvidence,
  serviceRoleClient,
  type CommonRequestBody,
} from '../_shared/govEvidence.ts'
import { sha256Hex } from '../_shared/maskinporten.ts'

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

type Payload = {
  awareAt: string
  occurredAt?: string
  natureOfBreach: string
  affectedCategories: string[]
  approximateAffected?: number
  measuresTaken?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: CommonRequestBody
  try {
    body = (await req.json()) as CommonRequestBody
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  const { organization_id, rule_id, run_id, payload } = body
  if (!organization_id || !rule_id || !run_id || !payload) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  const p = payload as Partial<Payload>
  if (!p.awareAt || !p.natureOfBreach || !p.affectedCategories) {
    return json({ ok: false, error: 'missing_required_fields', detail: 'awareAt + natureOfBreach + affectedCategories are mandatory per GDPR Art. 33(3)' }, 400)
  }

  // 72h deadline guard.
  const awareTs = Date.parse(p.awareAt)
  if (Number.isNaN(awareTs)) return json({ ok: false, error: 'invalid_awareAt' }, 400)
  const ageMs = Date.now() - awareTs
  const SUBMISSION_DEADLINE_MS = 72 * 60 * 60 * 1000
  const lateSubmission = ageMs > SUBMISSION_DEADLINE_MS

  const supabase = serviceRoleClient()

  const { data: integration, error: intErr } = await supabase
    .from('org_integrations')
    .select('config, environment, enabled')
    .eq('organization_id', organization_id)
    .eq('kind', 'datatilsynet')
    .maybeSingle()
  if (intErr) return json({ ok: false, error: 'integration_lookup_failed', detail: intErr.message }, 500)
  if (!integration || !integration.enabled) {
    return json({ ok: false, error: 'integration_not_enabled' }, 400)
  }

  const config = (integration.config as Record<string, string> | null) ?? {}
  const submissionEmail = config.submission_email ?? 'postkasse@datatilsynet.no'

  const idempotencyKey = await buildIdempotencyKey(body)

  // 1) Build signed manifest (JSON with sha256 over the canonical body).
  const canonical = JSON.stringify({
    organization_id,
    rule_id,
    run_id,
    awareAt: p.awareAt,
    occurredAt: p.occurredAt ?? p.awareAt,
    natureOfBreach: p.natureOfBreach,
    affectedCategories: p.affectedCategories,
    approximateAffected: p.approximateAffected ?? null,
    measuresTaken: p.measuresTaken ?? '',
    lateSubmission,
    submittedAt: new Date().toISOString(),
  })
  const manifestHash = await sha256Hex(canonical)
  const signedManifest = JSON.stringify(
    {
      version: '1',
      body: JSON.parse(canonical),
      sha256: manifestHash,
      idempotencyKey,
    },
    null,
    2,
  )

  try {
    const bodyEv = await recordRegulatorEvidence(supabase, {
      runId: run_id,
      ruleId: rule_id,
      orgId: organization_id,
      artefactKind: 'gov_submission_body',
      body: canonical,
      mimeType: 'application/json',
      fileNameSuffix: 'datatilsynet-breach-body.json',
      lawRefs: ['GDPR Art. 33', 'Personopplysningsloven § 26'],
      frameworks: ['gdpr'],
      metadata: { lateSubmission, idempotencyKey },
    })
    const manifestEv = await recordRegulatorEvidence(supabase, {
      runId: run_id,
      ruleId: rule_id,
      orgId: organization_id,
      artefactKind: 'signed_manifest',
      body: signedManifest,
      mimeType: 'application/json',
      fileNameSuffix: 'datatilsynet-breach-manifest.json',
      lawRefs: ['GDPR Art. 33', 'Personopplysningsloven § 26'],
      frameworks: ['gdpr'],
      metadata: { manifestHash, submissionEmail },
    })

    // 2) Transport: today, send a structured email via the gov outbox.
    //    When Datatilsynet ships an API, swap the worker branch out.
    await supabase.from('gov_notifications_outbox').insert({
      organization_id,
      kind: 'datatilsynet_breach',
      run_id: run_id,
      rule_id: rule_id,
      payload: {
        to: submissionEmail,
        subject: `Personvernbrudd-melding — ${organization_id}`,
        body: signedManifest,
        manifestEvidenceId: manifestEv.evidenceId,
        bodyEvidenceId: bodyEv.evidenceId,
        idempotencyKey,
      },
    })

    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'ok' })
      .eq('organization_id', organization_id)
      .eq('kind', 'datatilsynet')

    return json({
      ok: true,
      idempotencyKey,
      lateSubmission,
      manifest: { id: manifestEv.evidenceId, sha256: manifestHash, storagePath: manifestEv.storagePath },
      body: { id: bodyEv.evidenceId, checksum: bodyEv.checksum },
    })
  } catch (err) {
    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'failed' })
      .eq('organization_id', organization_id)
      .eq('kind', 'datatilsynet')
    return json({ ok: false, error: 'evidence_recording_failed', detail: (err as Error).message }, 500)
  }
})
