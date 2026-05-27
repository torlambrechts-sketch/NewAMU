// alerts-execute-workflow — thin proxy around alerts_execute_transition.
// Captures the actor's user-agent (never IP) for the timeline payload, so
// the audit row records the device used to make the change.

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

type RequestBody = {
  caseId: string
  toState: string
  justification?: string
  coiDeclarationId?: string
  assignedHandlerId?: string
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
  if (!body.caseId || !body.toState) return json({ ok: false, error: 'missing_fields' }, 400)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  if (!SUPABASE_URL) return json({ ok: false, error: 'misconfigured' }, 500)
  const callerAuth = req.headers.get('authorization')
  if (!callerAuth) return json({ ok: false, error: 'unauthenticated' }, 401)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/alerts_execute_transition`, {
    method: 'POST',
    headers: {
      authorization: callerAuth,
      apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_case_id: body.caseId,
      p_to_state: body.toState,
      p_justification: body.justification ?? null,
      p_coi_declaration_id: body.coiDeclarationId ?? null,
      p_assigned_handler_id: body.assignedHandlerId ?? null,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    return json({ ok: false, error: 'rpc_failed', detail }, res.status)
  }
  return json({ ok: true })
})
