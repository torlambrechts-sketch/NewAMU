/* Assessments — diagnostic definitions + transparent scoring.
   Verbatim port of the design package's data_assess.js (IIFE → ES module).
   Four+ research-driven diagnostics with published weights, benchmark
   percentiles and gap metrics. The library is static config; runs / campaigns
   / responses are persisted per-org (see useStrategyAssessments).

   Diagnostics:
     shi      — Strategy Health Index (flagship, team-based maturity)
     fourA    — 4A Execution Diagnostic
     gap      — Strategy–Execution Gap Survey
     adkar    — ADKAR Change Readiness
     oneonone — 1:1 Effectiveness Diagnostic (perception gap)
     kernel   — Strategy Kernel Check (slider lead-magnet, Rumelt)
     coaching — Coaching Style Snapshot (scenario quiz) */

import type {
  AssessmentKind,
  AssessmentResult,
  AssessmentDimResult,
} from '../../types/strategyTools'

export type MaturityItem = { q: string; help?: string }
export type MaturityDim = { id: string; name: string; color: string; items: MaturityItem[] }
export type SliderStep = { id: string; name: string; q: string; lo: string; hi: string }
export type ScenarioOpt = { s: string; t: string }
export type Scenario = { q: string; opts: ScenarioOpt[] }

export type AssessmentDef = {
  id: string
  name: string
  kind: AssessmentKind
  flag: string
  flagLabel: string
  icon: string
  ac: string
  time: string
  desc: string
  framework: string
  multirater?: boolean
  perceptionGap?: boolean
  barrierPoint?: boolean
  quad?: { x: string; y: string; xl: string; yl: string }
  dims?: MaturityDim[]
  weights?: Record<string, number>
  bench?: { n: number; mean: number; spread: number }
  steps?: SliderStep[]
  styles?: Record<string, string>
  scenarios?: Scenario[]
}

// 5-point behaviourally-anchored scale shared by maturity items.
export const BARS = [
  'Not at all true',
  'Rarely true',
  'Somewhat true',
  'Mostly true',
  'Fully true',
]

