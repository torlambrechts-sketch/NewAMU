/* Strategy frameworks — schemas, tool metadata, templates and content helpers.
   Verbatim port of the schema/template/helper layer from the design package's
   views_frameworks.jsx. The schemas drive the section-by-section editors
   (SWOT · Porter · 7S · PESTEL · BCG · Ansoff · BMC · VPC) and the whiteboard
   templates seed the freeform canvas. Persistence lives in
   useStrategyToolAnalyses; this module is pure config + pure functions. */

import type { FwKind, Rating, SectionData, ToolContent, WbElement } from '../../types/strategyTools'

export type FwSectionField = 'list' | 'text'
export type FwSection = {
  id: string
  title: string
  field: FwSectionField
  prompt?: string
  hint?: string
  // quad (SWOT / BCG / Ansoff)
  cap?: string
  sub?: string
  cls?: string
  icon?: string
  hasRisk?: boolean
  defaultRisk?: Rating
  hasRating?: boolean
  // porter
  pos?: string
  center?: boolean
  // 7s
  kind7?: 'hard' | 'soft' | 'core'
  // pestel
  color?: string
  // canvas
  ac?: string
  side?: 'map' | 'profile'
}
export type FwSchemaKind = 'quad' | 'porter' | 's7' | 'pestel' | 'canvas'
export type FwSchema = {
  name: string
  ac: string
  kind: FwSchemaKind
  canvasKind?: 'bmc' | 'vpc'
  wide?: boolean
  intro: string
  axes?: { y?: string; topL?: string; topR?: string; bottom?: string }
  sections: FwSection[]
}

