// Shared evidence-recording helper for gov edge functions.
//
// Every successful government submission writes:
//   1. A regulator_receipt evidence row (the kvittering PDF / JSON)
//   2. A gov_submission_body evidence row (what we sent, for replay/audit)
// Both go through public.workflow_record_evidence() which Merkle-chains
// per rule_id and is RLS+trigger-locked against mutation.
//
// Storage path convention:
//   workflow-evidence bucket, per-org folder:
//     <org_id>/<rule_id>/<run_id>/<timestamp>-<kind>.<ext>
// (matches what the LibraryPanel / auditor view will surface.)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { sha256Hex } from './maskinporten.ts'

export type EvidenceMetadata = Record<string, unknown>

export async function recordRegulatorEvidence(
  supabase: SupabaseClient,
  args: {
    runId: string
    ruleId: string
    orgId: string
    artefactKind: 'regulator_receipt' | 'gov_submission_body' | 'signed_manifest'
    body: string | Uint8Array
    mimeType: string
    fileNameSuffix: string
    lawRefs: string[]
    frameworks?: string[]
    metadata?: EvidenceMetadata
  },
): Promise<{ evidenceId: string; storagePath: string; checksum: string }> {
  const bucket = 'workflow-evidence'
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const storagePath = `${args.orgId}/${args.ruleId}/${args.runId}/${ts}-${args.fileNameSuffix}`

  const bytes = typeof args.body === 'string' ? new TextEncoder().encode(args.body) : args.body
  const sumInput = typeof args.body === 'string' ? args.body : new TextDecoder().decode(args.body)
  const checksum = await sha256Hex(sumInput)

  // Upload to Storage. Caller already authenticated as service role.
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(storagePath, bytes, { contentType: args.mimeType, upsert: false })
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`)

  // Record the evidence row (Merkle chain extended atomically).
  const { data, error: recErr } = await supabase.rpc('workflow_record_evidence', {
    p_run_id: args.runId,
    p_rule_id: args.ruleId,
    p_organization_id: args.orgId,
    p_artefact_kind: args.artefactKind,
    p_storage_path: storagePath,
    p_storage_bucket: bucket,
    p_bytes_size: bytes.byteLength,
    p_mime_type: args.mimeType,
    p_sha256_checksum: checksum,
    p_law_refs: args.lawRefs,
    p_frameworks: args.frameworks ?? [],
    p_metadata: args.metadata ?? {},
  })
  if (recErr) throw new Error(`workflow_record_evidence failed: ${recErr.message}`)

  return { evidenceId: data as string, storagePath, checksum }
}

export function serviceRoleClient(): SupabaseClient {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
}

export type CommonRequestBody = {
  organization_id: string
  rule_id: string
  run_id: string
  event_name: string
  payload: Record<string, unknown>
}

export async function buildIdempotencyKey(req: CommonRequestBody): Promise<string> {
  return sha256Hex(`${req.organization_id}|${req.rule_id}|${req.run_id}|${req.event_name}`)
}
