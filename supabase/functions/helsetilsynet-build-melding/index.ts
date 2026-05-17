/**
 * helsetilsynet-build-melding — bygg en strukturert melding (PDF + JSON)
 * for Statens helsetilsyn (spes.helsetjl. § 3-3) eller UKOM (hol. § 12-3 a)
 * og legg en manuell outbox-rad i kø for triage. Ingen ekstern API-anrop
 * finner sted — disse to regulatorene har ingen API.
 *
 * Input  : { organization_id, payload: { kategori?, hendelsesdato?,
 *           beskrivelse?, vurdering_arsak?, tiltak_iverksatt?,
 *           forebyggbarhet?, kontaktperson?, target?: 'helsetilsynet'|'ukom',
 *           rule_id?, run_id?, event_name? } }
 * Auth   : Bearer-JWT på kaller. Kaller må enten ha gov.outbox_triage
 *          eller være service-role (når workflow-queue-worker dispatcher
 *          en `meld_helsetilsynet`-handling).
 * Output : { outbox_id, pdf_storage_path, signed_url }
 *
 * Side-effekter:
 *   1. Genererer en en-side A4 PDF via pdf-lib basert på org'ens lagrede
 *      melding_template + payload-feltene.
 *   2. Laster opp PDF til `workflow-evidence`-bucket på sti
 *      `<org>/<rule|adhoc>/<run|adhoc>/<ts>-helsetilsynet-melding.pdf`.
 *   3. Legger inn rad i `gov_notifications_outbox` med
 *      kind='manual_helsetilsynet_submission' (eller 'manual_ukom_submission'
 *      når target='ukom'), status='awaiting_human' i payload, og
 *      metadata.melding_pdf_path peker på storage-stien.
 *   4. Returnerer en 1h signed URL slik at triage-UI'et kan gi
 *      faganasvarlig direkte nedlasting.
 *
 * Worker-flyt: workflow-queue-worker dispatcher action_type
 * `meld_helsetilsynet` ved å POST'e hit med service-role-token (og uten
 * gov.outbox_triage-sjekk siden rollen «er» systemet). Triage-UI'et
 * (GovOutboxPage) plukker rad'en opp via gov_outbox_pending_idx — kind
 * er allerede tillatt etter migrasjon _126100.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

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

const EVIDENCE_BUCKET = 'workflow-evidence'

type Target = 'helsetilsynet' | 'ukom'

type MeldingPayload = {
  target?: Target
  kategori?: string
  hendelsesdato?: string
  beskrivelse?: string
  vurdering_arsak?: string
  tiltak_iverksatt?: string
  forebyggbarhet?: string
  kontaktperson?: {
    navn?: string
    stilling?: string
    telefon?: string
    epost?: string
  }
  rule_id?: string
  run_id?: string
  event_name?: string
}

type RequestBody = {
  organization_id: string
  rule_id?: string | null
  run_id?: string | null
  event_name?: string | null
  payload: MeldingPayload
  dryRun?: boolean
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

/**
 * Caller is service-role if the bearer token equals SERVICE_ROLE_KEY.
 * The workflow-queue-worker authenticates this way. Human callers go
 * through user-JWT + user_has_permission('gov.outbox_triage').
 */