export const ASSESSMENTS: Record<string, AssessmentDef> = {
  shi: {
    id: 'shi', name: 'Strategy Health Index', kind: 'maturity', flag: 'flag', flagLabel: 'Flagship',
    icon: 'compass', ac: '#1a3d32', time: '8–10 min',
    desc: 'A team-based maturity diagnostic that separates strategy quality from execution readiness — and shows where your leadership team disagrees.',
    framework: 'Kaplan & Norton BSC · McKinsey 7S · Speculand Implementation Compass · Rumelt good/bad strategy',
    multirater: true, quad: { x: 'quality', y: 'readiness', xl: 'Strategy quality', yl: 'Execution readiness' },
    dims: [
      { id: 'quality', name: 'Strategy quality', color: '#2f5d8a', items: [
        { q: 'We can state our strategy in one clear sentence the whole team would recognise.', help: "Clarity — Rumelt's guiding policy." },
        { q: 'Our strategy makes explicit choices about what we will not do.', help: 'Trade-offs — the mark of real strategy.' },
        { q: "Our advantage is genuinely differentiated, not just 'do it better'.", help: 'Differentiation.' },
        { q: 'Our strategy is grounded in evidence about customers and the market.', help: 'Evidence base — diagnosis.' },
      ] },
      { id: 'readiness', name: 'Execution readiness', color: '#b8862f', items: [
        { q: 'The initiatives needed to deliver the strategy are resourced and funded.', help: 'Resourcing.' },
        { q: 'Every strategic objective has one clearly accountable owner.', help: 'Accountability.' },
        { q: 'We review strategic progress on a dependable cadence.', help: 'Cadence.' },
        { q: 'We have the capabilities and skills the strategy requires.', help: 'Capability.' },
      ] },
      { id: 'alignment', name: 'Alignment', color: '#3f7d5a', items: [
        { q: 'The leadership team agrees on the top three priorities for this year.', help: 'Leadership agreement.' },
        { q: 'Strategy is cascaded so teams know how their work connects to it.', help: 'Cascade.' },
        { q: 'We communicate strategy often enough that people remember it.', help: 'Communication.' },
        { q: 'Day-to-day decisions across functions pull in the same direction.', help: 'Coherence.' },
      ] },
    ],
    weights: { quality: 0.4, readiness: 0.4, alignment: 0.2 },
    bench: { n: 1240, mean: 61, spread: 15 },
  },

  oneonone: {
    id: 'oneonone', name: '1:1 Effectiveness Diagnostic', kind: 'maturity', flag: 'flag', flagLabel: 'Flagship',
    icon: 'msgsq', ac: '#a8553a', time: '5–7 min',
    desc: 'Scores the quality, cadence and coaching of your 1:1 practice — the near-empty white space in the market. Reveals the manager-vs-report perception gap.',
    framework: 'Rogelberg on effective 1:1s · GROW / CLEAR coaching · Radical Candor · Gallup engagement',
    multirater: true, perceptionGap: true,
    dims: [
      { id: 'conversation', name: 'Conversation quality', color: '#2f5d8a', items: [
        { q: 'My direct reports drive the agenda of our 1:1s.', help: 'Employee-driven agenda (Rogelberg).' },
        { q: 'Our 1:1s go beyond status updates to what really matters.', help: 'Depth.' },
        { q: 'People feel safe raising problems and disagreement with me.', help: 'Psychological safety.' },
        { q: 'I listen more than I talk in these conversations.', help: 'Listening ratio.' },
      ] },
      { id: 'cadence', name: 'Cadence health', color: '#3f7d5a', items: [
        { q: '1:1s happen on a consistent, predictable schedule.', help: 'Consistency.' },
        { q: 'I rarely cancel or postpone a 1:1.', help: 'Cancellation rate.' },
        { q: 'Each 1:1 has enough time to be meaningful.', help: 'Duration.' },
        { q: "We meet at a frequency that fits each person's needs.", help: 'Frequency fit.' },
      ] },
      { id: 'coaching', name: 'Coaching effectiveness', color: '#b8862f', items: [
        { q: 'I ask questions more often than I give directives.', help: 'Questions vs. directives.' },
        { q: 'Action items from 1:1s are followed through to completion.', help: 'Follow-through.' },
        { q: 'We regularly discuss growth and career, not just tasks.', help: 'Growth coverage.' },
        { q: 'My reports leave 1:1s clearer and more motivated.', help: 'Outcome.' },
      ] },
    ],
    weights: { conversation: 0.4, cadence: 0.25, coaching: 0.35 },
    bench: { n: 980, mean: 58, spread: 16 },
  },

  fourA: {
    id: 'fourA', name: '4A Execution Diagnostic', kind: 'maturity', flag: 'flag', flagLabel: 'Execution',
    icon: 'grid', ac: '#2f5d8a', time: '6–8 min',
    desc: 'Scores the four levers that turn strategy into results — Alignment, Ability, Architecture and Agility — and where they break down.',
    framework: 'Sull, Homkes & Sull — the 4A model of strategy execution (HBR)',
    multirater: true,
    dims: [
      { id: 'alignment', name: 'Alignment', color: '#2f5d8a', items: [
        { q: "People across units can name the company's top priorities.", help: 'Shared priorities.' },
        { q: 'Commitments between teams are made explicit and tracked.', help: 'Cross-unit commitments — the real execution glue.' },
        { q: 'When priorities conflict, we resolve them quickly and visibly.', help: 'Conflict resolution.' },
        { q: 'Individual goals are clearly linked to the strategy.', help: 'Goal linkage.' },
      ] },
      { id: 'ability', name: 'Ability', color: '#3f7d5a', items: [
        { q: 'We have the skills and talent the strategy demands.', help: 'Capability.' },
        { q: 'High performers are deployed against the most important work.', help: 'Talent allocation.' },
        { q: 'We develop people fast enough to keep up with the plan.', help: 'Development pace.' },
        { q: 'Underperformance is addressed rather than tolerated.', help: 'Performance management.' },
      ] },
      { id: 'architecture', name: 'Architecture', color: '#b8862f', items: [
        { q: 'Our structure and processes support how strategy actually flows.', help: 'Operating model fit.' },
        { q: 'Information needed to execute reaches the right people on time.', help: 'Information flow.' },
        { q: 'Decision rights are clear — people know who decides what.', help: 'Decision rights.' },
        { q: 'Incentives reward delivering the strategy, not just activity.', help: 'Incentive alignment.' },
      ] },
      { id: 'agility', name: 'Agility', color: '#a8553a', items: [
        { q: 'We reallocate resources to new priorities without long delays.', help: 'Resource fluidity — the #1 execution gap (Sull).' },
        { q: 'We adapt the plan quickly when conditions change.', help: 'Adaptiveness.' },
        { q: 'We stop or kill initiatives that are no longer working.', help: 'Stopping power.' },
        { q: 'We learn from execution and feed it back into strategy.', help: 'Learning loop.' },
      ] },
    ],
    weights: { alignment: 0.3, ability: 0.25, architecture: 0.2, agility: 0.25 },
    bench: { n: 870, mean: 57, spread: 16 },
  },

  gap: {
    id: 'gap', name: 'Strategy–Execution Gap Survey', kind: 'maturity', flag: 'flag', flagLabel: 'Diagnostic',
    icon: 'activity', ac: '#b8862f', time: '5–7 min',
    desc: "A quick pulse on the gap between the strategy on paper and what's actually happening — across clarity, capacity, commitment and follow-through.",
    framework: 'Strategy-execution gap research (Kaplan & Norton; Sull) · quick-survey format',
    multirater: true,
    dims: [
      { id: 'clarity', name: 'Clarity', color: '#2f5d8a', items: [
        { q: 'I clearly understand our strategy and what it asks of me.', help: 'Personal clarity.' },
        { q: 'The strategy is specific enough to guide my daily decisions.', help: 'Actionability.' },
        { q: 'I know how my work contributes to the strategy.', help: 'Line of sight.' },
      ] },
      { id: 'capacity', name: 'Capacity', color: '#3f7d5a', items: [
        { q: 'We have the time and resources to execute, not just plan.', help: 'Bandwidth.' },
        { q: "We aren't trying to do too many things at once.", help: 'Focus / overload.' },
        { q: "Strategic work isn't constantly crowded out by the urgent.", help: 'Protection of strategic time.' },
      ] },
      { id: 'commitment', name: 'Commitment', color: '#b8862f', items: [
        { q: 'Leaders visibly back the strategy with their own behaviour.', help: 'Leadership modelling.' },
        { q: 'People feel genuine ownership of the strategy, not just compliance.', help: 'Ownership.' },
        { q: "There's energy and belief behind the plan.", help: 'Engagement.' },
      ] },
      { id: 'followthrough', name: 'Follow-through', color: '#a8553a', items: [
        { q: 'We do what we said we would in our strategy reviews.', help: 'Say-do ratio.' },
        { q: 'Progress is tracked and people are held accountable.', help: 'Accountability.' },
        { q: 'We close the loop — decisions lead to action and results.', help: 'Closure.' },
      ] },
    ],
    weights: { clarity: 0.25, capacity: 0.25, commitment: 0.25, followthrough: 0.25 },
    bench: { n: 1520, mean: 55, spread: 17 },
  },

  adkar: {
    id: 'adkar', name: 'ADKAR Change Readiness', kind: 'maturity', flag: 'flag', flagLabel: 'Change',
    icon: 'repeat', ac: '#a8553a', time: '6–8 min',
    desc: 'Assesses readiness for a strategic change across the five ADKAR stages — and pinpoints the single barrier point to focus on.',
    framework: 'Prosci ADKAR — Awareness · Desire · Knowledge · Ability · Reinforcement',
    multirater: true, barrierPoint: true,
    dims: [
      { id: 'awareness', name: 'Awareness', color: '#2f5d8a', items: [
        { q: 'People understand why this strategic change is needed.', help: 'The case for change.' },
        { q: 'The risk of not changing has been made clear.', help: 'Cost of inaction.' },
        { q: 'Leaders have communicated a compelling reason for the change.', help: 'Communication.' },
      ] },
      { id: 'desire', name: 'Desire', color: '#3f7d5a', items: [
        { q: 'People genuinely want this change to succeed.', help: 'Motivation.' },
        { q: "What's in it for individuals has been addressed.", help: 'WIIFM.' },
        { q: 'Resistance is being surfaced and worked through, not ignored.', help: 'Resistance management.' },
      ] },
      { id: 'knowledge', name: 'Knowledge', color: '#b8862f', items: [
        { q: 'People know how to change — the new behaviours and skills.', help: 'Know-how.' },
        { q: 'Training and guidance are available where needed.', help: 'Enablement.' },
        { q: 'People understand the new processes and tools.', help: 'Process knowledge.' },
      ] },
      { id: 'ability', name: 'Ability', color: '#a8553a', items: [
        { q: 'People can actually apply the change in their daily work.', help: 'Applied capability.' },
        { q: "Barriers and old habits aren't blocking the new way.", help: 'Barrier removal.' },
        { q: 'People have time and support to practise the change.', help: 'Practice support.' },
      ] },
      { id: 'reinforcement', name: 'Reinforcement', color: '#6b21a8', items: [
        { q: 'The change is reinforced so it sticks rather than fades.', help: 'Sustainment.' },
        { q: 'Wins are celebrated and progress is recognised.', help: 'Recognition.' },
        { q: 'Metrics and incentives keep the new way in place.', help: 'Mechanisms.' },
      ] },
    ],
    weights: { awareness: 0.2, desire: 0.2, knowledge: 0.2, ability: 0.2, reinforcement: 0.2 },
    bench: { n: 640, mean: 56, spread: 16 },
  },

  kernel: {
    id: 'kernel', name: 'Strategy Kernel Check', kind: 'slider', flag: 'lead', flagLabel: 'Quick · no email',
    icon: 'target', ac: '#2f5d8a', time: '3 min',
    desc: 'A seven-slider gut-check on the kernel of your strategy. Get a kernel score, your single weakest element, and one fix.',
    framework: 'Richard Rumelt — The Kernel: diagnosis · guiding policy · coherent action',
    steps: [
      { id: 'diagnosis', name: 'Diagnosis', q: 'How well do you understand the real challenge you face?', lo: 'Vague', hi: 'Crystal clear' },
      { id: 'policy', name: 'Guiding policy', q: 'How clear is your overall approach to overcoming it?', lo: 'Undefined', hi: 'Sharp' },
      { id: 'action', name: 'Coherent action', q: 'How coordinated are the actions delivering on that approach?', lo: 'Scattered', hi: 'Tightly coordinated' },
      { id: 'focus', name: 'Focus', q: 'How focused are your resources on the few things that matter?', lo: 'Spread thin', hi: 'Concentrated' },
      { id: 'tradeoff', name: 'Trade-offs', q: 'How explicit are your choices about what NOT to do?', lo: 'None', hi: 'Explicit' },
      { id: 'evidence', name: 'Evidence', q: 'How grounded is the strategy in real market evidence?', lo: 'Assumptions', hi: 'Well-evidenced' },
      { id: 'feasible', name: 'Feasibility', q: 'How realistic is delivery given your resources?', lo: 'A stretch', hi: 'Very doable' },
    ],
    bench: { n: 3100, mean: 58, spread: 17 },
  },

  coaching: {
    id: 'coaching', name: 'Coaching Style Snapshot', kind: 'scenario', flag: 'lead', flagLabel: 'Quick · no email',
    icon: 'users', ac: '#3f7d5a', time: '4 min',
    desc: "Ten everyday situations reveal your dominant leadership style — and the blind spot that's holding your team back.",
    framework: 'Situational Leadership (Hersey-Blanchard) · GROW coaching',
    styles: { tell: 'Directing', sell: 'Coaching-by-persuasion', coach: 'Coaching', delegate: 'Delegating' },
    scenarios: [
      { q: 'A capable report is stuck on a problem they could solve.', opts: [
        { s: 'tell', t: 'Tell them exactly what to do.' }, { s: 'sell', t: 'Explain your preferred solution and why.' },
        { s: 'coach', t: 'Ask questions that help them find the answer.' }, { s: 'delegate', t: 'Trust them to work it out and check in later.' } ] },
      { q: 'A new hire is unsure how to start their first big task.', opts: [
        { s: 'tell', t: 'Give step-by-step instructions.' }, { s: 'coach', t: "Ask how they'd approach it, then guide." },
        { s: 'sell', t: "Walk through how you'd do it and why." }, { s: 'delegate', t: 'Let them figure it out themselves.' } ] },
      { q: 'Your team disagrees on a direction.', opts: [
        { s: 'tell', t: 'Make the call and move on.' }, { s: 'coach', t: 'Facilitate until they align.' },
        { s: 'sell', t: 'Argue for the option you favour.' }, { s: 'delegate', t: 'Let the team decide without you.' } ] },
      { q: 'A high performer wants more responsibility.', opts: [
        { s: 'delegate', t: 'Hand them a meaningful project to own.' }, { s: 'coach', t: 'Explore what growth they want.' },
        { s: 'sell', t: "Pitch them a stretch role you've picked." }, { s: 'tell', t: 'Assign specific new duties.' } ] },
      { q: 'An action item from your last 1:1 slipped.', opts: [
        { s: 'coach', t: 'Ask what got in the way.' }, { s: 'tell', t: 'Restate the deadline firmly.' },
        { s: 'sell', t: 'Re-explain why it matters.' }, { s: 'delegate', t: "Trust they'll catch up." } ] },
      { q: 'A report brings you a half-formed idea.', opts: [
        { s: 'coach', t: 'Ask questions to develop it together.' }, { s: 'sell', t: "Suggest how you'd improve it." },
        { s: 'delegate', t: 'Tell them to run with it.' }, { s: 'tell', t: "Point out what won't work." } ] },
      { q: 'Performance has dipped on a routine task.', opts: [
        { s: 'tell', t: 'Set a clear corrective expectation.' }, { s: 'coach', t: "Ask what's changed for them." },
        { s: 'sell', t: 'Remind them of the standard and why.' }, { s: 'delegate', t: 'Give space to self-correct.' } ] },
      { q: 'A report is ready for a decision you usually make.', opts: [
        { s: 'delegate', t: 'Let them make the call.' }, { s: 'coach', t: 'Talk through their reasoning first.' },
        { s: 'sell', t: "Share how you'd decide." }, { s: 'tell', t: 'Make it this time, hand over next.' } ] },
      { q: 'Someone is anxious about a big presentation.', opts: [
        { s: 'coach', t: 'Ask what would help them feel ready.' }, { s: 'sell', t: 'Share tips that worked for you.' },
        { s: 'tell', t: 'Give them a structure to follow.' }, { s: 'delegate', t: 'Reassure them and step back.' } ] },
      { q: 'A project needs a quick, low-stakes choice.', opts: [
        { s: 'delegate', t: "Let whoever's closest decide." }, { s: 'tell', t: 'Decide quickly yourself.' },
        { s: 'coach', t: 'Ask the team for a fast read.' }, { s: 'sell', t: 'Recommend and confirm.' } ] },
    ],
  },
}

