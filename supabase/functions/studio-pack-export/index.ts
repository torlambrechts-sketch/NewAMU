/**
 * studio-pack-export — Studio Builder Phase 2a Task 2a.3.
 *
 * Bundles a published studio_pack into a portable ZIP artifact with:
 *   - manifest.json (slug, semver, locale, sha256-per-file)
 *   - manifest.json's `files[]` listing every embedded resource
 *   - One JSON file per pack content section
 *
 * Output is the same shape studio-pack-import consumes — round-trip via
 * provision_*_baseline_for_org RPCs creates an identical seeded org.
 *
 * Auth: bearer token of an org member; RLS on studio_packs ensures only
 * the calling org's packs are visible.
 *
 * GET /studio-pack-export?slug=aml-amu&semver=1.0.0
 *   → 200 application/zip (binary)
 *   → 404 if no such pack in the caller's org
 *
 * Shares the SHA-256 manifest format with compliance-audit-pdf evidence
 * packs (see specs/studio-builder.md §4 Edge functions).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { zipSync, strToU8 } from 'https://esm.sh/fflate@0.8.2'

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

type ManifestFile = {
  path: string
  sha256: string
  size: number
}

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

  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')
  const semver = url.searchParams.get('semver')
  if (!slug || !semver) {
    return new Response(JSON.stringify({ error: 'slug and semver required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

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

  // Load the pack — RLS scopes to caller's org.
  const { data: pack, error } = await supabase
    .from('studio_packs')
    .select('id, slug, semver, manifest, legal_references, published_at, name_i18n, summary_i18n, accent, kpi_labels, severity_labels')
    .eq('slug', slug)
    .eq('semver', semver)
    .eq('status', 'published')
    .single()

  if (error || !pack) {
    return new Response(JSON.stringify({ error: 'Pack not found', detail: error?.message }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Build the ZIP body. Each top-level section is its own file so
  // diffing two pack versions stays human-readable.
  const sections: Record<string, unknown> = {
    'pack.json': {
      slug: pack.slug,
      semver: pack.semver,
      name_i18n: pack.name_i18n,
      summary_i18n: pack.summary_i18n,
      accent: pack.accent,
      kpi_labels: pack.kpi_labels,
      severity_labels: pack.severity_labels,
      published_at: pack.published_at,
    },
    'manifest_body.json': pack.manifest,
  }

  const files: ManifestFile[] = []
  const zipPayload: Record<string, Uint8Array> = {}
  for (const [path, body] of Object.entries(sections)) {
    const content = JSON.stringify(body, null, 2)
    zipPayload[path] = strToU8(content)
    files.push({
      path,
      sha256: await sha256Hex(content),
      size: content.length,
    })
  }

  const manifest: Manifest = {
    slug: pack.slug,
    semver: pack.semver,
    generated_at: new Date().toISOString(),
    format_version: '1.0',
    files,
    legal_references: Array.isArray(pack.legal_references)
      ? (pack.legal_references as string[])
      : [],
  }
  zipPayload['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

  const zipBytes = zipSync(zipPayload)
  return new Response(zipBytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${slug}-${semver}.zip"`,
    },
  })
})
