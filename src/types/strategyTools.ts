/* Shared domain types for the Strategy Tools surface (Frameworks · Whiteboard ·
   Assessments). These mirror the JSONB shapes stored in the strategy_tool_*
   and strategy_assessment_* tables and the static framework/assessment
   schemas ported from the "Strategy v2" design package. */

/* ───────────────────────── Frameworks & Whiteboard ───────────────────────── */

export type FwKind =
  | 'swot'
  | 'porter'
  | 's7'
  | 'pestel'
  | 'bcg'
  | 'ansoff'
  | 'bmc'
  | 'vpc'
  | 'whiteboard'

export type ToolStatus = 'draft' | 'example'
export type Rating = 'Low' | 'Medium' | 'High'

/** One section's stored payload. Quad/Porter/PESTEL/BMC/VPC use `items`;
 *  7S uses `text`; Porter adds `rating`; Ansoff adds `risk`. */
export type SectionData = {
  items?: string[]
  text?: string
  rating?: Rating
  risk?: Rating
}

export type WbElementType = 'sticky' | 'text' | 'rect' | 'ellipse'
export type WbElement = {
  id: string
  type: WbElementType
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string | null
}

/** A snapshot stored in `content` either way (framework sections or board elements). */
export type ToolContent = {
  sections?: Record<string, SectionData>
  elements?: WbElement[]
}

export type ToolVersion = {
  id: string
  label: string
  note: string
  by: string // owner/author user id (or denormalised id)
  byName?: string
  ts: string
  count: string // human-readable point count at snapshot time
  content: ToolContent
}

export type ToolAnalysis = {
  id: string
  organizationId: string
  fw: FwKind
  title: string
  owner: string // owner user id
  ownerName?: string
  status: ToolStatus
  created: string // ISO date (yyyy-mm-dd)
  sections: Record<string, SectionData>
  elements?: WbElement[]
  versions: ToolVersion[]
}

/* ───────────────────────────── Assessments ───────────────────────────────── */

export type AssessmentKind = 'maturity' | 'slider' | 'scenario'
export type RunMode = 'self' | 'team'

export type AssessmentDimResult = {
  id: string
  name: string
  color?: string
  value: number
  min?: number
  max?: number
}

export type AssessmentResponse = {
  q: string
  dim?: string
  color?: string
  display: string
  comment?: string
}

export type AssessmentComment = {
  q: string
  dim?: string
  color?: string
  text: string
  pid?: string
}

/** The scored outcome of one run (stored in `result` JSONB). */
export type AssessmentResult = {
  composite: number
  dims: AssessmentDimResult[]
  // scenario extras
  tally?: Record<string, number>
  dominant?: AssessmentDimResult
  blind?: AssessmentDimResult
  // collected detail
  comments?: AssessmentComment[]
  responses?: AssessmentResponse[]
}

export type AssessmentRun = {
  id: string
  organizationId: string
  assessmentId: string
  name: string
  ts: string
  mode: RunMode
  composite: number
  result: AssessmentResult
}

export type RespondentStatus = 'sent' | 'started' | 'done'
export type CampaignRespondent = {
  pid: string // member/user id
  name?: string
  status: RespondentStatus
  result: AssessmentResult | null
  ts: string | null
}

export type AssessmentCampaign = {
  id: string
  organizationId: string
  aid: string // assessment id
  title: string
  owner: string
  ts: string
  due: string
  msg: string
  respondents: CampaignRespondent[]
}

/* ───────────────────────── shared "people" context ─────────────────────────
   Mirrors the design's window.SD.{people,P,fmtDate,months} so the ported view
   components can resolve owner/respondent identities and format dates without
   reaching for a global. Built from the org's members in the page wrapper. */

export type ToolPerson = { id: string; name: string; initials: string; role?: string }

/* ───────────────────────── Strategy v2 — Foundation & pillars ───────────────────────── */

export type StrategyPillar = {
  id: string
  code: string
  name: string
  missionQuestion: string
  color: string
  softColor: string
  position: number
}

export type AmbitionStat = { big: string; unit: string; label: string }
export type FoundationValue = { t: string; b: string }

export type StrategyFoundation = {
  visionText: string
  visionTag: string
  missionTitle: string
  missionBody: string
  ambitionTitle: string
  ambitionStats: AmbitionStat[]
  values: FoundationValue[]
  intentLead: string
}