function isServiceRole(authHeader: string): boolean {
  const token = authHeader.replace(/^Bearer\s+/i, '')
  return token.length > 0 && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

async function renderMeldingPdf(args: {
  target: Target
  orgName: string
  template: string
  payload: MeldingPayload
  faganasvarlig: { navn: string; epost: string; telefon: string }
  recipientLabel: string
  generatedAt: Date
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([595.28, 841.89])
  const dark = rgb(0.13, 0.13, 0.13)
  const muted = rgb(0.42, 0.42, 0.42)
  const brand = args.target === 'ukom' ? rgb(0.46, 0.16, 0.51) : rgb(0.1, 0.24, 0.2)

  // Header bar
  page.drawRectangle({ x: 0, y: 781, width: 595.28, height: 60, color: brand })
  page.drawText(
    args.target === 'ukom' ? 'Varsling til UKOM' : 'Melding til Statens helsetilsyn',
    { x: 50, y: 808, size: 16, font: bold, color: rgb(1, 1, 1) },
  )
  page.drawText(
    args.target === 'ukom'
      ? 'Helse- og omsorgstjenesteloven § 12-3 a'
      : 'Spesialisthelsetjenesteloven § 3-3',
    { x: 50, y: 790, size: 10, font, color: rgb(1, 1, 1) },
  )

  let y = 760
  const drawRow = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 9, font, color: muted })
    page.drawText(value || '—', { x: 200, y, size: 10, font: bold, color: dark })
    y -= 16
  }
  drawRow('Virksomhet', args.orgName)
  drawRow('Mottaker', args.recipientLabel)
  drawRow('Generert', args.generatedAt.toLocaleString('nb-NO'))
  drawRow('Faganasvarlig', args.faganasvarlig.navn)
  drawRow('— e-post', args.faganasvarlig.epost)
  drawRow('— telefon', args.faganasvarlig.telefon)
  y -= 6
  page.drawLine({
    start: { x: 50, y: y + 4 },
    end: { x: 545, y: y + 4 },
    color: rgb(0.85, 0.85, 0.85),
    thickness: 0.5,
  })
  y -= 14

  const drawSection = (title: string, body: string) => {
    if (y < 100) return // out of page real estate; structured-payload still in outbox row
    page.drawText(title, { x: 50, y, size: 10, font: bold, color: brand })
    y -= 14
    const lines = (body || '—').split(/\n/).flatMap((l) => wrap(l, 110))
    for (const l of lines) {
      if (y < 80) break
      page.drawText(l.slice(0, 110), { x: 50, y, size: 9, font, color: dark })
      y -= 11
    }
    y -= 6
  }

  drawSection('1. Pasientskade-kategori', args.payload.kategori ?? '—')
  drawSection('2. Hendelsesdato', args.payload.hendelsesdato ?? '—')
  drawSection('3. Beskrivelse av hendelsen', args.payload.beskrivelse ?? '—')
  drawSection('4. Vurdering av årsak', args.payload.vurdering_arsak ?? '—')
  drawSection('5. Tiltak iverksatt', args.payload.tiltak_iverksatt ?? '—')
  drawSection('6. Vurdering av forebyggbarhet', args.payload.forebyggbarhet ?? '—')

  // Footer with template excerpt — proof we used the org's saved template.
  page.drawLine({
    start: { x: 50, y: 60 },
    end: { x: 545, y: 60 },
    color: rgb(0.85, 0.85, 0.85),
    thickness: 0.5,
  })
  page.drawText(
    `Konfidensiell behandling iht. helsepersonelloven § 21. Mal-versjon: ${
      args.template.split('\n')[0]?.slice(0, 80) ?? 'standard'
    }`,
    { x: 50, y: 45, size: 7, font, color: muted },
  )

  return await pdf.save()
}

function wrap(line: string, max: number): string[] {
  if (line.length <= max) return [line]
  const words = line.split(/\s+/)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (test.length > max && cur) {
      out.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) out.push(cur)
  return out
}

