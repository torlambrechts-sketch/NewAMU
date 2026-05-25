// Module-wide caps for the compliance-planner hooks. Centralised so
// changing a limit doesn't require grep-and-replace across the
// internkontroll surfaces.
//
// Rule of thumb: each surface's design target is below the cap by
// at least 2.5x. If a tenant hits the cap regularly, the right next
// step is pagination / server-side aggregation, not raising the cap.

/** Max plan items pulled per framework in useCompliancePlanItems.
 *  The Gantt-ish page is designed for ≤ 200 active tiltak; the cap
 *  drops the long tail of historic done/blocked rows. */
export const MAX_PLAN_ITEMS_PER_FRAMEWORK = 500

/** Default row cap on the per-paragraph evidence ledger
 *  (useParagraphEvidence). A 12-month timeline rarely needs more. */
export const DEFAULT_PARAGRAPH_EVIDENCE_LIMIT = 50

/** Default row cap on the per-control evidence ledger
 *  (useControlEvidence) — higher because a control may aggregate
 *  evidence across many paragraphs over years. */
export const DEFAULT_CONTROL_EVIDENCE_LIMIT = 200
