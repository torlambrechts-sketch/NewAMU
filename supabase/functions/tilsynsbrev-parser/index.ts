// tilsynsbrev-parser — MVP edge function that ekstraherer struktur fra
// opplastet PDF-tilsynsbrev (Arbeidstilsynet / Datatilsynet / Helsetilsynet
// / UKOM / LDO). Skriver tilbake til tilsynsbrev_uploads.parsed_payload
// + per-paragraf rader i tilsynsbrev_extracted_paragraphs.
//
// Auth: caller må være pålogget org-medlem med permission
// `tilsynsbrev.upload` og rad.organization_id må matche caller.current_org_id().
//
// Ekstraksjonsstrategi (lazy fallback):
//   1) Hvis ANTHROPIC_API_KEY er satt → kall Claude med structured-output
//      tool_use. Bruker claude-sonnet-4-6 (oppgitt i spec). Bytes sendes
//      som base64 i en `document`-content-block.
//   2) Ellers → regex over bytewise dekodet tekst. Mønstrene treffer
//      vanligste paragraf-formater (AML § 4-1, GDPR Art. 33, IK-f § 5)
//      og norske datoformat for «frist innen DD. MMMM ÅÅÅÅ».
//
// PDF-tekstuttrekk i Deno-runtime er åpent problem: pdfjs-dist trekker
// inn DOMMatrix og browser-globaler som ikke finnes i Deno deploy.
// pdf-parse er Node-spesifikk. For MVP gjør vi en best-effort
// "binary-strings" pass — vi henter alle ASCII/Latin-1 sub-strenger fra
// rå bytes som er minst 6 tegn lange. Dette gir ca. 30-70 % av synlig
// tekst på de fleste tilsynsbrev (skrivere produserer ikke fonts-as-
// glyphs). Når ANTHROPIC_API_KEY er satt sendes hele filen som
// base64-document og tekst-ekstraksjonen gjøres på Claude-siden hvor
// PDF-parseren er innebygd.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const PARSER_VERSION = '2026-09-07.v0'
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const STORAGE_BUCKET = 'tilsynsbrev'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type CitedParagraph = {
  ref: string
  excerpt?: string
  severity?: 'info' | 'observasjon' | 'pålegg' | 'tvangsmulkt'
  deadline?: string | null
}
type Finding = {
  description: string
  severity?: string
  suggestedActions?: string[]
}
type ParsedPayload = {
  summary: string
  regulator?: string
  letterDate?: string | null
  citedParagraphs: CitedParagraph[]
  findings: Finding[]
}

function serviceRoleClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function userClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })
}

// ─── Helpers ────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  // chunk to stay under arg-list size limits for very large PDFs
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * Brute "binary strings" extraction for fallback path. Pulls out runs of
 * printable ASCII/Latin-1 of length >= 6 and joins them with spaces.
 * Misses font-glyph-encoded text but catches header lines, dates and
 * paragraph refs which is what the regex extractor needs.
 */
function naiveBinaryStrings(bytes: Uint8Array): string {
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    // printable ASCII + space + tab + newline + extended Latin-1 (æøå etc).
    if (
      (b >= 0x20 && b <= 0x7e) ||
      b === 0x09 ||
      b === 0x0a ||
      b === 0x0d ||
      (b >= 0xa0 && b <= 0xff)
    ) {
      cur += String.fromCharCode(b)
    } else {
      if (cur.length >= 6) out.push(cur)
      cur = ''
    }
  }
  if (cur.length >= 6) out.push(cur)
  return out.join(' ')
}

// ─── Regex fallback extractor ──────────────────────────────────────────

const PARA_REGEX =
  /\b(AML|Arbeidsmiljøloven|Likestillings-?\s*og\s*diskrimineringsloven|Likestillingsloven|GDPR|Personopplysningsloven|IK-?forskriften|IK-f|Helsepersonelloven|Smittevernloven|Spesialisthelsetjenesteloven|Folketrygdloven)\s*(?:Art\.?|§)\s*([0-9]+(?:[-–][0-9]+)?(?:\s*[a-z])?)\s*(?:\(([0-9a-z]+)\))?/giu