export const ASSESSMENT_ORDER = ['shi', 'fourA', 'gap', 'adkar', 'oneonone', 'kernel', 'coaching']
export const ASSESSMENT_GROUPS = [
  { label: 'Strategy diagnostics', ids: ['shi', 'fourA', 'gap'] },
  { label: 'Change & readiness', ids: ['adkar'] },
  { label: 'Leadership & 1:1 diagnostics', ids: ['oneonone', 'coaching'] },
  { label: 'Quick checks', ids: ['kernel'] },
]

/* ───────────────────────── scoring helpers ───────────────────────── */

export function scaleTo100(avg1to5: number): number {
  return Math.round(((avg1to5 - 1) / 4) * 100)
}
export function percentile(score: number, bench: { mean: number; spread: number }): number {
  const z = (score - bench.mean) / bench.spread
  const p = 1 / (1 + Math.exp(-1.6 * z))
  return Math.max(1, Math.min(99, Math.round(p * 100)))
}
export function band(score: number): { label: string; cls: string; color: string } {
  if (score >= 75) return { label: 'Strong', cls: 'badge--success', color: '#2f7757' }
  if (score >= 55) return { label: 'Developing', cls: 'badge--info', color: '#2f5d8a' }
  if (score >= 35) return { label: 'At risk', cls: 'badge--warn', color: '#b8862f' }
  return { label: 'Critical', cls: 'badge--danger', color: '#b3382a' }
}

