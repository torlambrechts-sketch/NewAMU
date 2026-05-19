#!/usr/bin/env node
// Endringslogg recon — runnable locally or in CI / cron.
//
// Reads the audit_events_recon view and flags any (org, table, day)
// where the CDC floor (hse_audit_log) has more rows than the
// semantic layer (audit_events). A sustained gap > THRESHOLD per
// table per day means a mutation path probably forgot to call
// emit_audit_event. R1 + R5 mitigation from specs/endringslogg-spec.md §11.
//
// Run: `node scripts/audit-recon.mjs` (needs SUPABASE_URL +
// SUPABASE_SERVICE_ROLE in env, OR pipe in JSON rows via stdin for
// CI fixtures). Exit code 0 = green; 1 = gap exceeds threshold; 2 = configuration error.

import { createClient } from '@supabase/supabase-js'

const THRESHOLD = Number(process.env.AUDIT_RECON_THRESHOLD ?? 5)
const WINDOW_DAYS = Number(process.env.AUDIT_RECON_WINDOW ?? 7)

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) {
    console.error('audit-recon: SUPABASE_URL + SUPABASE_SERVICE_ROLE required')
    process.exit(2)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString()

  const { data, error } = await supabase
    .from('audit_events_recon')
    .select('organization_id, table_name, day, cdc_rows, semantic_rows, gap')
    .gte('day', since)
    .order('day', { ascending: false })

  if (error) {
    console.error('audit-recon: query failed:', error.message)
    process.exit(2)
  }

  const rows = data ?? []
  const violations = rows.filter((r) => r.gap > THRESHOLD)

  if (violations.length === 0) {
    console.log(
      `audit-recon ✓ — ${rows.length} (org × table × day) cells checked over ${WINDOW_DAYS}d, all within threshold ${THRESHOLD}.`,
    )
    process.exit(0)
  }

  console.error(
    `audit-recon ✗ — ${violations.length} cells exceed threshold ${THRESHOLD} over ${WINDOW_DAYS}d:`,
  )
  for (const v of violations.slice(0, 50)) {
    console.error(
      `  ${v.day}  org=${v.organization_id}  table=${v.table_name}  ` +
        `cdc=${v.cdc_rows}  semantic=${v.semantic_rows}  gap=${v.gap}`,
    )
  }
  if (violations.length > 50) {
    console.error(`  … and ${violations.length - 50} more.`)
  }
  process.exit(1)
}

main().catch((err) => {
  console.error('audit-recon: unhandled error:', err)
  process.exit(2)
})