export const FW_SCHEMA: Record<string, FwSchema> = {
  swot: {
    name: 'SWOT', ac: '#3f7d5a', kind: 'quad',
    intro: 'Internal strengths & weaknesses vs. external opportunities & threats.',
    axes: { y: 'Internal  ·  External', topL: 'Helpful', topR: 'Harmful' },
    sections: [
      { id: 's', title: 'Strengths', cap: 'Internal · Helpful', cls: 'q-green', icon: 'award', field: 'list',
        prompt: 'What does Pundit do well that it controls?', hint: 'Capabilities, assets, brand, talent, financial position.' },
      { id: 'w', title: 'Weaknesses', cap: 'Internal · Harmful', cls: 'q-amber', icon: 'alert', field: 'list',
        prompt: 'Where is Pundit weak or behind?', hint: 'Gaps in capability, cost, technology or coverage.' },
      { id: 'o', title: 'Opportunities', cap: 'External · Helpful', cls: 'q-blue', icon: 'trend', field: 'list',
        prompt: 'What external openings could Pundit capture?', hint: 'Market shifts, demand, new segments, technology.' },
      { id: 't', title: 'Threats', cap: 'External · Harmful', cls: 'q-rust', icon: 'flag', field: 'list',
        prompt: 'What external forces could hurt Pundit?', hint: 'Competition, regulation, substitution, talent market.' },
    ],
  },
  porter: {
    name: "Porter's Five Forces", ac: '#1a3d32', kind: 'porter',
    intro: 'The structural attractiveness of the market.',
    sections: [
      { id: 'ne', title: 'Threat of new entrants', pos: 'pos-tc', icon: 'user', field: 'list', hasRating: true,
        prompt: 'How easily can new players enter?', hint: 'Capital, licensing, brand and trust barriers.' },
      { id: 'sp', title: 'Supplier power', pos: 'pos-ml', icon: 'brief', field: 'list', hasRating: true,
        prompt: 'How much leverage do suppliers hold?', hint: 'Data/tech vendors, custody partners, talent.' },
      { id: 'cr', title: 'Competitive rivalry', pos: 'pos-c', center: true, icon: 'target', field: 'list', hasRating: true,
        prompt: 'How intense is competition today?', hint: 'Number of rivals, growth rate, fee pressure.' },
      { id: 'bp', title: 'Buyer power', pos: 'pos-mr', icon: 'users', field: 'list', hasRating: true,
        prompt: 'How much power do clients have?', hint: 'Price sensitivity, switching cost, concentration.' },
      { id: 'sub', title: 'Threat of substitutes', pos: 'pos-bc', icon: 'repeat', field: 'list', hasRating: true,
        prompt: 'What could clients use instead?', hint: 'Passive products, robo-advice, self-direction.' },
    ],
  },
  s7: {
    name: 'McKinsey 7S', ac: '#2f5d8a', kind: 's7',
    intro: 'Seven interdependent elements that must align.',
    sections: [
      { id: 'strategy', title: 'Strategy', kind7: 'hard', field: 'text', prompt: 'What is the plan to win?', hint: 'Direction, priorities, competitive approach.' },
      { id: 'structure', title: 'Structure', kind7: 'hard', field: 'text', prompt: 'How is the organisation arranged?', hint: 'Reporting lines, teams, locations.' },
      { id: 'systems', title: 'Systems', kind7: 'hard', field: 'text', prompt: 'What are the core processes & tools?', hint: 'Platforms, workflows, data.' },
      { id: 'values', title: 'Shared values', kind7: 'core', field: 'text', prompt: 'What does the company believe?', hint: 'The cultural centre everything orbits.' },
      { id: 'skills', title: 'Skills', kind7: 'soft', field: 'text', prompt: 'What is the company good at?', hint: 'Distinctive capabilities and competencies.' },
      { id: 'style', title: 'Style', kind7: 'soft', field: 'text', prompt: 'How does leadership behave?', hint: 'Management & decision-making style.' },
      { id: 'staff', title: 'Staff', kind7: 'soft', field: 'text', prompt: 'Who are the people?', hint: 'Headcount, roles, development.' },
    ],
  },
  pestel: {
    name: 'PESTEL', ac: '#a8553a', kind: 'pestel',
    intro: 'A macro-environmental scan across six lenses.',
    sections: [
      { id: 'p', title: 'Political', sub: 'Government & policy', color: '#2f5d8a', icon: 'building', field: 'list', prompt: 'Which political / policy factors matter?', hint: 'Regulation stability, government priorities.' },
      { id: 'e', title: 'Economic', sub: 'Macro conditions', color: '#3f7d5a', icon: 'trend', field: 'list', prompt: 'Which economic factors matter?', hint: 'Rates, growth, inflation, markets.' },
      { id: 's', title: 'Social', sub: 'Society & demographics', color: '#b8862f', icon: 'users', field: 'list', prompt: 'Which social factors matter?', hint: 'Demographics, values, behaviour.' },
      { id: 't', title: 'Technological', sub: 'Tech & innovation', color: '#a8553a', icon: 'bars', field: 'list', prompt: 'Which technology factors matter?', hint: 'AI, automation, data access.' },
      { id: 'en', title: 'Environmental', sub: 'Sustainability', color: '#2f7757', icon: 'globe', field: 'list', prompt: 'Which environmental factors matter?', hint: 'ESG demand, climate disclosure.' },
      { id: 'l', title: 'Legal', sub: 'Law & compliance', color: '#525252', icon: 'clip', field: 'list', prompt: 'Which legal factors matter?', hint: 'MiFID, DORA, AML, GDPR.' },
    ],
  },
  bcg: {
    name: 'BCG Matrix', ac: '#b8862f', kind: 'quad',
    intro: 'Portfolio by market growth and relative share.',
    axes: { y: 'Market growth  ·  High → Low', bottom: 'Relative market share  ·  High → Low' },
    sections: [
      { id: 'star', title: '★ Stars', cap: 'High growth · High share', sub: 'Invest to lead', cls: 'q-green', field: 'list', prompt: 'High-growth, high-share businesses?', hint: 'Where you lead a fast-growing market.' },
      { id: 'qm', title: '? Question marks', cap: 'High growth · Low share', sub: 'Back selectively', cls: 'q-blue', field: 'list', prompt: 'High-growth, low-share bets?', hint: 'Promising but unproven — fund or fold.' },
      { id: 'cow', title: '$ Cash cows', cap: 'Low growth · High share', sub: 'Harvest to fund growth', cls: 'q-amber', field: 'list', prompt: 'Low-growth, high-share earners?', hint: 'Mature lines that throw off cash.' },
      { id: 'dog', title: '● Dogs', cap: 'Low growth · Low share', sub: 'Divest or retire', cls: 'q-rust', field: 'list', prompt: 'Low-growth, low-share drags?', hint: 'Candidates to retire or divest.' },
    ],
  },
  ansoff: {
    name: 'Ansoff Matrix', ac: '#1a3d32', kind: 'quad',
    intro: 'Growth options by product and market.',
    axes: { y: 'Markets  ·  Existing → New', bottom: 'Products  ·  Existing → New' },
    sections: [
      { id: 'pen', title: 'Market penetration', cls: 'q-green', field: 'list', hasRisk: true, defaultRisk: 'Low', prompt: 'Grow with existing products in existing markets?', hint: 'Deeper wallet share, cross-sell, retention.' },
      { id: 'prod', title: 'Product development', cls: 'q-amber', field: 'list', hasRisk: true, defaultRisk: 'Medium', prompt: 'New products for existing markets?', hint: "New tiers, funds, features for today's clients." },
      { id: 'mkt', title: 'Market development', cls: 'q-blue', field: 'list', hasRisk: true, defaultRisk: 'Medium', prompt: 'Existing products in new markets?', hint: 'New geographies or segments.' },
      { id: 'div', title: 'Diversification', cls: 'q-rust', field: 'list', hasRisk: true, defaultRisk: 'High', prompt: 'New products in new markets?', hint: 'The boldest, riskiest growth bets.' },
    ],
  },
  bmc: {
    name: 'Business Model Canvas', ac: '#1a3d32', kind: 'canvas', canvasKind: 'bmc', wide: true,
    intro: 'Nine building blocks that describe how the business creates, delivers and captures value.',
    sections: [
      { id: 'segments', title: 'Customer segments', pos: 'bmc-segments', icon: 'users', ac: '#3f7d5a', field: 'list',
        prompt: 'Who are the most important customers?', hint: 'The distinct groups of people or organisations you serve.' },
      { id: 'value', title: 'Value propositions', pos: 'bmc-value', icon: 'award', ac: '#1a3d32', field: 'list', center: true,
        prompt: 'What value do you deliver to each segment?', hint: 'The bundle of products and services that solves a problem or meets a need.' },
      { id: 'channels', title: 'Channels', pos: 'bmc-channels', icon: 'share', ac: '#2f5d8a', field: 'list',
        prompt: 'How do you reach and deliver to customers?', hint: 'Communication, distribution and sales touchpoints.' },
      { id: 'relations', title: 'Customer relationships', pos: 'bmc-relations', icon: 'msgsq', ac: '#2f5d8a', field: 'list',
        prompt: 'What relationship does each segment expect?', hint: 'Personal, self-serve, automated, communities.' },
      { id: 'revenue', title: 'Revenue streams', pos: 'bmc-revenue', icon: 'trend', ac: '#b8862f', field: 'list',
        prompt: 'What are customers willing to pay for, and how?', hint: 'Fees, subscriptions, usage, performance — pricing mechanisms.' },
      { id: 'resources', title: 'Key resources', pos: 'bmc-resources', icon: 'grid', ac: '#a8553a', field: 'list',
        prompt: 'What assets does the model require?', hint: 'People, technology, capital, licences, brand.' },
      { id: 'activities', title: 'Key activities', pos: 'bmc-activities', icon: 'bars', ac: '#a8553a', field: 'list',
        prompt: 'What must you do well to deliver the value?', hint: 'Production, problem-solving, platform/network.' },
      { id: 'partners', title: 'Key partners', pos: 'bmc-partners', icon: 'branch', ac: '#6b21a8', field: 'list',
        prompt: 'Who are your key partners and suppliers?', hint: 'Alliances that reduce risk, supply resources, or perform activities.' },
      { id: 'costs', title: 'Cost structure', pos: 'bmc-costs', icon: 'brief', ac: '#b3382a', field: 'list',
        prompt: 'What are the most important costs?', hint: 'The biggest cost drivers — fixed, variable, economies of scale.' },
    ],
  },
  vpc: {
    name: 'Value Proposition Canvas', ac: '#3f7d5a', kind: 'canvas', canvasKind: 'vpc',
    intro: 'Achieve fit between what customers want and what your value map offers.',
    sections: [
      { id: 'products', title: 'Products & services', side: 'map', color: '#1a3d32', field: 'list',
        prompt: 'What do you offer the customer?', hint: 'The list of products and services your value proposition is built on.' },
      { id: 'relievers', title: 'Pain relievers', side: 'map', color: '#2f5d8a', field: 'list',
        prompt: 'How do you ease customer pains?', hint: 'How your offer removes or reduces things customers find annoying or risky.' },
      { id: 'gaincreators', title: 'Gain creators', side: 'map', color: '#3f7d5a', field: 'list',
        prompt: 'How do you create customer gains?', hint: 'How your offer produces outcomes and benefits the customer wants.' },
      { id: 'jobs', title: 'Customer jobs', side: 'profile', color: '#b8862f', field: 'list',
        prompt: 'What jobs is the customer trying to get done?', hint: 'Functional, social and emotional tasks they\'re trying to complete.' },
      { id: 'pains', title: 'Pains', side: 'profile', color: '#b3382a', field: 'list',
        prompt: 'What pains does the customer experience?', hint: 'Bad outcomes, risks and obstacles around the jobs.' },
      { id: 'gains', title: 'Gains', side: 'profile', color: '#a8553a', field: 'list',
        prompt: 'What gains does the customer want?', hint: 'Required, expected, desired and unexpected outcomes and benefits.' },
    ],
  },
}

