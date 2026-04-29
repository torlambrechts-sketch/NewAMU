import { randomSurveyInvitationToken } from './surveyInviteLink'

const PREFIX = 'survey_resp_sess:'

/** Stabil sesjonstoken per fane for anonyme undersøkelser (C6 dedupe). */
export function getOrCreateAnonymousSessionToken(surveyId: string): string {
  if (typeof sessionStorage === 'undefined') {
    return randomSurveyInvitationToken().slice(0, 48)
  }
  const key = `${PREFIX}${surveyId}`
  const existing = sessionStorage.getItem(key)
  if (existing && existing.length >= 16) return existing
  const t = randomSurveyInvitationToken().slice(0, 48)
  sessionStorage.setItem(key, t)
  return t
}
