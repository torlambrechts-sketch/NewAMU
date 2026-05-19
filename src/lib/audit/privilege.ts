// Programmatic privileged-data classifiers.
//
// Source of truth for which mutations carry `privileged: true`.
// See specs/endringslogg-privileged-data.md for the human-readable
// table that legal owns; this file is the executable mirror.
//
// Wired into the lint rule audit-privileged-classification.js — any
// emitAuditEvent call passing `privileged: true` must either pair it
// with a `// classified:` comment or pull the value from one of the
// helpers below. The helper imports are whitelisted; inline `true`
// is not.

// classified: legal-review-pending
// (placeholder until the legal sign-off pass in W4)

export type MeetingConfidentiality =
  | 'public'
  | 'internal'
  | 'drofting'
  | 'varsling'
  | 'mus'
  | 'pgop'
  | 'restricted'

const PRIVILEGED_MEETING_KINDS = new Set<MeetingConfidentiality>([
  'drofting',
  'varsling',
  'mus',
  'pgop',
  'restricted',
])

export const isPrivileged = {
  /**
   * Meetings: privileged when the meeting's confidentiality level
   * matches AML §8-3 / §15-1 / drøftelsesmøter rules.
   *
   * The action argument is for future per-action exceptions
   * (signProtocol stays public-record per AML §7-2 even on a
   * confidential meeting); for v1 they all follow the same rule.
   */
  meeting(
    meeting: { confidentiality_level?: string | null } | null | undefined,
    _action: string,
  ): boolean {
    const level = (meeting?.confidentiality_level ?? '') as MeetingConfidentiality
    if (_action === 'signert' || _action === 'protokollert' || _action === 'delt') {
      // The fact of signing / sharing is non-privileged even on a
      // confidential meeting; only the *content* of the protocol is.
      return false
    }
    return PRIVILEGED_MEETING_KINDS.has(level)
  },

  /**
   * Tasks: privileged for tilsynsbrev-spawned + HR-flagged tasks.
   */
  task(task: { confidentiality?: string | null } | null | undefined): boolean {
    const c = task?.confidentiality ?? null
    return c === 'restricted' || c === 'confidential'
  },

  /**
   * Documents: privileged on body diffs when the page's legal_basis
   * includes AML §2A / §14-G / §15-1 / any GDPR Article. Metadata
   * (title, tags) stays non-privileged.
   */
  document(
    page: { legal_basis?: string[] | null } | null | undefined,
    field: 'body' | 'metadata',
  ): boolean {
    if (field === 'metadata') return false
    const bases = page?.legal_basis ?? []
    return bases.some(
      (b) =>
        b === 'AML § 2A' ||
        b === 'AML § 14-G' ||
        b === 'AML § 15-1' ||
        b.startsWith('GDPR Art.'),
    )
  },

  /**
   * Alerts: ALWAYS privileged. AML §2A-7 + GDPR Art. 9.
   * Hardcoded `true` here so the lint rule whitelists alerts emits
   * without needing per-call classification comments.
   */
  alertCase(): boolean {
    return true
  },

  /**
   * Survey responses on non-anonymous campaigns.
   */
  surveyResponse(
    campaign: { respondent_identification?: string | null } | null | undefined,
  ): boolean {
    return campaign?.respondent_identification === 'identified'
  },

  /**
   * Registers — injury logs are privileged (medical data,
   * AML §5-2). Other register types decided per type.
   */
  registerEntry(
    type: { slug?: string | null; is_privileged?: boolean | null } | null | undefined,
  ): boolean {
    if (type?.is_privileged) return true
    const slug = type?.slug ?? ''
    return slug === 'skadelogg' || slug === 'narrt-skadet' || slug.startsWith('helse-')
  },
}
