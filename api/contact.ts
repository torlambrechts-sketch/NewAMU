// Vercel Edge Function — POST /api/contact
// Receives the contact form (demo, questions, partnership, other) and
// forwards to Resend with a type-aware subject line and HTML body.
//
// Env vars (set in Vercel project → Settings → Environment Variables):
//   RESEND_API_KEY    — Resend API key (re_...)
//   RESEND_FROM       — "Klarert <hei@klarert.com>" (verified sender on Resend)
//   CONTACT_TO        — recipient address (defaults to hei@klarert.com)
//                       DEMO_TO is accepted as a fallback alias for backwards
//                       compat with the previous /api/demo deployment.
//
// Edge runtime: ~50 KB cold start, no Node dep tree.

export const config = { runtime: 'edge' }

declare const process: { env: Record<string, string | undefined> }

type InquiryType = 'demo' | 'sporsmal' | 'partnerskap' | 'annet'

type Payload = {
  type?: InquiryType
  name?: string
  org?: string
  size?: string
  focus?: string
  email?: string
  message?: string
  honey?: string
  source?: string
}

const TYPE_LABEL: Record<InquiryType, string> = {
  demo: 'Demo-forespørsel',
  sporsmal: 'Spørsmål',
  partnerskap: 'Partnerskap',
  annet: 'Henvendelse',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function isInquiryType(value: string): value is InquiryType {
  return value === 'demo' || value === 'sporsmal' || value === 'partnerskap' || value === 'annet'
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Allow': 'POST, OPTIONS' },
    })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  let body: Payload
  try {
    body = (await req.json()) as Payload
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  // Honeypot — silently accept and discard so bots don't get a useful signal.
  if (body.honey && body.honey.length > 0) {
    return json({ ok: true })
  }

  const type: InquiryType = body.type && isInquiryType(body.type) ? body.type : 'annet'
  const name = (body.name ?? '').trim()
  const org = (body.org ?? '').trim()
  const size = (body.size ?? '').trim()
  const focus = (body.focus ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const message = (body.message ?? '').trim()

  // All inquiries require name + email. Demo requires org/size/focus too.
  if (!name || !email) {
    return json({ ok: false, error: 'Navn og e-post er obligatorisk' }, 400)
  }
  if (type === 'demo' && (!org || !size || !focus)) {
    return json({ ok: false, error: 'Demo krever organisasjon, størrelse og hovedfokus' }, 400)
  }
  // Non-demo inquiries need a message (otherwise we don't know what they want).
  if (type !== 'demo' && !message) {
    return json({ ok: false, error: 'Melding er obligatorisk for spørsmål' }, 400)
  }

  if (!looksLikeEmail(email)) {
    return json({ ok: false, error: 'Ugyldig e-postadresse' }, 400)
  }

  if (name.length > 200 || org.length > 200 || message.length > 4000) {
    return json({ ok: false, error: 'For lang verdi' }, 400)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY missing')
    return json({ ok: false, error: 'Server misconfigured' }, 500)
  }

  const fromAddr = process.env.RESEND_FROM || 'Klarert <onboarding@resend.dev>'
  const toAddr = process.env.CONTACT_TO || process.env.DEMO_TO || 'hei@klarert.com'

  const subject = `${TYPE_LABEL[type]}: ${org || email}`

  const lines = [
    `<p><strong>Type:</strong> ${escapeHtml(TYPE_LABEL[type])}</p>`,
    `<p><strong>Navn:</strong> ${escapeHtml(name)}</p>`,
    org ? `<p><strong>Organisasjon:</strong> ${escapeHtml(org)}</p>` : '',
    `<p><strong>E-post:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`,
    size ? `<p><strong>Størrelse:</strong> ${escapeHtml(size)}</p>` : '',
    focus ? `<p><strong>Hovedfokus:</strong> ${escapeHtml(focus)}</p>` : '',
    message
      ? `<p><strong>Melding:</strong></p><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${escapeHtml(message).replace(/\n/g, '<br/>')}</blockquote>`
      : '',
    `<hr/><p style="color:#888;font-size:12px">Sendt fra ${escapeHtml(body.source ?? 'klarert.com/kontakt')}</p>`,
  ].filter(Boolean)
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1a3d32">${lines.join('\n')}</body></html>`

  const textLines = [
    `Type: ${TYPE_LABEL[type]}`,
    `Navn: ${name}`,
    org ? `Organisasjon: ${org}` : '',
    `E-post: ${email}`,
    size ? `Størrelse: ${size}` : '',
    focus ? `Hovedfokus: ${focus}` : '',
    message ? `\nMelding:\n${message}` : '',
    `\n— sendt fra ${body.source ?? 'klarert.com/kontakt'}`,
  ].filter(Boolean)
  const text = textLines.join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [toAddr],
        reply_to: email,
        subject,
        html,
        text,
      }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.error('[contact] Resend error', res.status, errBody)
      return json({ ok: false, error: `Resend ${res.status}` }, 502)
    }
  } catch (err) {
    console.error('[contact] fetch failed', err)
    return json({ ok: false, error: 'Network failure' }, 502)
  }

  return json({ ok: true })
}