function recipientLabelFor(target: Target, configRecipient: string): string {
  if (target === 'ukom') return 'UKOM (Statens undersøkelseskommisjon)'
  switch (configRecipient) {
    case 'helsetilsynet_fylkesmann':
      return 'Statens helsetilsyn — fylkesmann (statsforvalter)'
    case 'parallell':
      return 'Statens helsetilsyn (parallell med UKOM)'
    default:
      return 'Statens helsetilsyn — sentralt'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (body.dryRun === true) {
    return json({ ok: true, mode: 'dry-run', detail: 'helsetilsynet-build-melding reachable' })
  }
  if (!body.organization_id || !body.payload) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  // Auth: service-role OR user-JWT with gov.outbox_triage.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }
  if (!isServiceRole(authHeader)) {
    const userSb = userClient(authHeader)
    const { data: userData, error: userErr } = await userSb.auth.getUser()
    if (userErr || !userData?.user) {
      return json({ ok: false, error: 'unauthenticated', detail: userErr?.message }, 401)
    }
    const { data: callerOrgId } = await userSb.rpc('current_org_id')
    if (!callerOrgId || String(callerOrgId) !== body.organization_id) {
      return json({ ok: false, error: 'cross_org_denied' }, 403)
    }
    const { data: hasPerm, error: permErr } = await userSb.rpc('user_has_permission', {
      p_key: 'gov.outbox_triage',
    })
    if (permErr || !hasPerm) {
      return json(
        { ok: false, error: 'permission_denied', detail: 'gov.outbox_triage required' },
        403,
      )
    }
  }

  const sb = serviceRoleClient()

  // Resolve org_integrations row + organization name.
  const [intRes, orgRes] = await Promise.all([
    sb
      .from('org_integrations')
      .select('config, enabled')
      .eq('organization_id', body.organization_id)
      .eq('kind', 'helsetilsynet')
      .maybeSingle(),
    sb.from('organizations').select('name').eq('id', body.organization_id).maybeSingle(),
  ])
  if (intRes.error) {
    return json({ ok: false, error: 'integration_lookup_failed', detail: intRes.error.message }, 500)
  }
  if (!intRes.data || !(intRes.data as { enabled: boolean }).enabled) {
    return json({ ok: false, error: 'integration_not_enabled' }, 400)
  }
  const intConfig = ((intRes.data as { config: Record<string, unknown> | null }).config ?? {}) as Record<string, unknown>
  const orgName =
    (orgRes.data as { name?: string } | null)?.name ?? 'Ukjent virksomhet'

  const target: Target = body.payload.target === 'ukom' ? 'ukom' : 'helsetilsynet'
  const outboxKind =
    target === 'ukom' ? 'manual_ukom_submission' : 'manual_helsetilsynet_submission'

  // _127600: per-rule runtime_environment. Helsetilsynet/UKOM have no API
  // (manual outbox-only flow), so 'test' here stamps a [TEST] banner on
  // the outbox row so triage doesn't accidentally file the sandbox PDF
  // with the real regulator. Reads from body.payload.runtime_environment
  // first (canonical, set by workflow_execute_actions) then falls back to
  // 'test' for safety.
  const ruleRuntimeEnv: 'test' | 'prod' =
    (body.payload as Record<string, unknown>).runtime_environment === 'prod' ? 'prod' : 'test'

  const template =
    (typeof intConfig.melding_template === 'string' ? intConfig.melding_template : '') ||
    'Standard melding-mal mangler — fyll inn melding manuelt.'
  const faganasvarlig = {
    navn:
      typeof intConfig.faganasvarlig_navn === 'string' ? intConfig.faganasvarlig_navn : '—',
    epost:
      typeof intConfig.faganasvarlig_epost === 'string' ? intConfig.faganasvarlig_epost : '—',
    telefon:
      typeof intConfig.faganasvarlig_telefon === 'string'
        ? intConfig.faganasvarlig_telefon
        : '—',
  }
  const configRecipient =
    typeof intConfig.recipient === 'string'
      ? (intConfig.recipient as string)
      : 'helsetilsynet_sentral'
  const recipientLabel = recipientLabelFor(target, configRecipient)

  const generatedAt = new Date()

  // 1) Generer PDF
  let pdfBytes: Uint8Array
  try {
    pdfBytes = await renderMeldingPdf({
      target,
      orgName,
      template,
      payload: body.payload,
      faganasvarlig,
      recipientLabel,
      generatedAt,
    })
  } catch (err) {
    return json(
      { ok: false, error: 'pdf_render_failed', detail: (err as Error).message },
      500,
    )
  }

  // 2) Upload til evidence-bucket
  const ts = generatedAt.toISOString().replace(/[:.]/g, '-')
  const ruleSeg = body.rule_id ?? body.payload.rule_id ?? 'adhoc'
  const runSeg = body.run_id ?? body.payload.run_id ?? 'adhoc'
  const storagePath = `${body.organization_id}/${ruleSeg}/${runSeg}/${ts}-${target}-melding.pdf`
  const { error: upErr } = await sb.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })
  if (upErr) {
    return json({ ok: false, error: 'upload_failed', detail: upErr.message }, 500)
  }

  // 3) Sign a 1h URL for triage UI.
  const { data: signed, error: signErr } = await sb.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)
  if (signErr) {
    return json({ ok: false, error: 'sign_failed', detail: signErr.message }, 500)
  }

  // 4) Insert outbox row som triage-UI plukker opp.
  const confidentiality =
    typeof intConfig.default_confidentiality === 'string'
      ? (intConfig.default_confidentiality as string)
      : 'confidential'

  const outboxPayload: Record<string, unknown> = {
    status: 'awaiting_human',
    target,
    runtime_environment: ruleRuntimeEnv,
    recipient: configRecipient,
    recipientLabel,
    structuredFields: {
      kategori: body.payload.kategori ?? null,
      hendelsesdato: body.payload.hendelsesdato ?? null,
      beskrivelse: body.payload.beskrivelse ?? null,
      vurdering_arsak: body.payload.vurdering_arsak ?? null,
      tiltak_iverksatt: body.payload.tiltak_iverksatt ?? null,
      forebyggbarhet: body.payload.forebyggbarhet ?? null,
      kontaktperson: body.payload.kontaktperson ?? null,
    },
    faganasvarlig,
    eventName: body.event_name ?? body.payload.event_name ?? null,
    confidentialityLevel: confidentiality,
    submitterInstructions: [
      ...(ruleRuntimeEnv === 'test'
        ? ['[TEST] Regelen er pinnet til TT02 — IKKE send denne meldingen til Helsetilsynet/UKOM i produksjon.']
        : []),
      target === 'ukom'
        ? 'UKOM-varsling skal sendes via https://varsling.ukom.no (parallell-leg til Helsetilsynet, IKKE alternativ).'
        : 'Helsetilsynet-melding sendes via https://melde.no eller på e-post (avhengig av sak).',
      'Last ned PDF nedenfor, fyll inn web-skjema/e-post, og loggfør referansenummer her etterpå.',
      'Konfidensiell behandling — taushetsplikt iht. helsepersonelloven § 21.',
    ].join('\n'),
  }

  const metadata: Record<string, unknown> = {
    melding_pdf_path: storagePath,
    bucket: EVIDENCE_BUCKET,
    generated_at: generatedAt.toISOString(),
    target,
    ruleRuntimeEnv,
  }

  const insertRow: Record<string, unknown> = {
    organization_id: body.organization_id,
    kind: outboxKind,
    rule_id: body.rule_id ?? null,
    run_id: body.run_id ?? null,
    payload: { ...outboxPayload, metadata },
  }

  const { data: inserted, error: insErr } = await sb
    .from('gov_notifications_outbox')
    .insert(insertRow)
    .select('id')
    .single()
  if (insErr) {
    return json({ ok: false, error: 'outbox_insert_failed', detail: insErr.message }, 500)
  }

  // 5) Mark integration health.
  await sb
    .from('org_integrations')
    .update({
      last_submission_at: new Date().toISOString(),
      last_submission_status: 'ok',
    })
    .eq('organization_id', body.organization_id)
    .eq('kind', 'helsetilsynet')

  return json({
    ok: true,
    outbox_id: (inserted as { id: string }).id,
    pdf_storage_path: storagePath,
    signed_url: signed?.signedUrl ?? null,
    target,
  })
})
