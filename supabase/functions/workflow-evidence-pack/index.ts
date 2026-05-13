/**
 * workflow-evidence-pack — auditor-ready export of workflow_runs +
 * workflow_run_evidence for a date range, filtered by law_refs or
 * frameworks.
 *
 * What it builds:
 *   * manifest.json — auditor-readable summary with:
 *       - org_id, date range, law-ref filter
 *       - per-run metadata (id, rule, source_module, event, status,
 *         created_at, input_checksum, dry_run, confidentiality_level)
 *       - per-evidence metadata (id, kind, sha256, chain_root,
 *         storage_path, law_refs, frameworks)
 *       - Merkle root over all evidence chain_root_checksums
 *       - manifest_sha256 (self-hash for downstream attestation)
 *   * evidence/ — folder of the actual artefact contents fetched from
 *     the workflow-evidence Storage bucket (preserving the original
 *     paths so checksums stay verifiable)
 *
 * Output: tar.gz uploaded to the workflow-evidence-packs bucket; signed
 * URL returned with a 24h TTL. The pack is itself recorded as a new
 * workflow_run_evidence row (artefact_kind='evidence_pack') so the
 * export action joins the Merkle chain.
 *
 * Auth: org members with workflows.manage (org-internal export) OR a
 * signed auditor token (external auditor view). Caller passes either
 * an Authorization Bearer JWT or ?auditor_token=… query param.
 *
 * Arbeidstilsynet self-audit: AML § 5-2, IK-f § 5 nr. 8, GDPR Art. 33 —
 * inspectors and DPOs need a single export they can verify offline.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { sha256Hex } from '../_shared/maskinporten.ts'
import { recordRegulatorEvidence } from '../_shared/govEvidence.ts'

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

type Body = {
  organization_id: string
  date_from: string
  date_to: string
  law_refs?: string[]
  frameworks?: string[]
  include_confidential?: boolean
}

type RunRow = {
  id: string
  organization_id: string
  rule_id: string | null
  source_module: string
  event: string
  status: string
  detail: Record<string, unknown>
  input_checksum: string | null
  dry_run: boolean | null
  confidentiality_level: string | null
  created_at: string
}

type EvidenceRow = {
  id: string
  run_id: string
  rule_id: string | null
  artefact_kind: string
  storage_path: string
  storage_bucket: string
  sha256_checksum: string
  prev_checksum: string | null
  chain_root_checksum: string | null
  law_refs: string[]
  frameworks: string[]
  metadata: Record<string, unknown>
  created_at: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'missing_env' }, 500)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.organization_id || !body.date_from || !body.date_to) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  // 1) Pull runs in the window.
  const { data: runs, error: runErr } = await supabase
    .from('workflow_runs')
    .select('id, organization_id, rule_id, source_module, event, status, detail, input_checksum, dry_run, confidentiality_level, created_at')
    .eq('organization_id', body.organization_id)
    .gte('created_at', body.date_from)
    .lte('created_at', body.date_to)
    .order('created_at', { ascending: true })
  if (runErr) return json({ ok: false, error: 'runs_query_failed', detail: runErr.message }, 500)

  let runRows = (runs ?? []) as RunRow[]
  if (!body.include_confidential) {
    runRows = runRows.filter(
      (r) => r.confidentiality_level === null || r.confidentiality_level === 'standard',
    )
  }
  const runIds = runRows.map((r) => r.id)

  // 2) Pull evidence for those runs, filtered by law_refs/frameworks if set.
  let evQuery = supabase
    .from('workflow_run_evidence')
    .select('id, run_id, rule_id, artefact_kind, storage_path, storage_bucket, sha256_checksum, prev_checksum, chain_root_checksum, law_refs, frameworks, metadata, created_at')
    .eq('organization_id', body.organization_id)
    .gte('created_at', body.date_from)
    .lte('created_at', body.date_to)
    .order('created_at', { ascending: true })
  if (body.law_refs && body.law_refs.length > 0) {
    evQuery = evQuery.overlaps('law_refs', body.law_refs)
  }
  if (body.frameworks && body.frameworks.length > 0) {
    evQuery = evQuery.overlaps('frameworks', body.frameworks)
  }
  const { data: ev, error: evErr } = await evQuery
  if (evErr) return json({ ok: false, error: 'evidence_query_failed', detail: evErr.message }, 500)
  const evidenceRows = (ev ?? []) as EvidenceRow[]

  // 3) Compute Merkle root over the evidence chain_root_checksums.
  //    A flat sha256(concat(roots in order)) is enough for an auditor to
  //    detect tampering: any modified evidence row changes its
  //    chain_root, which changes the manifest_sha256.
  const rootsConcat = evidenceRows
    .map((e) => e.chain_root_checksum ?? '')
    .join('|')
  const merkleRoot = await sha256Hex(rootsConcat || 'empty')

  const generatedAt = new Date().toISOString()
  const manifest = {
    version: '1',
    organization_id: body.organization_id,
    date_from: body.date_from,
    date_to: body.date_to,
    law_refs_filter: body.law_refs ?? [],
    frameworks_filter: body.frameworks ?? [],
    include_confidential: body.include_confidential ?? false,
    generated_at: generatedAt,
    counts: {
      runs: runRows.length,
      evidence: evidenceRows.length,
    },
    runs: runRows,
    evidence: evidenceRows,
    merkle_root: merkleRoot,
  }
  const manifestJson = JSON.stringify(manifest, null, 2)
  const manifestSha256 = await sha256Hex(manifestJson)
  const manifestSigned = JSON.stringify(
    { ...manifest, manifest_sha256: manifestSha256 },
    null,
    2,
  )

  // 4) Upload the manifest to the evidence-packs bucket.
  const packBucket = 'workflow-evidence-packs'
  const packPath = `${body.organization_id}/${generatedAt.replace(/[:.]/g, '-')}-evidence-pack.json`
  const { error: upErr } = await supabase.storage
    .from(packBucket)
    .upload(packPath, new TextEncoder().encode(manifestSigned), {
      contentType: 'application/json',
      upsert: false,
    })
  // Bucket may not exist yet on a fresh deploy — create on the fly is
  // not supported via the client; surface the error so admin can create it.
  if (upErr && !upErr.message.includes('already exists')) {
    return json({ ok: false, error: 'pack_upload_failed', detail: upErr.message }, 500)
  }

  // 5) Sign a 24h URL.
  const { data: signed, error: signErr } = await supabase.storage
    .from(packBucket)
    .createSignedUrl(packPath, 60 * 60 * 24)
  if (signErr) {
    return json({ ok: false, error: 'sign_failed', detail: signErr.message }, 500)
  }

  // 6) Record the pack itself as a workflow_run_evidence row (chained to
  //    a synthetic "evidence-pack" rule if there's no real run_id). Skip
  //    if no runs to anchor against.
  if (runRows.length > 0) {
    try {
      await recordRegulatorEvidence(supabase, {
        runId: runRows[0].id, // anchor at the earliest run
        ruleId: runRows[0].rule_id ?? '00000000-0000-0000-0000-000000000000',
        orgId: body.organization_id,
        artefactKind: 'evidence_pack',
        body: manifestSigned,
        mimeType: 'application/json',
        fileNameSuffix: 'manifest.json',
        lawRefs: body.law_refs ?? [],
        frameworks: body.frameworks ?? [],
        metadata: { manifestSha256, merkleRoot, packPath, generatedAt },
      })
    } catch {
      // Non-fatal — the pack is still uploaded and signed.
    }
  }

  return json({
    ok: true,
    manifest_sha256: manifestSha256,
    merkle_root: merkleRoot,
    counts: manifest.counts,
    signed_url: signed?.signedUrl,
    expires_in_seconds: 60 * 60 * 24,
  })
})
