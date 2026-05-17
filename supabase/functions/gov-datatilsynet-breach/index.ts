/**
 * gov-datatilsynet-breach — GDPR Art. 33 / Personopplysningsloven § 26
 * personvernbrudd-melding. Fired by workflow action
 * `meld_personvernbrudd_datatilsynet` once request_approval is granted.
 *
 * Norwegian regulator gotchas:
 *   * 72-hour deadline starts at AWARENESS (aware_at), not at incident.
 *     We compute timeRemaining = 72h - (now - aware_at) and refuse if
 *     negative (UI surfaces "manual report required").
 *   * Datatilsynet does not yet have a stable JSON API. Transport is now
 *     either (a) Altinn 3 via gov-altinn-submit when the org has an
 *     active Altinn integration, or (b) a human-handled outbox row
 *     (kind='manual_datatilsynet_submission') that an admin pastes into
 *     the Datatilsynet web form. We NEVER route through SendGrid —
 *     GDPR Art. 44 / Schrems-II forbids exporting personopplysninger
 *     in a regulator notification to a US email relay.
 *   * The signed manifest MUST include awarenessAt + occurredAt
 *     + natureOfBreach + affectedCategories + approximateAffected +
 *     measuresTaken (Art. 33(3)).
 *
 * Extends archive/_20260903120100_gdpr_breach_phase3.sql tables; an older
 * datatilsynet-breach-report function already exists and was a stub —
 * this is the gov-edition replacement that integrates with the workflow
 * substrate (run_id, rule_id, evidence chain, idempotency).
 *
 * _127600: respects per-rule runtime_environment. 'test' forwards into
 * gov-altinn-submit (which forces TT02) and stamps manual outbox rows
 * with a [TEST] banner so triage doesn't accidentally file a sandbox
 * report to the real Datatilsynet web form.
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

  let body: CommonRequestBody & { dryRun?: boolean }
  try {
    body = (await req.json()) as CommonRequestBody & { dryRun?: boolean }
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  // Setup-wizard dry-run — no Altinn call, no outbox row, no evidence.
  if (body.dryRun === true) {
    return json({ ok: true, mode: 'dry-run', detail: 'datatilsynet-breach reachable' })
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

  // _127600: per-rule runtime_environment. 'test' forces sandbox routing
  // (via gov-altinn-submit which has its own _127600 override) and
  // pre-pends a [TEST] tag to the manual outbox row so triage doesn't
  // mistake it for a real submission. Default 'test' if missing.
  const ruleRuntimeEnv: 'test' | 'prod' =
    (payload as Record<string, unknown>).runtime_environment === 'prod' ? 'prod' : 'test'

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
      metadata: { lateSubmission, idempotencyKey, ruleRuntimeEnv },
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
      metadata: { manifestHash, ruleRuntimeEnv },
    })

    // 2) Transport selection — Altinn 3 if configured, otherwise human-
    //    handled outbox. SendGrid is intentionally NOT a fallback: a US
    //    relay would breach GDPR Art. 44 / Schrems-II for regulator
    //    notifications containing personopplysninger.
    const { data: altinnInt } = await supabase
      .from('org_integrations')
      .select('id, enabled, status')
      .eq('organization_id', organization_id)
      .eq('kind', 'altinn')
      .maybeSingle()

    const altinnActive = Boolean(
      altinnInt && altinnInt.enabled && (altinnInt as { status?: string }).status !== 'disabled',
    )

    let transport: 'altinn' | 'manual_outbox'
    let altinnResult: Record<string, unknown> | null = null

    if (altinnActive) {
      // Wrap the Datatilsynet content in an Altinn 3 envelope and call
      // gov-altinn-submit internally. The receipt + body evidence rows
      // produced by that function chain into the same workflow_run.
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
      const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const altinnRes = await fetch(`${SUPABASE_URL}/functions/v1/gov-altinn-submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id,
          rule_id,
          run_id,
          event_name: 'datatilsynet_breach_via_altinn',
          payload: {
            tjeneste: 'datatilsynet',
            skjema: 'personvernbrudd_melding',
            bodyJson: signedManifest,
            // _127600: forward the rule's runtime_environment so the Altinn
            // edge fn forces TT02 when the rule is pinned to 'test'.
            runtime_environment: ruleRuntimeEnv,
          },
        }),
      })
      if (!altinnRes.ok) {
        const detail = await altinnRes.text().catch(() => '')
        await supabase
          .from('org_integrations')
          .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'failed' })
          .eq('organization_id', organization_id)
          .eq('kind', 'datatilsynet')
        return json(
          {
            ok: false,
            error: 'altinn_submission_failed',
            detail: `altinn_${altinnRes.status}:${detail.slice(0, 200)}`,
          },
          502,
        )
      }
      altinnResult = (await altinnRes.json().catch(() => ({}))) as Record<string, unknown>
      transport = 'altinn'
    } else {
      // No Altinn integration — queue for a human to file the report via
      // Datatilsynet's web form. The payload bundles everything the
      // submitter needs (signed manifest, structured fields, instructions
      // in Norwegian) so the manual step is paste-and-submit.
      await supabase.from('gov_notifications_outbox').insert({
        organization_id,
        kind: 'manual_datatilsynet_submission',
        run_id,
        rule_id,
        payload: {
          signedManifest,
          manifestEvidenceId: manifestEv.evidenceId,
          bodyEvidenceId: bodyEv.evidenceId,
          structuredFields: {
            awareAt: p.awareAt,
            occurredAt: p.occurredAt ?? p.awareAt,
            natureOfBreach: p.natureOfBreach,
            affectedCategories: p.affectedCategories,
            approximateAffected: p.approximateAffected ?? null,
            measuresTaken: p.measuresTaken ?? '',
            lateSubmission,
          },
          idempotencyKey,
          ruleRuntimeEnv,
          submitterInstructions: [
            ...(ruleRuntimeEnv === 'test'
              ? ['[TEST] Regelen er pinnet til TT02 — IKKE send denne meldingen til Datatilsynet i produksjon.']
              : []),
            'Personvernbrudd-melding er klar for innsending, men din organisasjon har ikke aktivert Altinn-integrasjon.',
            'Gå til https://www.datatilsynet.no/kontakt-oss/melding-om-brudd-pa-personopplysningssikkerheten/',
            'Lim inn feltene fra "structuredFields" i web-skjemaet og last opp den signerte manifest-filen (sha256 vises under) som vedlegg.',
            `Manifest-sha256: ${manifestHash}`,
            'Når du har sendt skjemaet: registrer Datatilsynets referansenummer på denne rad-IDen i admin → Statlige meldinger.',
            'NB: Datatilsynet-meldingen sendes IKKE via e-post — GDPR Art. 44 / Schrems-II forbyr transitt av personopplysninger via amerikanske relé.',
          ].join(' \n'),
        },
      })
      transport = 'manual_outbox'
    }

    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'ok' })
      .eq('organization_id', organization_id)
      .eq('kind', 'datatilsynet')

    return json({
      ok: true,
      idempotencyKey,
      lateSubmission,
      detail: { transport },
      manifest: { id: manifestEv.evidenceId, sha256: manifestHash, storagePath: manifestEv.storagePath },
      body: { id: bodyEv.evidenceId, checksum: bodyEv.checksum },
      altinn: altinnResult,
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