const NORWEGIAN_MONTHS: Record<string, number> = {
  januar: 0, februar: 1, mars: 2, april: 3, mai: 4, juni: 5,
  juli: 6, august: 7, september: 8, oktober: 9, november: 10, desember: 11,
}
const DEADLINE_REGEX =
  /\bfrist(?:en)?\s*(?:for(?:\s*å)?[^.]{0,30}?\s*)?(?:innen|er|settes\s*til|fastsettes\s*til)?\s*[:\-]?\s*(\d{1,2})\.?\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s+(\d{4})/giu

function parseNorwegianDate(d: number, mName: string, y: number): string | null {
  const m = NORWEGIAN_MONTHS[mName.toLowerCase()]
  if (m === undefined) return null
  const date = new Date(Date.UTC(y, m, d, 12, 0, 0))
  return date.toISOString()
}

function regexFallback(text: string, sourceType: string): ParsedPayload {
  const paragraphs: CitedParagraph[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(PARA_REGEX)) {
    const lawName = match[1].replace(/\s+/g, ' ').trim()
    const num = match[2].trim()
    const sub = match[3]
    // Normalize "Arbeidsmiljøloven" → "AML" for stable match.
    const normLaw = /arbeidsmiljøloven/i.test(lawName) ? 'AML' : lawName
    const ref = `${normLaw} § ${num}${sub ? ` (${sub})` : ''}`
      .replace(/§ Art\./, 'Art.')
      .replace(/GDPR § /, 'GDPR Art. ')
    if (seen.has(ref)) continue
    seen.add(ref)

    // Capture a ±120-char excerpt around the match for context.
    const idx = match.index ?? 0
    const start = Math.max(0, idx - 120)
    const end = Math.min(text.length, idx + (match[0]?.length ?? 0) + 120)
    const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim()
    paragraphs.push({
      ref,
      excerpt,
      severity: /pålegg|påleg/i.test(excerpt) ? 'pålegg' : 'observasjon',
      deadline: null,
    })
  }

  // First deadline anywhere in the doc is attached to all unmatched
  // paragraph rows as a fallback — v0 limitation: we don't try to attach
  // the right deadline to the right pålegg.
  let firstDeadline: string | null = null
  for (const m of text.matchAll(DEADLINE_REGEX)) {
    const iso = parseNorwegianDate(Number(m[1]), m[2], Number(m[3]))
    if (iso) {
      firstDeadline = iso
      break
    }
  }
  if (firstDeadline) {
    for (const p of paragraphs) if (!p.deadline) p.deadline = firstDeadline
  }

  const summary = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 80)
    .join(' ')

  return {
    summary,
    regulator:
      sourceType === 'arbeidstilsynet' ? 'Arbeidstilsynet'
      : sourceType === 'datatilsynet' ? 'Datatilsynet'
      : sourceType === 'helsetilsynet' ? 'Statens helsetilsyn'
      : sourceType === 'ukom' ? 'UKOM'
      : sourceType === 'ldo' ? 'Likestillings- og diskrimineringsombudet'
      : 'Ukjent regulator',
    letterDate: null,
    citedParagraphs: paragraphs,
    findings: paragraphs.length === 0
      ? [{ description: 'Ingen pålegg eller observasjoner identifisert i tekstuttrekket. Manuell gjennomgang anbefales.', severity: 'info' }]
      : paragraphs.map((p) => ({
          description: p.excerpt ?? p.ref,
          severity: p.severity,
          suggestedActions: ['Vurder om kravet er adressert i eksisterende rutiner', 'Opprett oppgave med ansvarlig + frist'],
        })),
  }
}

// ─── Claude extractor ──────────────────────────────────────────────────

