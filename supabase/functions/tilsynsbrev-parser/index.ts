// tilsynsbrev-parser — edge fn that ekstraherer struktur fra opplastet
// PDF-tilsynsbrev (Arbeidstilsynet / Datatilsynet / Helsetilsynet /
// UKOM / LDO). Skriver tilbake til tilsynsbrev_uploads.parsed_payload
// + per-paragraf rader i tilsynsbrev_extracted_paragraphs.
//
// Auth: caller må være pålogget org-medlem med permission
// `tilsynsbrev.upload` og rad.organization_id må matche caller.current_org_id().
//
// Parser-mode-resolution (per opplasting):
//   1) Hent upload.parser_mode + org-default (org_tilsynsbrev_settings).
//      Caller-pref vinner over org-default, unntatt når caller-pref er
//      'auto' — da arver vi org-default.
//   2) Effektiv modus:
//        auto       + key present → LLM (default — Claude er bedre på paragraph-refs)
//        auto       + key missing → regex (logger warning)
//        llm_only   + key present → LLM
//        llm_only   + key missing → upload markeres failed, parsed_payload.error
//                                    = 'llm_required_but_no_api_key', UI viser
//                                    prominent advarsel
//        regex_only + (any)       → regex (sjekker ikke key)
//   3) Hvis LLM-svaret er malformed (mangler tool_use / input) fall ned
//      til regex og merk parser_kind = 'regex:llm_fallback'.
//   4) Hard cap: hvis org allerede er over monthly_llm_call_cap (default
//      100) for inneværende måned, faller vi til regex og merker
//      parser_kind = 'regex:rate_limited'. (regex_only respekteres alltid.)
//
// LLM-call hardening:
//   - Retry én gang på 5xx eller nettverksfeil.
//   - Bruker claude-sonnet-4-6 (siste sonnet per January 2026-cutoff).
//   - max_tokens: 2048, tool_choice forced på record_tilsynsbrev.
//   - Cost-accounting: tilsynsbrev_llm_usage_record() etter hver kall —
//     tokens fra Anthropic-respons.usage.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const PARSER_VERSION = '2026-09-07.v1-llm-default'
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_MAX_TOKENS = 2048
const STORAGE_BUCKET = 'tilsynsbrev'
const DEFAULT_MONTHLY_LLM_CAP = 100

type ParserMode = 'auto' | 'llm_only' | 'regex_only'
type ParserKind =
  | 'llm:claude'
  | 'regex:fallback'
  | 'regex:llm_fallback'
  | 'regex:rate_limited'

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

type AnthropicUsage = { input_tokens?: number; output_tokens?: number }
type ClaudeExtractResult = {
  payload: ParsedPayload
  usage: AnthropicUsage
}

const TOOL_SCHEMA = {
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
            paragraph_ref: { type: 'string', description: 'Eksempel: "AML § 4-1" eller "GDPR Art. 33"' },
            excerpt: { type: 'string', description: 'Kort sitat eller setning rundt referansen' },
            severity: { type: 'string', enum: ['info', 'observasjon', 'pålegg', 'tvangsmulkt'] },
            deadline_at: { type: 'string', description: 'Frist for tiltak (ISO 8601), tom hvis ingen' },
          },
          required: ['paragraph_ref'],
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

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms))
}

async function claudeCallOnce(
  base64: string,
  sourceType: string,
  apiKey: string,
): Promise<Response> {
  const system =
    'Du parser norske tilsynsbrev (inspeksjons- og kontrollbrev) fra Arbeidstilsynet, Datatilsynet, Statens helsetilsyn, UKOM og LDO. ' +
    'Bruk verktøyet record_tilsynsbrev og returner KUN tool_use-respons — ingen fritekst.'

  const userText =
    `Tilsynsbrev fra tilsynsmyndighet (source_type=${sourceType}). ` +
    'Identifiser hvilke paragrafer/artikler som er sitert (AML §, GDPR Art., IK-forskriften § …), ' +
    'hvilke pålegg eller observasjoner som gjøres, frister, og lag et kort sammendrag. ' +
    'Kall record_tilsynsbrev.'

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system,
      tools: [TOOL_SCHEMA],
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
}

/**
 * Wraps the raw Anthropic call with a single retry on 5xx or network
 * error. 4xx is fail-fast (auth/config issues should not be retried).
 */
