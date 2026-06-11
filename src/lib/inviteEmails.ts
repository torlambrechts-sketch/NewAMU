// inviteEmails — shared parsing + batch-create helpers for bulk invitations
// (H2.4). Used by the admin Brukere panel and the onboarding wizard so both
// surfaces validate, dedupe and report identically.

import type { SupabaseClient } from '@supabase/supabase-js'

// Same shape create_invitation enforces server-side ('^[^@]+@[^@]+\.[^@]+$').
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export type ParsedEmails = { valid: string[]; invalid: string[] }

/** Split pasted text (or a CSV column) into emails on whitespace, comma and
 *  semicolon; lowercases, trims and dedupes. */
export function parseEmailList(text: string): ParsedEmails {
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []
  for (const raw of text.split(/[\s,;]+/)) {
    const e = raw.trim().toLowerCase().replace(/^["']|["']$/g, '')
    if (!e) continue
    if (seen.has(e)) continue
    seen.add(e)
    if (EMAIL_RE.test(e)) valid.push(e)
    else invalid.push(e)
  }
  return { valid, invalid }
}

/** Extract emails from CSV text: uses the `email`/`e-post`/`epost` column
 *  when a header row declares one, otherwise scans every cell. */
export function parseCsvEmails(csv: string): ParsedEmails {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return { valid: [], invalid: [] }
  const header = lines[0]!.split(/[,;]/).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''))
  const emailCol = header.findIndex((h) => h === 'email' || h === 'e-post' || h === 'epost')
  if (emailCol >= 0) {
    const cells = lines
      .slice(1)
      .map((l) => l.split(/[,;]/)[emailCol] ?? '')
      .join('\n')
    return parseEmailList(cells)
  }
  return parseEmailList(csv.replace(/[,;]/g, '\n'))
}

export type InviteResult = { email: string; ok: boolean; error?: string }

/** Create one invitation per email through the create_invitation RPC.
 *  Sequential on purpose — the RPC is fast and parallel bursts only trade
 *  clearer per-row errors for marginal speed. */
export async function createInvitations(
  supabase: SupabaseClient,
  emails: string[],
  daysValid = 14,
): Promise<InviteResult[]> {
  const results: InviteResult[] = []
  for (const email of emails) {
    const { error } = await supabase.rpc('create_invitation', {
      p_email: email,
      p_role_ids: null,
      p_days_valid: daysValid,
    })
    results.push(error ? { email, ok: false, error: error.message } : { email, ok: true })
  }
  return results
}