async function claudeExtract(
  pdfBytes: Uint8Array,
  sourceType: string,
  apiKey: string,
): Promise<ParsedPayload> {
  const base64 = bytesToBase64(pdfBytes)

  // We use tool_use with a strict input_schema so Claude returns a typed
  // payload rather than free-form JSON-in-text.
  const toolSchema = {
    name: 'record_tilsynsbrev',
    description:
      'Record the structured contents of a Norwegian regulatory inspection letter (tilsynsbrev).',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Kort sammendrag på norsk (max 80 ord)' },
        regulator: { type: 'string', description: 'Tilsynsmyndighet (Arbeidstilsynet, Datatilsynet, Helsetilsynet, UKOM, LDO)' },
        letterDate: { type: 'string', description: 'Dato brevet er datert (ISO 8601), tom hvis ukjent' },
        citedParagraphs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ref: { type: 'string', description: 'Eksempel: "AML § 4-1" eller "GDPR Art. 33"' },
              excerpt: { type: 'string', description: 'Kort sitat eller setning rundt referansen' },
              severity: { type: 'string', enum: ['info', 'observasjon', 'pålegg', 'tvangsmulkt'] },
              deadline: { type: 'string', description: 'Frist for tiltak (ISO 8601), tom hvis ingen' },
            },
            required: ['ref'],
          },
        },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              severity: { type: 'string' },
              suggestedActions: { type: 'array', items: { type: 'string' } },
            },
            required: ['description'],
          },
        },
      },
      required: ['summary', 'citedParagraphs', 'findings'],
    },
  }

  const system =
    'Du parser norske tilsynsbrev (inspeksjons- og kontrollbrev) fra Arbeidstilsynet, Datatilsynet, Statens helsetilsyn, UKOM og LDO. ' +
    'Bruk verktøyet record_tilsynsbrev og returner KUN tool_use-respons — ingen fritekst.'

  const userText =
    `Tilsynsbrev fra tilsynsmyndighet (source_type=${sourceType}). ` +
    'Identifiser hvilke paragrafer/artikler som er sitert (AML §, GDPR Art., IK-forskriften § …), ' +
    'hvilke pålegg eller observasjoner som gjøres, frister, og lag et kort sammendrag.'

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system,
      tools: [toolSchema],
      tool_choice: { type: 'tool', name: 'record_tilsynsbrev' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`anthropic_http_${resp.status}: ${txt.slice(0, 500)}`)
  }
  const body = await resp.json()
  const toolUse = Array.isArray(body.content)
    ? body.content.find((c: { type?: string }) => c.type === 'tool_use')
    : null
  if (!toolUse || !toolUse.input) {
    throw new Error('anthropic_no_tool_use')
  }
  const out = toolUse.input as ParsedPayload
  // Defensive: ensure arrays exist so downstream inserts don't crash.
  out.citedParagraphs = Array.isArray(out.citedParagraphs) ? out.citedParagraphs : []
  out.findings = Array.isArray(out.findings) ? out.findings : []
  if (typeof out.summary !== 'string') out.summary = ''
  return out
}

