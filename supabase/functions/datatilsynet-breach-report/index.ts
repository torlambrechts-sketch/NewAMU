// Deprecated — replaced by gov-datatilsynet-breach (2026-09-05). Will be removed in 2026-Q4 cleanup.
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'gone',
      detail:
        'datatilsynet-breach-report is deprecated. Use gov-datatilsynet-breach (workflow substrate) instead. Scheduled for removal in 2026-Q4.',
      replacement: 'gov-datatilsynet-breach',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
