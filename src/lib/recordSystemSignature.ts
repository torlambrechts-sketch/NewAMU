import type { SupabaseClient } from '@supabase/supabase-js'
import type { Level1SystemSignatureMeta } from '../types/level1Signature'
import { LEVEL1_ALGORITHM } from './level1Signature'

export type SystemSignatureRowInput = {
  resourceType: string
  resourceId: string
  action: string
  documentHashSha256: string
  signerDisplayName: string
  role?: string | null
  clientIp?: string | null
}

/** Persist level-1 signature audit row; returns evidence for embedding on the signed object. */
export async function insertSystemSignatureEvent(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  input: SystemSignatureRowInput,
): Promise<{ evidence: Level1SystemSignatureMeta } | { error: string }> {
  const recordedAt = new Date().toISOString()
  const { error } = await supabase.from('system_signature_events').insert({
    organization_id: organizationId,
    user_id: userId,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    action: input.action,
    document_hash_sha256: input.documentHashSha256,
    signer_display_name: input.signerDisplayName.trim(),
    role: input.role?.trim() || null,
    client_ip: input.clientIp || null,
  })
  if (error) {
    return { error: error.message }
  }
  const evidence: Level1SystemSignatureMeta = {
    userId,
    documentHashSha256: input.documentHashSha256,
    clientIp: input.clientIp ?? null,
    recordedAt,
    algorithm: LEVEL1_ALGORITHM,
  }
  return { evidence }
}
