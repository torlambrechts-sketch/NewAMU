/**
 * gov-nav-sykefravar — NAV sykefraværsoppfølging via Altinn DSOP.
 *
 * Fired by workflow action `nav_sykefravar_oppfolging`. Wraps the
 * gov-altinn-submit envelope with NAV-specific schema (dialogmøte 2 prep,
 * oppfølgingsplan).
 *
 * NAV's digital sykefravær flow runs over Altinn DSOP; this function is a
 * thin façade that constructs the right Altinn skjema body and delegates
 * to gov-altinn-submit internally — keeps Maskinporten credential
 * handling in one place.
 *
 * Trigger weeks:
 *   * 4   — Arbeidsgiver vurderer dialogmøte 1
 *   * 8   — NAV dialogmøte 2 prep (oppfølgingsplan obligatorisk)
 *   * 12  — Sykmeldt > 12 uker — videre tiltak
 *   * 26  — Maksgrense for sykepenger
 */
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

type Payload = {
  triggerWeek: 4 | 8 | 12 | 26
  affectedUserId?: string
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
  if (!p.triggerWeek || ![4, 8, 12, 26].includes(p.triggerWeek)) {
    return json({ ok: false, error: 'invalid_triggerWeek' }, 400)
  }

  const supabase = serviceRoleClient()

  const { data: integration, error: intErr } = await supabase
    .from('org_integrations')
    .select('config, environment, enabled')
    .eq('organization_id', organization_id)
    .eq('kind', 'nav')
    .maybeSingle()
  if (intErr) return json({ ok: false, error: 'integration_lookup_failed', detail: intErr.message }, 500)
  if (!integration || !integration.enabled) {
    return json({ ok: false, error: 'integration_not_enabled' }, 400)
  }

  const idempotencyKey = await buildIdempotencyKey(body)
  const altinnSkjema =
    p.triggerWeek === 4
      ? 'nav-sykefravar-dialogmote-1'
      : p.triggerWeek === 8
        ? 'nav-sykefravar-oppfolgingsplan-8u'
        : p.triggerWeek === 12
          ? 'nav-sykefravar-tiltak-12u'
          : 'nav-sykefravar-maksdato-26u'

  // Construct the body the way NAV's Altinn skjema expects.
  const navBody = {
    arbeidsgiver_orgnr: ((integration.config as Record<string, string>) ?? {}).default_orgnr,
    triggerWeek: p.triggerWeek,
    affectedUserId: p.affectedUserId ?? null,
    skjema: altinnSkjema,
    submittedAt: new Date().toISOString(),
  }
  const submissionBody = JSON.stringify(navBody, null, 2)

  // We don't actually call Altinn from here in v1 — we record the
  // intended submission as gov_submission_body and enqueue an
  // outbound task via compliance_notifications, which the
  // Altinn-aware worker can pick up. This keeps the function simple
  // and avoids double-wiring the Maskinporten flow during sprint-1.
  try {
    const bodyEv = await recordRegulatorEvidence(supabase, {
      runId: run_id,
      ruleId: rule_id,
      orgId: organization_id,
      artefactKind: 'gov_submission_body',
      body: submissionBody,
      mimeType: 'application/json',
      fileNameSuffix: `nav-sykefravar-w${p.triggerWeek}.json`,
      lawRefs: ['Folketrygdloven § 25-2', 'AML § 4-6'],
      frameworks: ['aml-amu'],
      metadata: { idempotencyKey, skjema: altinnSkjema },
    })

    await supabase.from('gov_notifications_outbox').insert({
      organization_id,
      kind: 'nav_sykefravar_outbox',
      run_id: run_id,
      rule_id: rule_id,
      payload: {
        skjema: altinnSkjema,
        runId: run_id,
        ruleId: rule_id,
        submissionEvidenceId: bodyEv.evidenceId,
        idempotencyKey,
      },
    })

    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'ok' })
      .eq('organization_id', organization_id)
      .eq('kind', 'nav')

    return json({
      ok: true,
      idempotencyKey,
      skjema: altinnSkjema,
      submission: { id: bodyEv.evidenceId, checksum: bodyEv.checksum, storagePath: bodyEv.storagePath },
      note: 'Queued via compliance_notifications for Altinn DSOP delivery in Phase E sprint-2.',
    })
  } catch (err) {
    await supabase
      .from('org_integrations')
      .update({ last_submission_at: new Date().toISOString(), last_submission_status: 'failed' })
      .eq('organization_id', organization_id)
      .eq('kind', 'nav')
    return json({ ok: false, error: 'evidence_recording_failed', detail: (err as Error).message }, 500)
  }
})