async function claudeExtract(
  pdfBytes: Uint8Array,
  sourceType: string,
  apiKey: string,
): Promise<ClaudeExtractResult> {
  const base64 = bytesToBase64(pdfBytes)
  let resp: Response | null = null
  let lastErr: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      resp = await claudeCallOnce(base64, sourceType, apiKey)
      // Retry only on 5xx; 4xx is fail-fast.
      if (resp.status >= 500) {
        const txt = await resp.text().catch(() => '')
        lastErr = new Error(`anthropic_http_${resp.status}: ${txt.slice(0, 500)}`)
        if (attempt === 0) {
          await sleep(750)
          continue
        }
        throw lastErr
      }
      break
    } catch (e) {
      lastErr = e
      if (attempt === 0) {
        await sleep(750)
        continue
      }
      throw e
    }
  }
  if (!resp) throw lastErr ?? new Error('anthropic_no_response')
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`anthropic_http_${resp.status}: ${txt.slice(0, 500)}`)
  }

  const body = await resp.json()
  const usage: AnthropicUsage = (body.usage ?? {}) as AnthropicUsage
  const toolUse = Array.isArray(body.content)
    ? body.content.find((c: { type?: string }) => c.type === 'tool_use')
    : null
  if (!toolUse || !toolUse.input || typeof toolUse.input !== 'object') {
    throw new Error('anthropic_no_tool_use')
  }
  const input = toolUse.input as Record<string, unknown>

  // Map the tool schema field names to our internal payload shape.
  // We use paragraph_ref + deadline_at in the schema to make it
  // unambiguous for Claude; map back to ref + deadline here.
  const rawParagraphs = Array.isArray(input.citedParagraphs) ? input.citedParagraphs : []
  const citedParagraphs: CitedParagraph[] = rawParagraphs
    .map((p) => p as Record<string, unknown>)
    .filter((p) => typeof p.paragraph_ref === 'string' && (p.paragraph_ref as string).length > 0)
    .map((p) => ({
      ref: String(p.paragraph_ref),
      excerpt: typeof p.excerpt === 'string' ? p.excerpt : undefined,
      severity: (typeof p.severity === 'string' ? p.severity : undefined) as
        | CitedParagraph['severity']
        | undefined,
      deadline: typeof p.deadline_at === 'string' && p.deadline_at.length > 0
        ? p.deadline_at
        : null,
    }))

  const rawFindings = Array.isArray(input.findings) ? input.findings : []
  const findings: Finding[] = rawFindings
    .map((f) => f as Record<string, unknown>)
    .filter((f) => typeof f.description === 'string' && (f.description as string).length > 0)
    .map((f) => ({
      description: String(f.description),
      severity: typeof f.severity === 'string' ? f.severity : undefined,
      suggestedActions: Array.isArray(f.suggestedActions)
        ? (f.suggestedActions as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined,
    }))

  const payload: ParsedPayload = {
    summary: typeof input.summary === 'string' ? input.summary : '',
    regulator: typeof input.regulator === 'string' ? input.regulator : undefined,
    letterDate: typeof input.letterDate === 'string' && input.letterDate.length > 0
      ? input.letterDate
      : null,
    citedParagraphs,
    findings,
  }

  // A response with NO paragraphs AND NO findings AND no summary is
  // treated as malformed — caller falls back to regex.
  if (
    payload.citedParagraphs.length === 0 &&
    payload.findings.length === 0 &&
    payload.summary.length === 0
  ) {
    throw new Error('anthropic_empty_payload')
  }

  return { payload, usage }
}

// ─── Settings / usage helpers ──────────────────────────────────────────

type OrgSettings = {
  default_parser_mode: ParserMode
  monthly_llm_call_cap: number | null
}

async function loadOrgSettings(sb: SupabaseClient, orgId: string): Promise<OrgSettings> {
  const { data } = await sb
    .from('org_tilsynsbrev_settings')
    .select('default_parser_mode, monthly_llm_call_cap')
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!data) {
    return { default_parser_mode: 'auto', monthly_llm_call_cap: null }
  }
  const mode = (data.default_parser_mode as ParserMode) ?? 'auto'
  const cap = typeof data.monthly_llm_call_cap === 'number'
    ? (data.monthly_llm_call_cap as number)
    : null
  return { default_parser_mode: mode, monthly_llm_call_cap: cap }
}

async function loadMonthlyCalls(sb: SupabaseClient, orgId: string): Promise<number> {
  // First-of-month, UTC, formatted as YYYY-MM-DD (the date column type
  // stored in the table).
  const now = new Date()
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const { data } = await sb
    .from('tilsynsbrev_llm_usage')
    .select('total_calls')
    .eq('organization_id', orgId)
    .eq('month', monthStart)
    .maybeSingle()
  if (!data) return 0
  const n = (data.total_calls as number | string | null) ?? 0
  return typeof n === 'string' ? Number(n) : Number(n) || 0
}

async function recordLlmUsage(
  sb: SupabaseClient,
  orgId: string,
  usage: AnthropicUsage,
): Promise<void> {
  const { error } = await sb.rpc('tilsynsbrev_llm_usage_record', {
    p_org_id: orgId,
    p_input_tokens: Number(usage.input_tokens ?? 0),
    p_output_tokens: Number(usage.output_tokens ?? 0),
  })
  if (error) {
    // Non-fatal — surface to logs but don't fail the parse.
    console.warn('tilsynsbrev_llm_usage_record failed', error.message)
  }
}

// ─── Mode resolution ───────────────────────────────────────────────────

