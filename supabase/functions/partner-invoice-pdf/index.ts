// Partner Console v0 — faktura-PDF render + storage upload + signed URL.
//
// Input: { partner_id, invoice_id }.
// Auth: caller JWT verified; must be a partner manager/admin (same gate
//   as partner-invoice-csv).
// Output: A4 PDF uploaded to `<partner_id>/<invoice_id>.pdf` in the
//   `partner-invoices` Storage bucket, a 1h signed URL, and the invoice
//   number that was minted (or reused).
//
// Norwegian regnskapsloven § 6 + bokføringsforskriften § 5-1-1 fakturakrav
// the PDF satisfies:
//   - Fakturanummer (minted by partner_invoice_assign_number RPC)
//   - Fakturadato (generated_at)
//   - Selger orgnr + navn (partner_organizations + an optional org_number
//     stamped on the partner row — v0 reads `partner_organizations.name`
//     plus `billing_email`; orgnr surfacing for the partner firm itself is
//     a v1 TODO since the table has no org-nr column yet)
//   - Kjøper orgnr + navn (organizations.name + organizations.organization_number)
//   - Tjenestebeskrivelse (per-line description + period summary)
//   - Pris eks/inkl MVA + MVA-beløp (vat_rate from partner_organizations)
//   - Forfallsdato (generated_at + payment_terms_days)
//   - Betalingsmåte (bank_account_number from partner_organizations + Vipps note)
//
// Renderer: pdf-lib (same dep already in use by compliance-audit-pdf —
// no Puppeteer/Chrome cold-start, fits inside the 30s edge timeout even
// for 100+ line invoices).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'https://esm.sh/pdf-lib@1.17.1'

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

type Body = {
  partner_id: string
  invoice_id: string
}

type EntryRow = {
  id: string
  started_at: string
  ended_at: string | null
  description: string | null
  hourly_rate: number
  billable: boolean
  user_id: string
  organization_id: string
}

type ProfileRow = { id: string; display_name: string | null; email: string | null }

type OrgRow = {
  id: string
  name: string
  organization_number: string | null
  email: string | null
}

type PartnerOrgRow = {
  id: string
  name: string
  billing_email: string | null
  vat_rate: number | null
  bank_account_number: string | null
  payment_terms_days: number | null
}

type InvoiceRow = {
  id: string
  partner_id: string
  organization_id: string
  period_start: string
  period_end: string
  status: string
  total_minutes: number
  total_amount_nok: number
  generated_at: string
  invoice_number: string | null
  pdf_storage_path: string | null
}

const COLOR = {
  brand: rgb(0.76, 0.25, 0.05),    // partner accent #c2410c
  dark: rgb(0.13, 0.13, 0.13),
  muted: rgb(0.42, 0.42, 0.42),
  light: rgb(0.88, 0.88, 0.88),
  bg: rgb(0.97, 0.96, 0.94),
  white: rgb(1, 1, 1),
}

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const PAGE_MARGIN = 50

function minutesBetween(startedAt: string, endedAt: string | null): number {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / 60000)
}

function fmtHm(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function fmtNok(amount: number): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(d: string | Date | null): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('nb-NO')
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime())
  out.setDate(out.getDate() + days)
  return out
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

function drawFooter(page: PDFPage, font: PDFFont, generatedAt: string) {
  page.drawLine({
    start: { x: PAGE_MARGIN, y: 40 },
    end: { x: A4_WIDTH - PAGE_MARGIN, y: 40 },
    color: COLOR.light,
    thickness: 0.5,
  })
  page.drawText(`Generert ${generatedAt} via NewAMU Partner-konsoll. Konfidensielt.`, {
    x: PAGE_MARGIN,
    y: 25,
    size: 8,
    font,
    color: COLOR.muted,
  })
}