export const FW_ORDER = ['swot', 'porter', 's7', 'pestel', 'bcg', 'ansoff', 'bmc', 'vpc']

export type ToolMeta = { name: string; ac: string; kind: string; intro: string }
export const TOOL_META: Record<string, ToolMeta> = {
  whiteboard: {
    name: 'Whiteboard', ac: '#2f5d8a', kind: 'whiteboard',
    intro: 'A freeform canvas to sketch, cluster sticky notes and map ideas visually.',
  },
}
export function toolMeta(id: string): ToolMeta {
  const s = FW_SCHEMA[id]
  if (s) return { name: s.name, ac: s.ac, kind: s.kind, intro: s.intro }
  return TOOL_META[id]
}
export const TOOL_GROUPS = [
  { label: 'Analysis frameworks', ids: ['swot', 'porter', 'pestel', 's7', 'bcg', 'ansoff'] },
  { label: 'Business canvases', ids: ['bmc', 'vpc'] },
  { label: 'Freeform', ids: ['whiteboard'] },
]

/* ───────────────────────── templates ───────────────────────── */

export type ToolTemplate = {
  id: string
  name: string
  desc: string
  sections?: Record<string, SectionData>
  elements?: WbElement[]
}

export const TEMPLATES: Record<string, ToolTemplate[]> = {
  swot: [
    { id: 'swot-blank', name: 'Blank SWOT', desc: 'Four empty quadrants to fill yourself.' },
    { id: 'swot-startup', name: 'Startup SWOT', desc: 'Prompts tuned for an early-stage company.', sections: {
      s: { items: ['Founder expertise', 'Lean cost base', 'Speed to ship'] }, w: { items: ['Limited runway', 'No brand yet', 'Key-person risk'] },
      o: { items: ['Underserved niche', 'New channel', 'Partnership'] }, t: { items: ['Incumbent response', 'Funding climate', 'Regulation'] } } },
    { id: 'swot-product', name: 'Product launch SWOT', desc: 'For assessing a specific launch.', sections: {
      s: { items: ['Differentiated feature', 'Existing customer base'] }, w: { items: ['Unproven onboarding', 'Support capacity'] },
      o: { items: ['Cross-sell to base', 'Category tailwind'] }, t: { items: ['Fast follower', 'Price pressure'] } } },
  ],
  porter: [
    { id: 'porter-blank', name: 'Blank Five Forces', desc: 'Rate each force from scratch.' },
    { id: 'porter-saas', name: 'SaaS market', desc: 'Typical software-market starting ratings.', sections: {
      ne: { rating: 'High', items: ['Low capital barriers', 'Open-source alternatives'] }, sp: { rating: 'Low', items: ['Cloud is commoditised'] },
      cr: { rating: 'High', items: ['Crowded category', 'Feature parity'] }, bp: { rating: 'Medium', items: ['Easy switching', 'Procurement leverage'] },
      sub: { rating: 'Medium', items: ['Build-in-house', 'Spreadsheets'] } } },
  ],
  pestel: [
    { id: 'pestel-blank', name: 'Blank PESTEL', desc: 'Six empty macro lenses.' },
    { id: 'pestel-expansion', name: 'Market-entry scan', desc: 'Prompts for entering a new geography.', sections: {
      p: { items: ['Trade & tariff regime', 'Local licensing'] }, e: { items: ['Currency risk', 'Local demand'] }, s: { items: ['Cultural fit', 'Language'] },
      t: { items: ['Infrastructure', 'Local platforms'] }, en: { items: ['Local ESG rules'] }, l: { items: ['Employment law', 'Data residency'] } } },
  ],
  s7: [
    { id: 's7-blank', name: 'Blank 7S', desc: 'Seven empty elements to align.' },
    { id: 's7-change', name: 'Change-readiness 7S', desc: 'Diagnose alignment before a transformation.', sections: {
      strategy: { text: 'Stated direction for the change.' }, structure: { text: 'Will the org chart support it?' }, systems: { text: 'Which processes must change?' },
      values: { text: 'Does the culture back this?' }, skills: { text: 'What capability gap exists?' }, style: { text: 'How will leaders model it?' }, staff: { text: 'Who drives and who resists?' } } },
  ],
  bcg: [
    { id: 'bcg-blank', name: 'Blank BCG', desc: 'Place lines of business yourself.' },
    { id: 'bcg-portfolio', name: 'Product portfolio', desc: 'Starter prompts for a product company.', sections: {
      star: { items: ['Flagship growth product'] }, qm: { items: ['New bet still proving out'] }, cow: { items: ['Mature cash generator'] }, dog: { items: ['Legacy line to sunset'] } } },
  ],
  ansoff: [
    { id: 'ansoff-blank', name: 'Blank Ansoff', desc: 'Four growth routes to fill.' },
    { id: 'ansoff-growth', name: 'Growth planning', desc: 'Prompts ranked by risk.', sections: {
      pen: { risk: 'Low', items: ['Upsell existing customers', 'Improve retention'] }, prod: { risk: 'Medium', items: ['Adjacent product', 'New tier'] },
      mkt: { risk: 'Medium', items: ['New segment', 'New geography'] }, div: { risk: 'High', items: ['New product + new market bet'] } } },
  ],
  bmc: [
    { id: 'bmc-blank', name: 'Blank canvas', desc: 'Nine empty building blocks.' },
    { id: 'bmc-saas', name: 'SaaS business', desc: 'Starter blocks for a subscription product.', sections: {
      segments: { items: ['SMB teams', 'Enterprise'] }, value: { items: ['Save time', 'One source of truth'] }, channels: { items: ['Self-serve signup', 'Sales-assisted'] },
      relations: { items: ['Self-serve + success team'] }, revenue: { items: ['Per-seat subscription', 'Annual contracts'] }, resources: { items: ['Product & eng', 'Cloud platform'] },
      activities: { items: ['Product development', 'Customer success'] }, partners: { items: ['Cloud provider', 'Integrations'] }, costs: { items: ['Engineering', 'Cloud', 'Go-to-market'] } } },
    { id: 'bmc-marketplace', name: 'Marketplace', desc: 'Two-sided marketplace starting points.', sections: {
      segments: { items: ['Supply side', 'Demand side'] }, value: { items: ['Liquidity', 'Trust & safety'] }, channels: { items: ['SEO', 'Referral loops'] },
      relations: { items: ['Community', 'Automated matching'] }, revenue: { items: ['Take rate', 'Listing fees'] }, resources: { items: ['Network', 'Platform'] },
      activities: { items: ['Matching', 'Trust & safety'] }, partners: { items: ['Payment provider'] }, costs: { items: ['Acquisition both sides', 'Operations'] } } },
  ],
  vpc: [
    { id: 'vpc-blank', name: 'Blank canvas', desc: 'Value map and customer profile, empty.' },
    { id: 'vpc-starter', name: 'Starter prompts', desc: 'Guiding prompts in each block.', sections: {
      products: { items: ['List your products & services'] }, relievers: { items: ['How you remove a pain'] }, gaincreators: { items: ['How you create a gain'] },
      jobs: { items: ['A job the customer must do'] }, pains: { items: ['A pain they feel'] }, gains: { items: ['A gain they want'] } } },
  ],
  whiteboard: [
    { id: 'wb-blank', name: 'Blank canvas', desc: 'An empty board — add anything.' },
    { id: 'wb-brainstorm', name: 'Brainstorm starter', desc: 'A focal question and a cluster of empty notes.', elements: [
      { id: 't1', type: 'text', x: 70, y: 22, w: 380, h: 44, text: "What's the big question?", color: null },
      { id: 'n1', type: 'sticky', x: 70, y: 92, w: 150, h: 120, text: '', color: '#f6e7b8' },
      { id: 'n2', type: 'sticky', x: 236, y: 92, w: 150, h: 120, text: '', color: '#cfe6d2' },
      { id: 'n3', type: 'sticky', x: 402, y: 92, w: 150, h: 120, text: '', color: '#cfe0f0' },
      { id: 'n4', type: 'sticky', x: 568, y: 92, w: 150, h: 120, text: '', color: '#f0d8cd' } ] },
    { id: 'wb-impact', name: 'Impact / effort matrix', desc: 'Prioritise initiatives by impact vs. effort — the classic 2×2.', elements: [
      { id: 'h', type: 'text', x: 60, y: 16, w: 560, h: 36, text: 'Prioritise — impact vs. effort', color: null },
      { id: 'q1', type: 'rect', x: 70, y: 70, w: 410, h: 200, text: 'Quick wins  ·  do now\nHigh impact · low effort', color: '#2f7757' },
      { id: 'q2', type: 'rect', x: 482, y: 70, w: 410, h: 200, text: 'Big bets  ·  plan carefully\nHigh impact · high effort', color: '#2f5d8a' },
      { id: 'q3', type: 'rect', x: 70, y: 272, w: 410, h: 200, text: 'Fill-ins  ·  if time allows\nLow impact · low effort', color: '#b8862f' },
      { id: 'q4', type: 'rect', x: 482, y: 272, w: 410, h: 200, text: 'Thankless  ·  avoid\nLow impact · high effort', color: '#b3382a' },
      { id: 'ax1', type: 'text', x: 60, y: 54, w: 160, h: 26, text: '↑ Impact', color: null },
      { id: 'ax2', type: 'text', x: 740, y: 478, w: 160, h: 26, text: 'Effort →', color: null },
      { id: 's1', type: 'sticky', x: 300, y: 150, w: 150, h: 96, text: 'Automated KYC onboarding', color: '#cfe6d2' },
      { id: 's2', type: 'sticky', x: 700, y: 150, w: 150, h: 96, text: 'Wealth platform 2.0', color: '#cfe0f0' } ] },
    { id: 'wb-nnl', name: 'Now / Next / Later roadmap', desc: 'A lightweight, lane-based roadmap without hard dates.', elements: [
      { id: 'h', type: 'text', x: 60, y: 16, w: 520, h: 36, text: 'Roadmap — now · next · later', color: null },
      { id: 'c1', type: 'rect', x: 60, y: 66, w: 280, h: 420, text: 'NOW  ·  in flight', color: '#2f7757' },
      { id: 'c2', type: 'rect', x: 350, y: 66, w: 280, h: 420, text: 'NEXT  ·  this quarter', color: '#b8862f' },
      { id: 'c3', type: 'rect', x: 640, y: 66, w: 280, h: 420, text: 'LATER  ·  on the horizon', color: '#2f5d8a' },
      { id: 's1', type: 'sticky', x: 78, y: 120, w: 150, h: 92, text: 'Automated KYC', color: '#cfe6d2' },
      { id: 's2', type: 'sticky', x: 78, y: 224, w: 150, h: 92, text: 'SOC 2 + DORA', color: '#cfe6d2' },
      { id: 's3', type: 'sticky', x: 368, y: 120, w: 150, h: 92, text: 'SMB advisory tier', color: '#f6e7b8' },
      { id: 's4', type: 'sticky', x: 658, y: 120, w: 150, h: 92, text: 'ESG fund range', color: '#cfe0f0' } ] },
    { id: 'wb-okr', name: 'OKR planning board', desc: 'An objective banner with three key-result columns and initiatives.', elements: [
      { id: 'h', type: 'text', x: 60, y: 14, w: 520, h: 34, text: 'OKR planning', color: null },
      { id: 'obj', type: 'rect', x: 60, y: 60, w: 860, h: 74, text: 'OBJECTIVE  —  Grow assets under management to 12 BNOK', color: '#1a3d32' },
      { id: 'k1', type: 'rect', x: 60, y: 150, w: 276, h: 330, text: 'KR 1  —  Net new capital 1.8 BNOK', color: '#2f5d8a' },
      { id: 'k2', type: 'rect', x: 346, y: 150, w: 276, h: 330, text: 'KR 2  —  Client NPS to 60', color: '#2f5d8a' },
      { id: 'k3', type: 'rect', x: 632, y: 150, w: 288, h: 330, text: 'KR 3  —  Fee margin 0.82%', color: '#2f5d8a' },
      { id: 's1', type: 'sticky', x: 76, y: 210, w: 150, h: 92, text: 'Nordic expansion', color: '#cfe6d2' },
      { id: 's2', type: 'sticky', x: 362, y: 210, w: 150, h: 92, text: 'Quarterly reviews', color: '#f6e7b8' },
      { id: 's3', type: 'sticky', x: 648, y: 210, w: 150, h: 92, text: 'Fee restructuring', color: '#f0d8cd' } ] },
    { id: 'wb-soar', name: 'SOAR analysis', desc: 'Strengths, Opportunities, Aspirations, Results — the appreciative cousin of SWOT.', elements: [
      { id: 'h', type: 'text', x: 60, y: 16, w: 520, h: 36, text: 'SOAR — build on what works', color: null },
      { id: 'q1', type: 'rect', x: 70, y: 66, w: 410, h: 200, text: 'STRENGTHS  ·  what we do well', color: '#2f7757' },
      { id: 'q2', type: 'rect', x: 482, y: 66, w: 410, h: 200, text: "OPPORTUNITIES  ·  what's possible", color: '#2f5d8a' },
      { id: 'q3', type: 'rect', x: 70, y: 268, w: 410, h: 200, text: 'ASPIRATIONS  ·  what we want to be', color: '#b8862f' },
      { id: 'q4', type: 'rect', x: 482, y: 268, w: 410, h: 200, text: "RESULTS  ·  how we'll measure it", color: '#a8553a' } ] },
    { id: 'wb-ssc', name: 'Start / Stop / Continue', desc: 'A fast retrospective to steer the operating rhythm.', elements: [
      { id: 'h', type: 'text', x: 60, y: 16, w: 520, h: 36, text: 'Retro — start · stop · continue', color: null },
      { id: 'c1', type: 'rect', x: 60, y: 66, w: 280, h: 420, text: 'START  ·  begin doing', color: '#2f7757' },
      { id: 'c2', type: 'rect', x: 350, y: 66, w: 280, h: 420, text: 'STOP  ·  stop doing', color: '#b3382a' },
      { id: 'c3', type: 'rect', x: 640, y: 66, w: 280, h: 420, text: 'CONTINUE  ·  keep doing', color: '#2f5d8a' },
      { id: 's1', type: 'sticky', x: 78, y: 120, w: 150, h: 92, text: '', color: '#cfe6d2' },
      { id: 's2', type: 'sticky', x: 368, y: 120, w: 150, h: 92, text: '', color: '#f0d8cd' },
      { id: 's3', type: 'sticky', x: 658, y: 120, w: 150, h: 92, text: '', color: '#cfe0f0' } ] },
    { id: 'wb-stakeholder', name: 'Stakeholder map', desc: 'Plot stakeholders by power and interest to plan engagement.', elements: [
      { id: 'h', type: 'text', x: 60, y: 16, w: 560, h: 36, text: 'Stakeholder map — power vs. interest', color: null },
      { id: 'q1', type: 'rect', x: 70, y: 70, w: 410, h: 200, text: 'KEEP SATISFIED  ·  high power, low interest', color: '#b8862f' },
      { id: 'q2', type: 'rect', x: 482, y: 70, w: 410, h: 200, text: 'MANAGE CLOSELY  ·  high power, high interest', color: '#b3382a' },
      { id: 'q3', type: 'rect', x: 70, y: 272, w: 410, h: 200, text: 'MONITOR  ·  low power, low interest', color: '#737373' },
      { id: 'q4', type: 'rect', x: 482, y: 272, w: 410, h: 200, text: 'KEEP INFORMED  ·  low power, high interest', color: '#2f5d8a' },
      { id: 'ax1', type: 'text', x: 60, y: 54, w: 160, h: 26, text: '↑ Power', color: null },
      { id: 'ax2', type: 'text', x: 720, y: 478, w: 180, h: 26, text: 'Interest →', color: null },
      { id: 's1', type: 'sticky', x: 700, y: 150, w: 150, h: 92, text: 'Board', color: '#f0d8cd' },
      { id: 's2', type: 'sticky', x: 700, y: 350, w: 150, h: 92, text: 'Key clients', color: '#cfe0f0' } ] },
    { id: 'wb-northstar', name: 'Vision → Strategy → Execution', desc: 'A north-star cascade from why to what to how.', elements: [
      { id: 'v', type: 'rect', x: 200, y: 30, w: 520, h: 76, text: "★ NORTH STAR  —  the Nordics' most trusted independent wealth partner", color: '#1a3d32' },
      { id: 's', type: 'rect', x: 120, y: 130, w: 680, h: 76, text: 'STRATEGY  —  deepen client trust while opening the Nordic mid-market', color: '#2f5d8a' },
      { id: 'p1', type: 'rect', x: 60, y: 230, w: 200, h: 120, text: 'Financial', color: '#2f5d8a' },
      { id: 'p2', type: 'rect', x: 272, y: 230, w: 200, h: 120, text: 'Customer', color: '#2f7757' },
      { id: 'p3', type: 'rect', x: 484, y: 230, w: 200, h: 120, text: 'Process', color: '#b8862f' },
      { id: 'p4', type: 'rect', x: 696, y: 230, w: 200, h: 120, text: 'People', color: '#a8553a' },
      { id: 'e', type: 'text', x: 60, y: 372, w: 540, h: 30, text: 'Execution — add initiatives under each pillar ↓', color: null } ] },
    { id: 'wb-2x2', name: 'Blank 2×2 matrix', desc: 'Two crossing axes — label them and plot.', elements: [
      { id: 'q1', type: 'rect', x: 90, y: 70, w: 360, h: 200, text: '', color: '#cfe6d2' },
      { id: 'q2', type: 'rect', x: 452, y: 70, w: 360, h: 200, text: '', color: '#cfe0f0' },
      { id: 'q3', type: 'rect', x: 90, y: 272, w: 360, h: 200, text: '', color: '#f6e7b8' },
      { id: 'q4', type: 'rect', x: 452, y: 272, w: 360, h: 200, text: '', color: '#f0d8cd' },
      { id: 'ax1', type: 'text', x: 90, y: 40, w: 200, h: 26, text: '↑ Axis Y (rename)', color: null },
      { id: 'ax2', type: 'text', x: 630, y: 478, w: 190, h: 26, text: 'Axis X (rename) →', color: null } ] },
  ],
}
export function templatesFor(fw: string): ToolTemplate[] {
  return TEMPLATES[fw] || [{ id: fw + '-blank', name: 'Blank', desc: 'Start from scratch.' }]
}