type ResolvedMode = {
  kind: 'llm' | 'regex'
  reason:
    | 'auto_with_key'
    | 'auto_no_key'
    | 'llm_only'
    | 'regex_only'
    | 'rate_limited'
  failHard: false
} | {
  kind: 'fail'
  reason: 'llm_required_but_no_api_key'
  failHard: true
}

function resolveMode(
  uploadMode: ParserMode,
  orgDefault: ParserMode,
  hasApiKey: boolean,
  overCap: boolean,
): ResolvedMode {
  // upload pref wins, EXCEPT when upload pref is 'auto' (the default) —
  // then we use the org default so admins can lock the module.
  const effective: ParserMode = uploadMode === 'auto' ? orgDefault : uploadMode

  if (effective === 'regex_only') {
    return { kind: 'regex', reason: 'regex_only', failHard: false }
  }
  if (effective === 'llm_only') {
    if (!hasApiKey) {
      return { kind: 'fail', reason: 'llm_required_but_no_api_key', failHard: true }
    }
    // llm_only does NOT respect the rate-limit cap — admin explicitly
    // asked for LLM. We still record the call.
    return { kind: 'llm', reason: 'llm_only', failHard: false }
  }
  // effective === 'auto'
  if (!hasApiKey) {
    console.warn('tilsynsbrev-parser: ANTHROPIC_API_KEY not set, falling back to regex')
    return { kind: 'regex', reason: 'auto_no_key', failHard: false }
  }
  if (overCap) {
    console.warn('tilsynsbrev-parser: monthly LLM cap reached, falling back to regex')
    return { kind: 'regex', reason: 'rate_limited', failHard: false }
  }
  return { kind: 'llm', reason: 'auto_with_key', failHard: false }
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

  // ── Mode resolution ──────────────────────────────────────────────────
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  const hasApiKey = typeof apiKey === 'string' && apiKey.length > 0
  const orgSettings = await loadOrgSettings(sb, callerOrgId)
  const uploadMode = ((row.parser_mode as ParserMode | undefined) ?? 'auto')
  const cap = orgSettings.monthly_llm_call_cap ?? DEFAULT_MONTHLY_LLM_CAP

  // Only compute current usage when we might actually need to throttle.
  let overCap = false
  if (uploadMode !== 'regex_only' && orgSettings.default_parser_mode !== 'regex_only') {
    const used = await loadMonthlyCalls(sb, callerOrgId)
    overCap = used >= cap
  }

  const resolved = resolveMode(uploadMode, orgSettings.default_parser_mode, hasApiKey, overCap)

  if (resolved.failHard) {
    await sb
      .from('tilsynsbrev_uploads')
      .update({
        parsed_status: 'failed',
        parsed_at: new Date().toISOString(),
        parser_kind: null,
        parser_version: PARSER_VERSION,
        parsed_payload: {
          error: 'llm_required_but_no_api_key',
          message:
            'Org-innstilling krever LLM-modus, men ANTHROPIC_API_KEY er ikke satt på edge-funksjonen.',
          resolved_mode: resolved.reason,
        },
      })
      .eq('id', row.id)
    return json({ ok: false, error: 'llm_required_but_no_api_key' }, 412)
  }

  // ── Fetch PDF bytes ─────────────────────────────────────────────────
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

  // ── Parse ────────────────────────────────────────────────────────────
  let parserKind: ParserKind
  let payload: ParsedPayload
  try {
    if (resolved.kind === 'llm') {
      try {
        const result = await claudeExtract(bytes, row.source_type, apiKey as string)
        payload = result.payload
        parserKind = 'llm:claude'
        // Cost-accounting AFTER a successful call (we don't bill for
        // calls that failed before returning content).
        await recordLlmUsage(sb, callerOrgId, result.usage)
      } catch (llmErr) {
        // Malformed tool input or LLM failure → degrade to regex but
        // mark the parser_kind so the UI can flag it red.
        console.warn('tilsynsbrev-parser: LLM failed, regex fallback', llmErr)
        const text = naiveBinaryStrings(bytes)
        payload = regexFallback(text, row.source_type)
        parserKind = 'regex:llm_fallback'
      }
    } else {
      // regex path — distinguish "rate limited" from generic fallback
      const text = naiveBinaryStrings(bytes)
      payload = regexFallback(text, row.source_type)
      parserKind = resolved.reason === 'rate_limited'
        ? 'regex:rate_limited'
        : 'regex:fallback'
    }
  } catch (e) {
    await sb
      .from('tilsynsbrev_uploads')
      .update({
        parsed_status: 'failed',
        parsed_at: new Date().toISOString(),
        parser_kind: null,
        parser_version: PARSER_VERSION,
        parsed_payload: { error: String(e), stage: 'parse' },
      })
      .eq('id', row.id)
    return json({ ok: false, error: 'parse_failed', detail: String(e) }, 500)
  }

  // ── Write parsed_payload + transition status ────────────────────────
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
    resolved_reason: resolved.kind === 'llm' || resolved.kind === 'regex' ? resolved.reason : 'fail',
    cited: payload.citedParagraphs.length,
    summary_len: payload.summary.length,
  })
})
