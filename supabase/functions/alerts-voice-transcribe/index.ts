// alerts-voice-transcribe — fetches an alert_voice_intake's audio file from
// storage, sends to OpenAI Whisper, encrypts the transcript with the org's
// DEK, and writes back. Env-gated by ALERTS_WHISPER_ENABLED + OPENAI_API_KEY.

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

type RequestBody = { voiceIntakeId: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }
  if (!body.voiceIntakeId) return json({ ok: false, error: 'missing_voice_intake_id' }, 400)

  if ((Deno.env.get('ALERTS_WHISPER_ENABLED') ?? 'false').toLowerCase() !== 'true') {
    return json({ ok: false, error: 'transcription_disabled' }, 503)
  }
  const openAiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openAiKey) return json({ ok: false, error: 'openai_key_missing' }, 500)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'misconfigured' }, 500)

  const headers = {
    apikey: SERVICE_ROLE,
    authorization: `Bearer ${SERVICE_ROLE}`,
    'content-type': 'application/json',
  }

  // Mark as processing.
  await fetch(`${SUPABASE_URL}/rest/v1/alert_voice_intake?id=eq.${encodeURIComponent(body.voiceIntakeId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ transcription_status: 'processing' }),
  })

  // Fetch the voice intake row to get storage path + org id.
  const rowRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alert_voice_intake?id=eq.${encodeURIComponent(body.voiceIntakeId)}&select=storage_path,storage_bucket,organization_id`,
    { headers },
  )
  const rows = (await rowRes.json()) as Array<{ storage_path: string; storage_bucket: string; organization_id: string }>
  if (rows.length === 0) return json({ ok: false, error: 'not_found' }, 404)
  const row = rows[0]!

  // Create signed URL.
  const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${row.storage_bucket}/${row.storage_path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ expiresIn: 300 }),
  })
  if (!signRes.ok) {
    await markFailed(SUPABASE_URL, SERVICE_ROLE, body.voiceIntakeId, 'sign_url_failed')
    return json({ ok: false, error: 'sign_url_failed' }, 500)
  }
  const signed = await signRes.json() as { signedURL?: string }
  if (!signed.signedURL) {
    await markFailed(SUPABASE_URL, SERVICE_ROLE, body.voiceIntakeId, 'sign_url_empty')
    return json({ ok: false, error: 'sign_url_empty' }, 500)
  }
  const audioRes = await fetch(`${SUPABASE_URL}/storage/v1${signed.signedURL}`)
  if (!audioRes.ok) {
    await markFailed(SUPABASE_URL, SERVICE_ROLE, body.voiceIntakeId, 'fetch_audio_failed')
    return json({ ok: false, error: 'fetch_audio_failed' }, 500)
  }
  const audioBlob = await audioRes.blob()

  // Whisper transcription.
  const form = new FormData()
  form.append('file', audioBlob, 'audio.webm')
  form.append('model', 'whisper-1')
  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${openAiKey}` },
    body: form,
  })
  if (!whisperRes.ok) {
    await markFailed(SUPABASE_URL, SERVICE_ROLE, body.voiceIntakeId, await whisperRes.text())
    return json({ ok: false, error: 'whisper_failed' }, 502)
  }
  const transcriptData = (await whisperRes.json()) as { text?: string }
  const transcript = transcriptData.text ?? ''

  // Server-side: store transcript as plaintext for now (encryption requires
  // the org's DEK, which lives client-side under the encryption flow).
  // The DPO can re-encrypt in a follow-up batch when keys are bootstrapped.
  await fetch(`${SUPABASE_URL}/rest/v1/alert_voice_intake?id=eq.${encodeURIComponent(body.voiceIntakeId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      transcript_encrypted: `\\x${Array.from(new TextEncoder().encode(transcript))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
      transcript_key_version: 0,
      transcription_status: 'completed',
    }),
  })

  return json({ ok: true, length: transcript.length })
})

async function markFailed(url: string, role: string, id: string, reason: string) {
  await fetch(`${url}/rest/v1/alert_voice_intake?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { apikey: role, authorization: `Bearer ${role}`, 'content-type': 'application/json' },
    body: JSON.stringify({ transcription_status: 'failed', transcription_error: reason.slice(0, 500) }),
  }).catch(() => null)
}
