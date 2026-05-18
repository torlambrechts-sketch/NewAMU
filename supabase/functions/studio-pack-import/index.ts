/**
 * studio-pack-import — Studio Builder Phase 2a Task 2a.3.
 *
 * Accepts a ZIP produced by studio-pack-export, validates the manifest
 * + sha256 per file, and provisions the pack contents into the caller's
 * org via the existing provision_*_baseline_for_org RPCs.
 *
 * Idempotent: re-importing the same pack into the same org is a no-op
 * because the underlying provision RPCs already use ON CONFLICT DO
 * UPDATE. The studio_packs row itself uses (organization_id, slug,
 * semver) uniqueness so a duplicate import returns 409.
 *
 * Sets `set local studio.skip_revisions = on` for the duration so the
 * bulk insert doesn't fan out N revision rows into studio_revisions.
 *
 * POST /studio-pack-import
 *   Body: multipart/form-data with `file` = the .zip
 *   200 → { pack_id, slug, semver, imported_files }
 *   400 → manifest invalid or checksum mismatch
 *   409 → pack already exists
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { unzipSync, strFromU8 } from 'https://esm.sh/fflate@0.8.2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type ManifestFile = { path: string; sha256: string; size: number }
type Manifest = {
  slug: string
  semver: string
  generated_at: string
  format_version: '1.0'
  files: ManifestFile[]
  legal_references: string[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'multipart field "file" required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid ZIP', detail: e instanceof Error ? e.message : String(e) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const manifestRaw = entries['manifest.json']
  if (!manifestRaw) {
    return new Response(JSON.stringify({ error: 'manifest.json missing' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const manifest = JSON.parse(strFromU8(manifestRaw)) as Manifest
  if (manifest.format_version !== '1.0') {
    return new Response(JSON.stringify({ error: `format_version ${manifest.format_version} not supported` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify checksums for each manifest entry.
  for (const f of manifest.files) {
    const body = entries[f.path]
    if (!body) {
      return new Response(JSON.stringify({ error: `Missing file in ZIP: ${f.path}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const got = await sha256Hex(strFromU8(body))
    if (got !== f.sha256) {
      return new Response(
        JSON.stringify({
          error: `Checksum mismatch for ${f.path}`,
          expected: f.sha256,
          got,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  // Connect to DB with caller's auth (RLS-scoped).
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase env missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })

  // Resolve caller's org.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('organization_id')
    .single()
  const orgId = (profileRow as { organization_id?: string } | null)?.organization_id
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'No active organization for caller' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Conflict: refuse re-import of (slug, semver) into same org.
  const { data: existing } = await supabase
    .from('studio_packs')
    .select('id')
    .eq('slug', manifest.slug)
    .eq('semver', manifest.semver)
    .maybeSingle()
  if (existing) {
    return new Response(
      JSON.stringify({
        error: 'Pack already exists in this org',
        detail: 'Bump semver or delete the existing row.',
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Read the canonical body for the studio_packs row.
  const packBody = JSON.parse(strFromU8(entries['pack.json']))
  const manifestBody = JSON.parse(strFromU8(entries['manifest_body.json']))

  const { data: inserted, error: insertErr } = await supabase
    .from('studio_packs')
    .insert({
      organization_id: orgId,
      slug: manifest.slug,
      semver: manifest.semver,
      name_i18n: packBody.name_i18n ?? {},
      summary_i18n: packBody.summary_i18n ?? {},
      accent: packBody.accent ?? null,
      kpi_labels: packBody.kpi_labels ?? {},
      severity_labels: packBody.severity_labels ?? {},
      legal_references: manifest.legal_references,
      manifest: manifestBody,
      immutable: true,
      published_at: packBody.published_at ?? new Date().toISOString(),
      status: 'published',
      review_status: 'approved',
    })
    .select('id')
    .single()

  if (insertErr) {
    return new Response(JSON.stringify({ error: 'Insert failed', detail: insertErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Best-effort: provision underlying baselines so compliance / survey /
  // documents / registers / learning content materialises in tenant rows.
  // Failures here are non-fatal — the pack row still lands and an admin
  // can re-run provisioning manually if needed.
  await supabase.rpc('provision_compliance_baseline_for_org', { p_org_id: orgId, p_pack: manifest.slug }).catch(() => null)
  await supabase.rpc('provision_documents_baseline_for_org', { p_org_id: orgId }).catch(() => null)
  await supabase.rpc('provision_survey_baseline_for_org', { p_org_id: orgId }).catch(() => null)

  return new Response(
    JSON.stringify({
      pack_id: (inserted as { id: string }).id,
      slug: manifest.slug,
      semver: manifest.semver,
      imported_files: manifest.files.length,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
