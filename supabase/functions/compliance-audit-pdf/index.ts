/**
 * Compliance audit PDF — tilsyns-eksport som lett-lesbar PDF.
 *
 * Henter compliance-data via compliance_company_audit_export RPC,
 * grupperer per rolle, og produserer en flersides PDF egnet for
 * Arbeidstilsynet og Datatilsynet.
 *
 * Struktur:
 *   - Side 1: Forside (org, dato, signatur-felter, sammendrag)
 *   - Side 2+: Krav-tabeller gruppert per rolle, paginert ved ~25 rader/side
 *   - Siste side: GDPR brudd-historikk + individrettigheter-historikk
 *
 * Bruker pdf-lib (lett deploy, ingen Puppeteer/Chrome).
 * Pagination begrenser PDF til < 30s edge function-timeout selv ved 1000+
 * krav-rader.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AuditRow = {
  role_slug: string
  role_label: string
  user_name: string | null
  user_email: string | null
  requirement_kind: string
  resource_label: string
  hjemmel: string | null
  status: string
  severity: string | null
  due_at: string | null
  completed_at: string | null
}

type BreachRow = {
  detected_at: string
  deadline_at: string
  reported_to_datatilsynet_at: string | null
  title: string
  severity: string
  status: string
  affected_subjects_estimate: number | null
}

const KIND_LABEL: Record<string, string> = {
  course: 'Kurs',
  document_ack: 'Dokument-kvittering',
  document_sign: 'Dokument-signatur',
  meeting_invite: 'Møte',
  survey_response: 'Undersøkelse',
  checklist_item: 'Sjekkliste',
  task_owner: 'Oppgave',
  ros_signature: 'ROS-signatur',
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Oppfylt',
  pending: 'Venter',
  in_progress: 'Pågår',
  overdue: 'FORFALT',
  waived: 'Frafalt',
  superseded: 'Overtatt',
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Kritisk',
  high: 'Høy',
  medium: 'Middels',
  low: 'Lav',
}

const COLOR = {
  brand: rgb(0.1, 0.24, 0.2),       // #1a3d32
  dark: rgb(0.18, 0.18, 0.18),
  muted: rgb(0.4, 0.4, 0.4),
  light: rgb(0.85, 0.85, 0.85),
  red: rgb(0.7, 0.1, 0.1),
  amber: rgb(0.7, 0.5, 0.05),
  green: rgb(0.1, 0.45, 0.2),
  white: rgb(1, 1, 1),
}

const PAGE_MARGIN = 50
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

function statusColor(status: string) {
  if (status === 'completed') return COLOR.green
  if (status === 'overdue') return COLOR.red
  if (status === 'pending' || status === 'in_progress') return COLOR.amber
  return COLOR.muted
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nb-NO')
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = (text ?? '').split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    const width = font.widthOfTextAtSize(test, size)
    if (width > maxWidth && current) {
      lines.push(current)
      current = w
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  orgName: string,
  pageNum: number,
  totalPages: number,
) {
  // Brand-bar
  page.drawRectangle({
    x: 0, y: A4_HEIGHT - 50, width: A4_WIDTH, height: 50,
    color: COLOR.brand,
  })
  page.drawText('NewAMU — Tilsyns-eksport', {
    x: PAGE_MARGIN, y: A4_HEIGHT - 30,
    size: 14, font: bold, color: COLOR.white,
  })
  page.drawText(orgName, {
    x: PAGE_MARGIN, y: A4_HEIGHT - 45,
    size: 9, font, color: COLOR.white,
  })
  page.drawText(`Side ${pageNum} av ${totalPages}`, {
    x: A4_WIDTH - PAGE_MARGIN - 60, y: A4_HEIGHT - 30,
    size: 9, font, color: COLOR.white,
  })
}

function drawFooter(page: PDFPage, font: PDFFont, generatedAt: string) {
  page.drawLine({
    start: { x: PAGE_MARGIN, y: 40 },
    end: { x: A4_WIDTH - PAGE_MARGIN, y: 40 },
    color: COLOR.light, thickness: 0.5,
  })
  page.drawText(`Generert ${generatedAt} via NewAMU compliance-modul. Konfidensielt.`, {
    x: PAGE_MARGIN, y: 25,
    size: 8, font, color: COLOR.muted,
  })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  let body: { org_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.org_id) return json({ ok: false, error: 'missing_org_id' }, 400)

  // Hent data parallelt
  const [auditRes, orgRes, breachRes, subjectRes] = await Promise.all([
    supabase.rpc('compliance_company_audit_export', { p_org_id: body.org_id }),
    supabase.from('organizations').select('name').eq('id', body.org_id).maybeSingle(),
    supabase.from('gdpr_breach_incidents')
      .select('detected_at, deadline_at, reported_to_datatilsynet_at, title, severity, status, affected_subjects_estimate')
      .eq('organization_id', body.org_id).order('detected_at', { ascending: false }).limit(50),
    supabase.from('gdpr_subject_requests')
      .select('received_at, deadline_at, response_at, request_type, status')
      .eq('organization_id', body.org_id).order('received_at', { ascending: false }).limit(50),
  ])

  if (auditRes.error) return json({ ok: false, error: auditRes.error.message }, 500)

  const rows = (auditRes.data ?? []) as AuditRow[]
  const orgName = orgRes.data?.name ?? 'Ukjent virksomhet'
  const breaches = (breachRes.data ?? []) as BreachRow[]
  const subjectRequests = (subjectRes.data ?? []) as Array<{
    received_at: string; deadline_at: string; response_at: string | null
    request_type: string; status: string
  }>
  const generatedAt = new Date().toLocaleString('nb-NO')

  // Beregn aggregat
  const total = rows.length
  const completed = rows.filter((r) => r.status === 'completed').length
  const overdue = rows.filter((r) => r.status === 'overdue').length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  // Bygg PDF
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Estimer antall sider for header — vi gjør 1 pass for å telle, så bygger
  const rowsPerPage = 22
  const auditPages = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const totalPages = 1 + auditPages + (breaches.length > 0 || subjectRequests.length > 0 ? 1 : 0)

  // ── Forside ────────────────────────────────────────────────────────────
  const cover = pdf.addPage([A4_WIDTH, A4_HEIGHT])
  drawHeader(cover, font, bold, orgName, 1, totalPages)

  let y = A4_HEIGHT - 100
  cover.drawText('Compliance-rapport', {
    x: PAGE_MARGIN, y, size: 28, font: bold, color: COLOR.dark,
  })
  y -= 30
  cover.drawText(`for ${orgName}`, {
    x: PAGE_MARGIN, y, size: 16, font, color: COLOR.muted,
  })
  y -= 40

  cover.drawText(`Generert: ${generatedAt}`, {
    x: PAGE_MARGIN, y, size: 11, font, color: COLOR.dark,
  })
  y -= 35

  // Sammendrag-boks
  cover.drawRectangle({
    x: PAGE_MARGIN, y: y - 130, width: A4_WIDTH - 2 * PAGE_MARGIN, height: 130,
    color: rgb(0.97, 0.97, 0.95), borderColor: COLOR.brand, borderWidth: 1,
  })
  cover.drawText('Sammendrag', { x: PAGE_MARGIN + 15, y: y - 20, size: 14, font: bold, color: COLOR.brand })

  cover.drawText(`Totalt antall krav:        ${total}`, { x: PAGE_MARGIN + 15, y: y - 45, size: 11, font, color: COLOR.dark })
  cover.drawText(`Oppfylt:                   ${completed} (${completionRate} %)`, { x: PAGE_MARGIN + 15, y: y - 62, size: 11, font, color: COLOR.green })
  cover.drawText(`Forfalt:                   ${overdue}`, { x: PAGE_MARGIN + 15, y: y - 79, size: 11, font, color: overdue > 0 ? COLOR.red : COLOR.dark })
  cover.drawText(`Aktive GDPR-brudd:         ${breaches.filter((b) => b.status === 'detected' || b.status === 'investigating').length}`,
    { x: PAGE_MARGIN + 15, y: y - 96, size: 11, font, color: COLOR.dark })
  cover.drawText(`Aktive individ-forespørsler: ${subjectRequests.filter((s) => !['completed', 'denied'].includes(s.status)).length}`,
    { x: PAGE_MARGIN + 15, y: y - 113, size: 11, font, color: COLOR.dark })

  y -= 160

  // Signatur-felt
  cover.drawText('Bekreftet og signert av:', { x: PAGE_MARGIN, y, size: 11, font: bold, color: COLOR.dark })
  y -= 30
  cover.drawLine({ start: { x: PAGE_MARGIN, y }, end: { x: PAGE_MARGIN + 250, y }, color: COLOR.dark, thickness: 0.5 })
  cover.drawText('Daglig leder', { x: PAGE_MARGIN, y: y - 12, size: 9, font, color: COLOR.muted })
  cover.drawLine({ start: { x: PAGE_MARGIN + 280, y }, end: { x: PAGE_MARGIN + 480, y }, color: COLOR.dark, thickness: 0.5 })
  cover.drawText('Dato', { x: PAGE_MARGIN + 280, y: y - 12, size: 9, font, color: COLOR.muted })
  y -= 50
  cover.drawLine({ start: { x: PAGE_MARGIN, y }, end: { x: PAGE_MARGIN + 250, y }, color: COLOR.dark, thickness: 0.5 })
  cover.drawText('Verneombud / DPO', { x: PAGE_MARGIN, y: y - 12, size: 9, font, color: COLOR.muted })

  // Disclaimer-tekst
  y -= 50
  const disclaimer = 'Denne rapporten er generert av NewAMU compliance-modulen basert på registrert data. ' +
    'Den inneholder personopplysninger om ansatte og er konfidensiell — utleveres bare til tilsyns­myndighet ' +
    'eller på lovkrav. Eventuell videreformidling skal logges. Rapporten gjenspeiler status på generert-dato; ' +
    'live-status er tilgjengelig i NewAMU dashboard «Compliance — selskap».'
  const dLines = wrapText(disclaimer, font, 8, A4_WIDTH - 2 * PAGE_MARGIN)
  for (const line of dLines) {
    cover.drawText(line, { x: PAGE_MARGIN, y, size: 8, font, color: COLOR.muted })
    y -= 10
  }

  drawFooter(cover, font, generatedAt)

  // ── Audit-sider ─────────────────────────────────────────────────────────
  for (let pageIdx = 0; pageIdx < auditPages; pageIdx++) {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT])
    drawHeader(page, font, bold, orgName, 2 + pageIdx, totalPages)

    let cy = A4_HEIGHT - 90
    if (pageIdx === 0) {
      page.drawText('Krav-status per rolle', { x: PAGE_MARGIN, y: cy, size: 16, font: bold, color: COLOR.dark })
      cy -= 25
    }

    // Tabell-header
    const colX = {
      role: PAGE_MARGIN,
      user: PAGE_MARGIN + 110,
      kind: PAGE_MARGIN + 215,
      resource: PAGE_MARGIN + 285,
      status: PAGE_MARGIN + 420,
      due: PAGE_MARGIN + 470,
    }
    page.drawRectangle({
      x: PAGE_MARGIN - 4, y: cy - 4, width: A4_WIDTH - 2 * PAGE_MARGIN + 8, height: 16,
      color: rgb(0.95, 0.95, 0.93),
    })
    page.drawText('Rolle', { x: colX.role, y: cy, size: 9, font: bold, color: COLOR.dark })
    page.drawText('Person', { x: colX.user, y: cy, size: 9, font: bold, color: COLOR.dark })
    page.drawText('Type', { x: colX.kind, y: cy, size: 9, font: bold, color: COLOR.dark })
    page.drawText('Krav', { x: colX.resource, y: cy, size: 9, font: bold, color: COLOR.dark })
    page.drawText('Status', { x: colX.status, y: cy, size: 9, font: bold, color: COLOR.dark })
    page.drawText('Frist', { x: colX.due, y: cy, size: 9, font: bold, color: COLOR.dark })
    cy -= 18

    const startIdx = pageIdx * rowsPerPage
    const endIdx = Math.min(startIdx + rowsPerPage, rows.length)
    for (let i = startIdx; i < endIdx; i++) {
      const r = rows[i]
      if (i % 2 === 0) {
        page.drawRectangle({
          x: PAGE_MARGIN - 4, y: cy - 3, width: A4_WIDTH - 2 * PAGE_MARGIN + 8, height: 14,
          color: rgb(0.98, 0.98, 0.97),
        })
      }
      const roleStr = (r.role_label ?? r.role_slug).substring(0, 18)
      const userStr = (r.user_name ?? '—').substring(0, 18)
      const kindStr = KIND_LABEL[r.requirement_kind] ?? r.requirement_kind
      const resStr = r.resource_label.substring(0, 25)
      const statusStr = STATUS_LABEL[r.status] ?? r.status
      const dueStr = fmtDate(r.due_at)

      page.drawText(roleStr, { x: colX.role, y: cy, size: 8, font, color: COLOR.dark })
      page.drawText(userStr, { x: colX.user, y: cy, size: 8, font, color: COLOR.dark })
      page.drawText(kindStr, { x: colX.kind, y: cy, size: 8, font, color: COLOR.muted })
      page.drawText(resStr, { x: colX.resource, y: cy, size: 8, font, color: COLOR.dark })
      page.drawText(statusStr, { x: colX.status, y: cy, size: 8, font: bold, color: statusColor(r.status) })
      page.drawText(dueStr, { x: colX.due, y: cy, size: 8, font, color: COLOR.muted })
      cy -= 16
    }

    drawFooter(page, font, generatedAt)
  }

  // ── GDPR brudd + individrettigheter (siste side) ─────────────────────────
  if (breaches.length > 0 || subjectRequests.length > 0) {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT])
    drawHeader(page, font, bold, orgName, totalPages, totalPages)

    let cy = A4_HEIGHT - 90
    page.drawText('GDPR-relaterte hendelser', { x: PAGE_MARGIN, y: cy, size: 16, font: bold, color: COLOR.dark })
    cy -= 25

    if (breaches.length > 0) {
      page.drawText(`Brudd-register (siste ${Math.min(breaches.length, 20)})`, {
        x: PAGE_MARGIN, y: cy, size: 12, font: bold, color: COLOR.brand,
      })
      cy -= 18
      for (const b of breaches.slice(0, 20)) {
        const reported = b.reported_to_datatilsynet_at ? '✓' : '—'
        const line = `${fmtDate(b.detected_at)} · ${b.title.substring(0, 35)} · ${SEVERITY_LABEL[b.severity] ?? b.severity} · Status: ${STATUS_LABEL[b.status] ?? b.status} · DT: ${reported}`
        page.drawText(line, { x: PAGE_MARGIN + 10, y: cy, size: 8, font, color: COLOR.dark })
        cy -= 12
        if (cy < 80) break
      }
      cy -= 10
    }

    if (subjectRequests.length > 0 && cy > 100) {
      page.drawText(`Individrettigheter-forespørsler (siste ${Math.min(subjectRequests.length, 15)})`, {
        x: PAGE_MARGIN, y: cy, size: 12, font: bold, color: COLOR.brand,
      })
      cy -= 18
      for (const s of subjectRequests.slice(0, 15)) {
        const line = `${fmtDate(s.received_at)} · ${s.request_type} · Status: ${s.status} · Svar: ${fmtDate(s.response_at)}`
        page.drawText(line, { x: PAGE_MARGIN + 10, y: cy, size: 8, font, color: COLOR.dark })
        cy -= 12
        if (cy < 80) break
      }
    }

    drawFooter(page, font, generatedAt)
  }

  const pdfBytes = await pdf.save()
  const stamp = new Date().toISOString().split('T')[0]
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tilsyns-eksport-${stamp}.pdf"`,
    },
  })
})
