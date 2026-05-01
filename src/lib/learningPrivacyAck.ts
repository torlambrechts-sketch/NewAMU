/** Session key for GDPR Art. 13 first-visit notice (e-learning). Bump if copy changes materially. */
export const LEARNING_PRIVACY_SESSION_KEY = 'learning-privacy-ack-v1'

export function isLearningPrivacyAcknowledged(): boolean {
  try {
    return sessionStorage.getItem(LEARNING_PRIVACY_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function setLearningPrivacyAcknowledged(): void {
  try {
    sessionStorage.setItem(LEARNING_PRIVACY_SESSION_KEY, '1')
  } catch {
    /* private mode / quota */
  }
}