function scoreMaturity(a: AssessmentDef, answers: Record<string, number>): AssessmentResult {
  const dims: AssessmentDimResult[] = (a.dims || []).map((d) => {
    const vals = d.items.map((_, i) => answers[d.id + ':' + i] || 0).filter((v) => v > 0)
    const avg = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0
    return { id: d.id, name: d.name, color: d.color, value: scaleTo100(avg || 1) }
  })
  const composite = Math.round(dims.reduce((s, d) => s + d.value * ((a.weights || {})[d.id] || 0), 0))
  return { dims, composite }
}
function scoreSlider(a: AssessmentDef, answers: Record<string, number>): AssessmentResult {
  const dims: AssessmentDimResult[] = (a.steps || []).map((s) => ({
    id: s.id, name: s.name, value: Math.round(answers[s.id] != null ? answers[s.id] : 50),
  }))
  const composite = Math.round(dims.reduce((x, d) => x + d.value, 0) / dims.length)
  return { dims, composite }
}
function scoreScenario(a: AssessmentDef, answers: Record<string, string>): AssessmentResult {
  const tally: Record<string, number> = { tell: 0, sell: 0, coach: 0, delegate: 0 }
  Object.values(answers).forEach((s) => { if (tally[s] != null) tally[s]++ })
  const total = Object.values(tally).reduce((x, y) => x + y, 0) || 1
  const dims: AssessmentDimResult[] = Object.keys(tally).map((k) => ({
    id: k, name: (a.styles || {})[k], value: Math.round((tally[k] / total) * 100),
  }))
  const dominant = dims.slice().sort((x, y) => y.value - x.value)[0]
  const blind = dims.slice().sort((x, y) => x.value - y.value)[0]
  return { dims, tally, dominant, blind, composite: dominant.value }
}
export function scoreRun(a: AssessmentDef, answers: Record<string, number | string>): AssessmentResult {
  if (a.kind === 'slider') return scoreSlider(a, answers as Record<string, number>)
  if (a.kind === 'scenario') return scoreScenario(a, answers as Record<string, string>)
  return scoreMaturity(a, answers as Record<string, number>)
}
export function syntheticGap(a: AssessmentDef, result: AssessmentResult): number {
  const delta = a.id === 'oneonone' ? -12 : -9
  return Math.max(0, result.composite + delta)
}
