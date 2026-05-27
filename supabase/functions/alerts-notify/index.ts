// alerts-notify — reads pending rows from alert_notification and dispatches
// content-free emails via the existing gov_notifications_outbox transport.
// Strictly enforces: body templates are server-side; payload from the
// notification row only contains case number, state, deep link.
//
// Invocation: cron every 5 minutes via supabase scheduled-function, or
// on-demand by Phase 5 dashboards.

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

const TEMPLATES: Record<string, { subject_nb: string; body_nb: string; subject_en: string; body_en: string }> = {
  ack_due: {
    subject_nb: 'Varslingssak — mottak må bekreftes',
    body_nb: 'Sak {caseNumberShort} må kvitteres. Gå til {deepLink}.',
    subject_en: 'Whistleblower case — acknowledgement due',
    body_en: 'Case {caseNumberShort} needs acknowledgement. Open {deepLink}.',
  },
  feedback_due: {
    subject_nb: 'Varslingssak — tilbakemelding må gis',
    body_nb: 'Sak {caseNumberShort} ({state}). Frist nærmer seg. {deepLink}.',
    subject_en: 'Whistleblower case — feedback due',
    body_en: 'Case {caseNumberShort} ({state}). Deadline approaching. {deepLink}.',
  },
  triage_breach: {
    subject_nb: 'Triage-frist BRUTT',
    body_nb: 'Sak {caseNumberShort} har ikke blitt triagert i tide. {deepLink}.',
    subject_en: 'Triage SLA BREACHED',
    body_en: 'Case {caseNumberShort} has missed its triage SLA. {deepLink}.',
  },
  dsar_due: {
    subject_nb: 'DSAR — frist nærmer seg',
    body_nb: 'En DSAR-forespørsel må svares innen 5 dager. {deepLink}.',
    subject_en: 'DSAR — deadline approaching',
    body_en: 'A DSAR must be responded to within 5 days. {deepLink}.',
  },
  break_glass_initiated: {
    subject_nb: 'Break-the-glass: ventende godkjenning',
    body_nb: 'En nødtilgangsesjon er initiert og krever godkjenning. {deepLink}.',
    subject_en: 'Break-the-glass: pending approval',
    body_en: 'An emergency-access session is initiated and needs approval. {deepLink}.',
  },
  break_glass_approved: {
    subject_nb: 'Break-the-glass aktivert',
    body_nb: 'En nødtilgangsesjon er godkjent og aktiv. {deepLink}.',
    subject_en: 'Break-the-glass active',
    body_en: 'An emergency-access session is active. {deepLink}.',
  },
  break_glass_revoked: {
    subject_nb: 'Break-the-glass avvist / opphevet',
    body_nb: 'Nødtilgangsesjon er avvist eller opphevet. {deepLink}.',
    subject_en: 'Break-the-glass revoked',
    body_en: 'Emergency-access session revoked. {deepLink}.',
  },
  audit_chain_broken: {
    subject_nb: 'KRITISK: audit-kjede brutt',
    body_nb: 'Audit-kjeden for varslingsmodulen er brutt. Undersøk umiddelbart. {deepLink}.',
    subject_en: 'CRITICAL: audit chain broken',
    body_en: 'The whistleblower audit chain is broken. Investigate immediately. {deepLink}.',
  },
  case_assigned: {
    subject_nb: 'Du er tildelt en varslingssak',
    body_nb: 'Sak {caseNumberShort} er tildelt deg. {deepLink}.',
    subject_en: 'You have been assigned a whistleblower case',
    body_en: 'Case {caseNumberShort} is assigned to you. {deepLink}.',
  },
  legal_hold_imposed: {
    subject_nb: 'Legal hold innført',
    body_nb: 'Sak {caseNumberShort} er underlagt legal hold. {deepLink}.',
    subject_en: 'Legal hold imposed',
    body_en: 'Case {caseNumberShort} is under legal hold. {deepLink}.',
  },
  legal_hold_released: {
    subject_nb: 'Legal hold opphevet',
    body_nb: 'Sak {caseNumberShort} har fått legal hold opphevet. {deepLink}.',
    subject_en: 'Legal hold released',
    body_en: 'Case {caseNumberShort} legal hold released. {deepLink}.',
  },
  retention_imminent: {
    subject_nb: 'Sak nærmer seg retensjonsutløp',
    body_nb: 'Sak {caseNumberShort} blir maskert om kort tid. {deepLink}.',
    subject_en: 'Case retention expiring',
    body_en: 'Case {caseNumberShort} will be redacted soon. {deepLink}.',
  },
  new_message_from_committee: {
    subject_nb: 'Ny melding fra varslingsutvalget',
    body_nb: 'Ny melding på sak {caseNumberShort}. Logg inn for å lese. {deepLink}.',
    subject_en: 'New message from the committee',
    body_en: 'New message on case {caseNumberShort}. Sign in to read. {deepLink}.',
  },
  new_message_from_reporter: {
    subject_nb: 'Ny melding fra varsler',
    body_nb: 'Varsler har lagt inn ny melding på sak {caseNumberShort}. {deepLink}.',
    subject_en: 'New message from reporter',
    body_en: 'The reporter posted a new message on case {caseNumberShort}. {deepLink}.',
  },
  interim_due: {
    subject_nb: 'Interim-oppdatering må gis',
    body_nb: 'Sak {caseNumberShort} trenger interim-oppdatering. {deepLink}.',
    subject_en: 'Interim update due',
    body_en: 'Case {caseNumberShort} needs an interim update. {deepLink}.',
  },
  dsar_received: {
    subject_nb: 'Ny DSAR-forespørsel',
    body_nb: 'En ny DSAR-forespørsel er registrert. {deepLink}.',
    subject_en: 'New DSAR request',
    body_en: 'A new DSAR request has been registered. {deepLink}.',
  },
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405)
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'misconfigured' }, 500)

  const headers = {
    apikey: SERVICE_ROLE,
    authorization: `Bearer ${SERVICE_ROLE}`,
    'content-type': 'application/json',
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/alert_notification?delivered_at=is.null&order=sent_at.asc&limit=100`,
    { headers },
  )
  const rows = (await res.json()) as Array<{
    id: string
    notification_kind: string
    deep_link_token: string | null
    body_template_id: string
    body_variables: Record<string, unknown>
    case_id: string | null
    organization_id: string
  }>

  let delivered = 0
  for (const row of rows) {
    const template = TEMPLATES[row.body_template_id] ?? TEMPLATES[row.notification_kind]
    if (!template) continue
    const vars: Record<string, string> = {
      caseNumberShort: (row.body_variables.caseNumberShort as string) ?? (row.case_id?.slice(0, 8) ?? ''),
      state: (row.body_variables.state as string) ?? '',
      deepLink: row.deep_link_token ?? '',
    }
    // The actual email transport — write into gov_notifications_outbox so
    // the org's configured transport (already deployed) picks it up. Never
    // include case body in the outbox.
    await fetch(`${SUPABASE_URL}/rest/v1/gov_notifications_outbox`, {
      method: 'POST',
      headers: { ...headers, prefer: 'return=minimal' },
      body: JSON.stringify({
        organization_id: row.organization_id,
        kind: `alerts_${row.notification_kind}`,
        payload: {
          subject: template.subject_nb,
          body: fill(template.body_nb, vars),
          deepLink: row.deep_link_token,
        },
        priority: row.notification_kind === 'audit_chain_broken' ? 'critical' : 'normal',
      }),
    })
    await fetch(`${SUPABASE_URL}/rest/v1/alert_notification?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ delivered_at: new Date().toISOString() }),
    })
    delivered++
  }
  return json({ delivered, pending: rows.length - delivered })
})
