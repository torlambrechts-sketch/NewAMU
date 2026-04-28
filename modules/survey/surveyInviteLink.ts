/** URL for respondents opening a personal invitation (opaque token in query). */
export function buildSurveyRespondUrl(surveyId: string, inviteToken: string): string {
  const origin =
    typeof globalThis !== 'undefined' && typeof globalThis.location !== 'undefined'
      ? globalThis.location.origin
      : ''
  const path = `/survey-respond/${encodeURIComponent(surveyId)}`
  const qs = `invite=${encodeURIComponent(inviteToken)}`
  return origin ? `${origin}${path}?${qs}` : `${path}?${qs}`
}

/** 32 random bytes as hex (64 chars) — stored on survey_invitations.access_token */
export function randomSurveyInvitationToken(): string {
  const bytes = new Uint8Array(32)
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i]!.toString(16).padStart(2, '0')
  return out
}
