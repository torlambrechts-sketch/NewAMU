/**
 * BankID OIDC init — fase 4 skeleton.
 *
 * Initierer BankID OIDC autorisasjon for dokument-signering. Klient kaller
 * fra SignatureBlock-modulen og redirecter brukeren til returnerte URL.
 * Tilbake-callback håndteres av bankid-callback (egen edge function).
 *
 * Krav for produksjons-bruk:
 *   - BankID Merchant-avtale (kommersiell avtale med Vipps BankID AS)
 *   - Klient-sertifikat (X.509 — lagres som Vault-secret BANKID_PRIVATE_KEY)
 *   - Klient-ID (lagres i org_integrations.config.client_id)
 *   - Callback-URL registrert hos BankID
 *
 * Denne stubben dokumenterer integrasjonspunktene og returnerer en
 * NOT_IMPLEMENTED-response inntil avtale er på plass. Da byttes
 * stub-koden ut med faktisk OIDC-flow:
 *   1. Generer state + nonce, lagre i bankid_signatures med status='pending'
 *   2. Bygg authorization-URL mot https://auth.bankid.no/auth/realms/prod/...
 *   3. Returner URL til klient
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  let body: { page_id?: string; page_version?: number; signer_role?: string; organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  const { page_id, page_version, signer_role, organization_id } = body
  if (!page_id || !page_version || !signer_role || !organization_id) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  // Sjekk at BankID-integrasjon er aktivert for org
  const { data: integration, error: intErr } = await supabase
    .from('org_integrations')
    .select('config')
    .eq('organization_id', organization_id)
    .eq('kind', 'bankid')
    .eq('enabled', true)
    .maybeSingle()
  if (intErr) return json({ ok: false, error: intErr.message }, 500)
  if (!integration) return json({ ok: false, error: 'bankid_not_enabled' }, 400)

  const config = integration.config as { client_id?: string; callback_url?: string; environment?: string }
  if (!config.client_id || !config.callback_url) {
    return json({ ok: false, error: 'bankid_incomplete_config' }, 400)
  }

  // TODO (fase 4 — krever Merchant-avtale): generer state, lagre pending-rad
  // i bankid_signatures, bygg auth-URL.
  //
  // For nå: returner not_implemented + dokumenter integrasjonspunktet
  // slik at frontend kan vise tydelig melding.
  return json({
    ok: false,
    error: 'bankid_flow_not_yet_implemented',
    note: 'BankID OIDC-flow krever Merchant-avtale med Vipps BankID AS. Konfigurasjon er klar; selve flow må aktiveres når sertifikat er på plass.',
    config_present: {
      client_id: Boolean(config.client_id),
      callback_url: Boolean(config.callback_url),
      environment: config.environment ?? 'unknown',
    },
  }, 501)
})
