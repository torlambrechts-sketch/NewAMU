/** AML § 6-5 — minimum 40 hours safety representative foundational training (tracked in minutes). */
export const VERNEOMBUD_REQUIRED_MINUTES = 2400

export function verneombudComplianceTone(minutes: number): 'red' | 'amber' | 'green' {
  if (minutes >= VERNEOMBUD_REQUIRED_MINUTES) return 'green'
  if (minutes >= 1200) return 'amber'
  return 'red'
}