// ─── Main handler ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ ok: false, error: 'unauthenticated' }, 401)
  }

  let body: { upload_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.upload_id) return json({ ok: false, error: 'missing_upload_id' }, 400)

  // Verify caller is org-member + has tilsynsbrev.upload perm.
  const userSb = userClient(authHeader)
  const { data: userData, error: userErr } = await userSb.auth.getUser()
  if (userErr || !userData?.user) return json({ ok: false, error: 'unauthenticated' }, 401)

  // current_org_id() returns the caller's org via RLS-aware RPC.
  const { data: orgIdRaw, error: orgErr } = await userSb.rpc('current_org_id')
  if (orgErr || !orgIdRaw) {
    return json({ ok: false, error: 'no_current_org', detail: orgErr?.message }, 403)
  }
  const callerOrgId = String(orgIdRaw)

  const { data: hasPerm, error: permErr } = await userSb.rpc('user_has_permission', {
    p_key: 'tilsynsbrev.upload',
  })
  if (permErr || !hasPerm) {
    return json({ ok: false, error: 'permission_denied', detail: 'tilsynsbrev.upload required' }, 403)
  }

  // From here on use service_role to bypass RLS for storage read + writes
  // — we've already verified caller identity + permission + org.
  const sb = serviceRoleClient()
  const { data: row, error: rowErr } = await sb
    .from('tilsynsbrev_uploads')
    .select('*')
    .eq('id', body.upload_id)
    .maybeSingle()
  if (rowErr) return json({ ok: false, error: 'lookup_failed', detail: rowErr.message }, 500)
  if (!row) return json({ ok: false, error: 'upload_not_found' }, 404)
  if (row.organization_id !== callerOrgId) {
    return json({ ok: false, error: 'cross_org_denied' }, 403)
  }

  // Mark as parsing (best-effort; downstream still records 'parsed' or 'failed').
  await sb
    .from('tilsynsbrev_uploads')
    .update({ parsed_status: 'parsing' })
    .eq('id', row.id)

  // Fetch PDF bytes from storage.
  const { data: blob, error: dlErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .download(row.storage_path)
  if (dlErr || !blob) {
    await sb
      .from('tilsynsbrev_uploads')
      .update({
        parsed_status: 'failed',
        parsed_at: new Date().toISOString(),
        parser_kind: null,
      })
      .eq('id', row.id)
    return json({ ok: false, error: 'storage_download_failed', detail: dlErr?.message }, 500)
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())

  // Parse: Claude if API key present, otherwise regex fallback.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  let parserKind: 'llm:claude' | 'regex:fallback' = 'regex:fallback'
  let payload: ParsedPayload
  try {
    if (apiKey) {
      parserKind = 'llm:claude'
      payload = await claudeExtract(bytes, row.source_type, apiKey)
    } else {
      const text = naiveBinaryStrings(bytes)
      payload = regexFallback(text, row.source_type)
    }
  } catch (e) {
    // LLM failed — degrade to regex rather than mark the whole row failed.
    try {
      const text = naiveBinaryStrings(bytes)
      payload = regexFallback(text, row.source_type)
      parserKind = 'regex:fallback'
    } catch (e2) {
      await sb
        .from('tilsynsbrev_uploads')
        .update({
          parsed_status: 'failed',
          parsed_at: new Date().toISOString(),
          parser_kind: parserKind,
          parser_version: PARSER_VERSION,
          parsed_payload: { error: String(e), fallback_error: String(e2) },
        })
        .eq('id', row.id)
      return json({ ok: false, error: 'parse_failed', detail: String(e) }, 500)
    }
  }

  // Write the parsed_payload + transition status.
  const { error: updErr } = await sb
    .from('tilsynsbrev_uploads')
    .update({
      parsed_status: 'parsed',
      parsed_at: new Date().toISOString(),
      parser_kind: parserKind,
      parser_version: PARSER_VERSION,
      parsed_payload: payload as unknown as Record<string, unknown>,
    })
    .eq('id', row.id)
  if (updErr) return json({ ok: false, error: 'update_failed', detail: updErr.message }, 500)

  // Replace per-paragraph rows: clear existing (re-runs are idempotent
  // since cascade-from-upload is by upload_id) then insert fresh set.
  // We do NOT cascade-delete rows that have linked_task_id set — those
  // are "in flight" follow-ups and should survive a re-parse.
  await sb
    .from('tilsynsbrev_extracted_paragraphs')
    .delete()
    .eq('upload_id', row.id)
    .is('linked_task_id', null)

  if (payload.citedParagraphs.length > 0) {
    const rows = payload.citedParagraphs.map((p) => ({
      upload_id: row.id,
      organization_id: row.organization_id,
      paragraph_ref: p.ref,
      excerpt: p.excerpt ?? null,
      severity: p.severity ?? null,
      deadline_at: p.deadline ?? null,
      status: 'open' as const,
    }))
    const { error: insErr } = await sb.from('tilsynsbrev_extracted_paragraphs').insert(rows)
    if (insErr) {
      // Non-fatal: payload is recorded; per-row table is rebuilt on next run.
      console.warn('paragraph_insert_partial_failure', insErr.message)
    }
  }

  return json({
    ok: true,
    upload_id: row.id,
    parser_kind: parserKind,
    parser_version: PARSER_VERSION,
    cited: payload.citedParagraphs.length,
    summary_len: payload.summary.length,
  })
})