/* ───────────────────────── content helpers ───────────────────────── */

export function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x === undefined ? null : x))
}
export function toolContent(a: { fw: string; sections?: Record<string, SectionData>; elements?: WbElement[] }): ToolContent {
  return a.fw === 'whiteboard'
    ? { elements: deepClone(a.elements || []) }
    : { sections: deepClone(a.sections || {}) }
}
export function rawCount(a: { fw: string; sections?: Record<string, SectionData>; elements?: WbElement[] }): number {
  if (a.fw === 'whiteboard') return (a.elements || []).length
  const schema = FW_SCHEMA[a.fw]
  if (!schema) return 0
  const sections = a.sections || {}
  if (schema.kind === 's7') return schema.sections.filter((s) => (sections[s.id] || {}).text).length
  let n = 0
  schema.sections.forEach((s) => { n += ((sections[s.id] || {}).items || []).length })
  return n
}
export function countPoints(a: { fw: string; sections?: Record<string, SectionData>; elements?: WbElement[] }): string {
  if (a.fw === 'whiteboard') { const n = (a.elements || []).length; return n + ' item' + (n === 1 ? '' : 's') }
  const schema = FW_SCHEMA[a.fw]
  if (schema && schema.kind === 's7') return rawCount(a) + ' of 7 elements'
  const n = rawCount(a)
  return n + ' point' + (n === 1 ? '' : 's')
}
export function riskCls(v?: Rating): string {
  return v === 'Low' ? 'success' : v === 'High' ? 'danger' : 'warn'
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fwMonthYear(): string {
  const d = new Date()
  return MONTHS[d.getMonth()] + ' ' + d.getFullYear()
}
export function relTime(ts: string): string {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return Math.floor(d / 60) + 'm ago'
  if (d < 86400) return Math.floor(d / 3600) + 'h ago'
  return Math.floor(d / 86400) + 'd ago'
}

/** Empty content for a fresh tool of kind `fw`. */
export function emptyContent(fw: FwKind): ToolContent {
  if (fw === 'whiteboard') return { elements: [] }
  const schema = FW_SCHEMA[fw]
  const sections: Record<string, SectionData> = {}
  schema.sections.forEach((sec) => {
    if (sec.field === 'text') sections[sec.id] = { text: '' }
    else sections[sec.id] = Object.assign(
      { items: [] as string[] },
      sec.hasRating ? { rating: 'Medium' as Rating } : {},
      sec.hasRisk ? { risk: (sec.defaultRisk || 'Medium') as Rating } : {},
    )
  })
  return { sections }
}
/** Empty content optionally pre-filled from a template. */
export function contentFromTemplate(fw: FwKind, template?: ToolTemplate | null): ToolContent {
  const content = emptyContent(fw)
  if (template && (template.sections || template.elements)) {
    if (fw === 'whiteboard') content.elements = deepClone(template.elements || [])
    else content.sections = Object.assign(content.sections || {}, deepClone(template.sections || {}))
  }
  return content
}