function buildKid(invoiceNumber: string): string {
  // Simple KID-stand-in: digits-only invoice number padded to 7 with a
  // mod-10 luhn-style check digit. v1 should swap in proper KID issuance
  // via the bank's CRM file format.
  const digits = invoiceNumber.replace(/\D+/g, '').slice(-7).padStart(7, '0')
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const n = Number(digits[i])
    sum += i % 2 === 0 ? n * 2 : n
  }
  const check = (10 - (sum % 10)) % 10
  return `${digits}${check}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ ok: false, error: 'missing_env' }, 500)
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.partner_id || !body.invoice_id) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  // 1) Resolve the caller via their JWT.
  const authz = req.headers.get('Authorization') ?? ''
  if (!authz.startsWith('Bearer ')) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE, {
    global: { headers: { Authorization: authz } },
    auth: { persistSession: false },
  })
  const { data: userInfo, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userInfo?.user) {
    return json({ ok: false, error: 'unauthorized', detail: userErr?.message }, 401)
  }
  const userId = userInfo.user.id

  // 2) Service-role client for everything else.
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  // 3) Verify the caller is a manager/admin of the requested partner.
  const { data: mRow, error: mErr } = await supabase
    .from('partner_memberships')
    .select('role, active')
    .eq('partner_id', body.partner_id)
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (mErr) return json({ ok: false, error: 'membership_query_failed', detail: mErr.message }, 500)
  if (!mRow || !['manager', 'admin'].includes((mRow as { role: string }).role)) {
    return json({ ok: false, error: 'forbidden' }, 403)
  }

  // 4) Pull the invoice + scope-check it.
  const { data: invRow, error: invErr } = await supabase
    .from('partner_invoices')
    .select(
      'id, partner_id, organization_id, period_start, period_end, status, total_minutes, total_amount_nok, generated_at, invoice_number, pdf_storage_path',
    )
    .eq('id', body.invoice_id)
    .maybeSingle()
  if (invErr) return json({ ok: false, error: 'invoice_query_failed', detail: invErr.message }, 500)
  if (!invRow || (invRow as InvoiceRow).partner_id !== body.partner_id) {
    return json({ ok: false, error: 'invoice_not_found' }, 404)
  }
  const invoice = invRow as InvoiceRow

  // 5) Mint a customer-facing invoice number if not already assigned.
  let invoiceNumber = invoice.invoice_number
  if (!invoiceNumber) {
    const { data: assigned, error: assignErr } = await supabase.rpc(
      'partner_invoice_assign_number',
      { p_invoice_id: invoice.id },
    )
    if (assignErr) {
      return json({ ok: false, error: 'assign_number_failed', detail: assignErr.message }, 500)
    }
    invoiceNumber = typeof assigned === 'string' ? assigned : null
  }
  if (!invoiceNumber) {
    return json({ ok: false, error: 'invoice_number_unassigned' }, 500)
  }

  // 6) Pull partner-firm + customer-org + entry rows in parallel.
  const [pRes, oRes, entRes] = await Promise.all([
    supabase
      .from('partner_organizations')
      .select('id, name, billing_email, vat_rate, bank_account_number, payment_terms_days')
      .eq('id', body.partner_id)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('id, name, organization_number, email')
      .eq('id', invoice.organization_id)
      .maybeSingle(),
    supabase
      .from('partner_time_entries')
      .select('id, started_at, ended_at, description, hourly_rate, billable, user_id, organization_id')
      .eq('partner_id', body.partner_id)
      .eq('invoice_line_id', body.invoice_id)
      .order('started_at', { ascending: true }),
  ])
  if (pRes.error) return json({ ok: false, error: 'partner_query_failed', detail: pRes.error.message }, 500)
  if (oRes.error) return json({ ok: false, error: 'org_query_failed', detail: oRes.error.message }, 500)
  if (entRes.error) return json({ ok: false, error: 'entries_query_failed', detail: entRes.error.message }, 500)

  const partner = (pRes.data ?? null) as PartnerOrgRow | null
  const customer = (oRes.data ?? null) as OrgRow | null
  const entries = (entRes.data ?? []) as EntryRow[]
  if (!partner) return json({ ok: false, error: 'partner_not_found' }, 404)
  if (!customer) return json({ ok: false, error: 'customer_org_not_found' }, 404)

  // 7) Hydrate consultant display names.
  const userIds = Array.from(new Set(entries.map((e) => e.user_id)))
  const profIdx = new Map<string, ProfileRow>()
  if (userIds.length > 0) {
    const { data: profRows } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds)
    for (const p of (profRows ?? []) as ProfileRow[]) profIdx.set(p.id, p)
  }

  // 8) Derive totals + VAT.
  const vatRate = Number(partner.vat_rate ?? 0.25)
  const termsDays = Number(partner.payment_terms_days ?? 14)
  const generatedAtDate = new Date(invoice.generated_at)
  const dueDate = addDays(generatedAtDate, termsDays)
  const subtotal = Number(invoice.total_amount_nok)
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100
  const total = Math.round((subtotal + vatAmount) * 100) / 100
  const kid = buildKid(invoiceNumber)

  // 9) Render the PDF.
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT])

  // ── Header brand-bar ────────────────────────────────────────────────
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 60,
    width: A4_WIDTH,
    height: 60,
    color: COLOR.brand,
  })
  page.drawText(partner.name, {
    x: PAGE_MARGIN,
    y: A4_HEIGHT - 32,
    size: 18,
    font: bold,
    color: COLOR.white,
  })
  page.drawText('Faktura', {
    x: PAGE_MARGIN,
    y: A4_HEIGHT - 50,
    size: 10,
    font,
    color: COLOR.white,
  })
  // Logo placeholder (v0): a filled square; v1 swaps to embedded PNG.
  page.drawRectangle({
    x: A4_WIDTH - PAGE_MARGIN - 40,
    y: A4_HEIGHT - 50,
    width: 30,
    height: 30,
    borderColor: COLOR.white,
    borderWidth: 1,
  })

  // ── Right-side meta block (invoice number, dates, KID) ──────────────
  let metaY = A4_HEIGHT - 100
  const metaX = A4_WIDTH - PAGE_MARGIN - 200
  const metaLabel = (label: string, value: string, ySize = 9) => {
    page.drawText(label, { x: metaX, y: metaY, size: 8, font, color: COLOR.muted })
    page.drawText(value, { x: metaX + 90, y: metaY, size: ySize, font: bold, color: COLOR.dark })
    metaY -= 16
  }
  metaLabel('Fakturanummer', invoiceNumber, 11)
  metaLabel('Fakturadato', fmtDate(generatedAtDate))
  metaLabel('Forfallsdato', fmtDate(dueDate))
  metaLabel('Periode', `${invoice.period_start} → ${invoice.period_end}`)
  metaLabel('Status', invoice.status)
  metaLabel('KID-nr', kid)
  if (partner.bank_account_number) metaLabel('Bankkonto', partner.bank_account_number)

  // ── Customer block (left) ───────────────────────────────────────────
  let custY = A4_HEIGHT - 100
  page.drawText('Faktureres til', {
    x: PAGE_MARGIN,
    y: custY,
    size: 8,
    font,
    color: COLOR.muted,
  })
  custY -= 16
  page.drawText(customer.name, {
    x: PAGE_MARGIN,
    y: custY,
    size: 12,
    font: bold,
    color: COLOR.dark,
  })
  custY -= 14
  if (customer.organization_number) {
    page.drawText(`Orgnr. ${customer.organization_number}`, {
      x: PAGE_MARGIN,
      y: custY,
      size: 9,
      font,
      color: COLOR.dark,
    })
    custY -= 12
  }
  const billingEmail = customer.email ?? partner.billing_email ?? ''
  if (billingEmail) {
    page.drawText(billingEmail, {
      x: PAGE_MARGIN,
      y: custY,
      size: 9,
      font,
      color: COLOR.muted,
    })
    custY -= 12
  }

  // ── Line-items table ────────────────────────────────────────────────
  let tableY = Math.min(custY, metaY) - 30
  const colX = {
    dato: PAGE_MARGIN,
    ansatt: PAGE_MARGIN + 70,
    beskrivelse: PAGE_MARGIN + 170,
    varighet: PAGE_MARGIN + 340,
    timepris: PAGE_MARGIN + 395,
    sum: PAGE_MARGIN + 470,
  }
  page.drawRectangle({
    x: PAGE_MARGIN - 4,
    y: tableY - 4,
    width: A4_WIDTH - 2 * PAGE_MARGIN + 8,
    height: 16,
    color: COLOR.bg,
  })
  page.drawText('Dato', { x: colX.dato, y: tableY, size: 9, font: bold, color: COLOR.dark })
  page.drawText('Ansatt', { x: colX.ansatt, y: tableY, size: 9, font: bold, color: COLOR.dark })
  page.drawText('Beskrivelse', { x: colX.beskrivelse, y: tableY, size: 9, font: bold, color: COLOR.dark })
  page.drawText('Varighet', { x: colX.varighet, y: tableY, size: 9, font: bold, color: COLOR.dark })
  page.drawText('Timepris', { x: colX.timepris, y: tableY, size: 9, font: bold, color: COLOR.dark })
  page.drawText('Sum NOK', { x: colX.sum, y: tableY, size: 9, font: bold, color: COLOR.dark })
  tableY -= 18

  const minFooterY = 240 // reserve room for totals + payment-terms block
  let rowIdx = 0
  for (const e of entries) {
    if (tableY < minFooterY) {
      page.drawText(`… ${entries.length - rowIdx} flere linjer ikke vist (se CSV-eksport)`, {
        x: PAGE_MARGIN,
        y: tableY,
        size: 8,
        font,
        color: COLOR.muted,
      })
      tableY -= 14
      break
    }
    const min = minutesBetween(e.started_at, e.ended_at)
    const sum = (min / 60) * Number(e.hourly_rate)
    const ansatt =
      profIdx.get(e.user_id)?.display_name ?? profIdx.get(e.user_id)?.email ?? '—'
    const descLines = wrapText(e.description ?? '—', font, 8, 165)
    const rowH = Math.max(14, descLines.length * 10)
    if (rowIdx % 2 === 0) {
      page.drawRectangle({
        x: PAGE_MARGIN - 4,
        y: tableY - 3,
        width: A4_WIDTH - 2 * PAGE_MARGIN + 8,
        height: rowH,
        color: rgb(0.985, 0.985, 0.985),
      })
    }
    page.drawText(e.started_at.slice(0, 10), {
      x: colX.dato,
      y: tableY,
      size: 8,
      font,
      color: COLOR.dark,
    })
    page.drawText(ansatt.substring(0, 18), {
      x: colX.ansatt,
      y: tableY,
      size: 8,
      font,
      color: COLOR.dark,
    })
    let dy = tableY
    for (const line of descLines) {
      page.drawText(line, { x: colX.beskrivelse, y: dy, size: 8, font, color: COLOR.dark })
      dy -= 10
    }
    page.drawText(fmtHm(min), { x: colX.varighet, y: tableY, size: 8, font, color: COLOR.dark })
    page.drawText(fmtNok(Number(e.hourly_rate)), {
      x: colX.timepris,
      y: tableY,
      size: 8,
      font,
      color: COLOR.dark,
    })
    page.drawText(fmtNok(sum), {
      x: colX.sum,
      y: tableY,
      size: 8,
      font: bold,
      color: COLOR.dark,
    })
    tableY -= rowH + 2
    rowIdx += 1
  }

  // ── Totals block (right-aligned) ────────────────────────────────────
  let totalsY = Math.max(tableY - 20, 180)
  const totalsXLabel = A4_WIDTH - PAGE_MARGIN - 220
  const totalsXValue = A4_WIDTH - PAGE_MARGIN - 60
  page.drawLine({
    start: { x: totalsXLabel, y: totalsY + 14 },
    end: { x: A4_WIDTH - PAGE_MARGIN, y: totalsY + 14 },
    color: COLOR.light,
    thickness: 0.5,
  })
  const drawTotalRow = (label: string, value: string, isBold = false) => {
    const f = isBold ? bold : font
    page.drawText(label, { x: totalsXLabel, y: totalsY, size: 10, font: f, color: COLOR.dark })
    page.drawText(value, { x: totalsXValue, y: totalsY, size: 10, font: f, color: COLOR.dark })
    totalsY -= 16
  }
  drawTotalRow('Sum eks. MVA', `${fmtNok(subtotal)} NOK`)
  drawTotalRow(`MVA ${(vatRate * 100).toFixed(0)} %`, `${fmtNok(vatAmount)} NOK`)
  page.drawLine({
    start: { x: totalsXLabel, y: totalsY + 14 },
    end: { x: A4_WIDTH - PAGE_MARGIN, y: totalsY + 14 },
    color: COLOR.dark,
    thickness: 0.75,
  })
  drawTotalRow('Sum inkl. MVA', `${fmtNok(total)} NOK`, true)

  // ── Payment-terms block (left) ──────────────────────────────────────
  let payY = Math.max(totalsY - 10, 110)
  page.drawText('Betalingsbetingelser', {
    x: PAGE_MARGIN,
    y: payY,
    size: 10,
    font: bold,
    color: COLOR.brand,
  })
  payY -= 14
  const terms =
    `Faktura forfaller ${termsDays} dager etter mottak (${fmtDate(dueDate)}). ` +
    (partner.bank_account_number
      ? `Innbetaling til bankkonto ${partner.bank_account_number}, KID ${kid}. `
      : `Vipps / bankkonto: kontakt ${partner.billing_email ?? partner.name}. `) +
    'Ved forsinket betaling påløper forsinkelsesrente etter forsinkelsesrenteloven.'
  const termsLines = wrapText(terms, font, 9, A4_WIDTH - 2 * PAGE_MARGIN - 220)
  for (const line of termsLines) {
    page.drawText(line, { x: PAGE_MARGIN, y: payY, size: 9, font, color: COLOR.dark })
    payY -= 11
  }

  drawFooter(page, font, new Date().toLocaleString('nb-NO'))

  const pdfBytes = await pdf.save()

  // 10) Upload to Storage.
  const bucket = 'partner-invoices'
  const path = `${body.partner_id}/${body.invoice_id}.pdf`
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (upErr) {
    return json({ ok: false, error: 'upload_failed', detail: upErr.message }, 500)
  }

  // 11) Sign a 1-hour URL.
  const { data: signed, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60)
  if (signErr) {
    return json({ ok: false, error: 'sign_failed', detail: signErr.message }, 500)
  }

  // 12) Stamp pdf_storage_path + pdf_generated_at on the invoice.
  await supabase
    .from('partner_invoices')
    .update({
      pdf_storage_path: path,
      pdf_generated_at: new Date().toISOString(),
    })
    .eq('id', body.invoice_id)

  return json({
    ok: true,
    invoice_number: invoiceNumber,
    storage_path: path,
    signed_url: signed?.signedUrl,
    expires_in_seconds: 60 * 60,
    rows: entries.length,
  })
})
