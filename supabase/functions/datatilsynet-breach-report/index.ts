/**
 * Datatilsynet brudd-rapportering — fase 4 skeleton.
 *
 * Sender brudd-melding til Datatilsynet via Altinn/Maskinporten innen
 * GDPR Art. 33 72-timers-fristen. Tar gdpr_breach_incidents.id som input
 * og rapporterer skjema 8081 «Innmelding av brudd på personopplysnings-
 * sikkerheten» til Datatilsynet via Altinn 3 REST API.
 *
 * Krav for produksjons-bruk:
 *   - Maskinporten klient-konfigurasjon (registrert hos Digdir)
 *   - Klient-sertifikat (X.509 — lagres som Vault-secret ALTINN_MASKINPORTEN_PRIVATE_KEY)
 *   - Scope: altinn:correspondence/write eller altinn:datasletting/write
 *   - Altinn 3 organization registration
 *
 * Denne stubben:
 *   1. Henter brudd-record
 *   2. Validerer at status er klar for rapportering
 *   3. Returnerer mock-respons inntil Altinn-tilkobling er aktivert
 *   4. Når aktivert: oppdaterer reported_to_datatilsynet_at + datatilsynet_reference
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

  let body: { incident_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.incident_id) return json({ ok: false, error: 'missing_incident_id' }, 400)

  const { data: incident, error } = await supabase
    .from('gdpr_breach_incidents')
    .select('*')
    .eq('id', body.incident_id)
    .single()
  if (error) return json({ ok: false, error: error.message }, 500)
  if (!incident) return json({ ok: false, error: 'incident_not_found' }, 404)

  // Valider klargjorthet
  if (!incident.risk_assessment || !incident.mitigation_actions) {
    return json({
      ok: false,
      error: 'incident_incomplete',
      missing: [
        ...(incident.risk_assessment ? [] : ['risk_assessment']),
        ...(incident.mitigation_actions ? [] : ['mitigation_actions']),
      ],
    }, 400)
  }

  // Sjekk at Altinn-integrasjon er aktivert
  const { data: altinnInt } = await supabase
    .from('org_integrations')
    .select('config, enabled')
    .eq('organization_id', incident.organization_id)
    .eq('kind', 'altinn')
    .maybeSingle()

  if (!altinnInt || !altinnInt.enabled) {
    return json({
      ok: false,
      error: 'altinn_not_enabled',
      note: 'Aktiver Altinn-integrasjon under Admin → Integrasjoner først. Rapportering må gjøres manuelt via https://www.datatilsynet.no/kontakt-oss/melding-om-brudd-pa-personopplysningssikkerheten/ inntil Maskinporten-tilgang er på plass.',
      manual_form_url: 'https://www.datatilsynet.no/kontakt-oss/melding-om-brudd-pa-personopplysningssikkerheten/',
    }, 501)
  }

  // TODO (fase 4 — krever Maskinporten-avtale):
  //   1. Hent Maskinporten access-token (JWT bearer-grant)
  //   2. Bygg Altinn 3-correspondence med skjema 8081
  //   3. POST mot https://platform.altinn.no/correspondence/api/v1/...
  //   4. Lagre Datatilsynet-referanse i incident
  //   5. Oppdater status='reported' + reported_to_datatilsynet_at
  return json({
    ok: false,
    error: 'altinn_flow_not_yet_implemented',
    note: 'Maskinporten + Altinn 3 integrasjon må aktiveres med klient-sertifikat før rapportering kan automatiseres. Bruk Datatilsynets web-skjema manuelt og lagre referansen tilbake.',
  }, 501)
})
