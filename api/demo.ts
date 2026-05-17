// Vercel Edge Function — POST /api/demo
// Receives the demo form, validates, and forwards to Resend.
//
// Env vars (set in Vercel project → Settings → Environment Variables):
//   RESEND_API_KEY    — Resend API key (re_...)
//   RESEND_FROM       — "Klarert <hei@klarert.com>" (a verified sender on Resend)
//   DEMO_TO           — recipient address (defaults to hei@klarert.com)
//
// Returns 200 { ok: true } on success, 400/500 with { ok: false, error } on failure.
// Edge runtime: ~50 KB cold start, no Node dep tree.

export const config = { runtime: 'edge' }

declare const process: { env: Record<string, string | undefined> }

type Payload = {
  name?: string
  org?: string
  size?: string
  focus?: string
  email?: string
  message?: string
  honey?: string
  source?: string
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

  const name = (body.name ?? '').trim()
  const org = (body.org ?? '').trim()
  const size = (body.size ?? '').trim()
  const focus = (body.focus ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const message = (body.message ?? '').trim()

  if (!name || !org || !size || !focus || !email) {
    return json({ ok: false, error: 'Mangler obligatoriske felt' }, 400)
  }

  if (!looksLikeEmail(email)) {
    return json({ ok: false, error: 'Ugyldig e-postadresse' }, 400)
  }

  if (name.length > 200 || org.length > 200 || message.length > 4000) {
    return json({ ok: false, error: 'For lang verdi' }, 400)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[demo] RESEND_API_KEY missing')
    return json({ ok: false, error: 'Server misconfigured' }, 500)
  }

  const fromAddr = process.env.RESEND_FROM || 'Klarert <onboarding@resend.dev>'
  const toAddr = process.env.DEMO_TO || 'hei@klarert.com'

  const subject = `Demo-forespørsel: ${org}`
  const lines = [
    `<p><strong>Navn:</strong> ${escapeHtml(name)}</p>`,
    `<p><strong>Organisasjon:</strong> ${escapeHtml(org)}</p>`,
    `<p><strong>E-post:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`,
    `<p><strong>Størrelse:</strong> ${escapeHtml(size)}</p>`,
    `<p><strong>Hovedfokus:</strong> ${escapeHtml(focus)}</p>`,
    message ? `<p><strong>Mer info:</strong></p><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${escapeHtml(message).replace(/\n/g, '<br/>')}</blockquote>` : '',
    `<hr/><p style="color:#888;font-size:12px">Sendt fra ${escapeHtml(body.source ?? 'klarert.com/demo')}</p>`,
  ].filter(Boolean)
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1a3d32">${lines.join('\n')}</body></html>`
  const text = [
    `Navn: ${name}`,
    `Organisasjon: ${org}`,
    `E-post: ${email}`,
    `Størrelse: ${size}`,
    `Hovedfokus: ${focus}`,
    message ? `\nMer info:\n${message}` : '',
    `\n— sendt fra ${body.source ?? 'klarert.com/demo'}`,
  ].filter(Boolean).join('\n')

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
      console.error('[demo] Resend error', res.status, errBody)
      return json({ ok: false, error: `Resend ${res.status}` }, 502)
    }
  } catch (err) {
    console.error('[demo] fetch failed', err)
    return json({ ok: false, error: 'Network failure' }, 502)
  }

  return json({ ok: true })
}
