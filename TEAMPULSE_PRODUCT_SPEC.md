# TeamPulse — Team Evaluation & Performance Platform
## Complete Product Specification & Feature Map

> **Version:** 1.0 — MVP to Scale  
> **Date:** 2026-04-30  
> **Status:** Pre-build specification

---

## Product Vision

**Problem:** Teams underperform because they lack structured, honest insight into their dynamics, individual gaps, and actionable improvement paths. Managers guess. People feel unheard. Growth stalls.

**Solution:** A survey-based diagnostic platform that turns team assessments into concrete, trackable improvement plans — combining workshops, tests, peer feedback, and AI-guided action plans.

---

## Visual Product Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TEAMPULSE PLATFORM                           │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   DIAGNOSE  │───▶│   ANALYZE   │───▶│    GROW     │             │
│  │  (Surveys)  │    │ (Insights)  │    │  (Actions)  │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│         │                 │                   │                     │
│         ▼                 ▼                   ▼                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │  Workshops  │    │  Heatmaps & │    │  Personal   │             │
│  │  & Pulse    │    │  Strength   │    │  Action     │             │
│  │  Checks     │    │  Profiles   │    │  Plans      │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                     │
│  ─────────────────── DATA LAYER ──────────────────────             │
│  │  Historical Trends │ Benchmarks │ Progress Tracking │           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Roles

```
┌──────────────────────────────────────────────────────────┐
│  ADMIN          MANAGER          TEAM MEMBER    COACH    │
│  (Org setup)    (Team lead)      (Participant)  (Ext.)   │
│  Full access    Team reports     Own data only  Read+    │
└──────────────────────────────────────────────────────────┘
```

| Role | Permissions |
|---|---|
| **Admin** | Full org access, billing, all teams, all data |
| **Manager** | Create surveys, view team reports, assign action plans |
| **Team Member** | Complete surveys, view own profile and plans |
| **Coach** | Read-only access to assigned teams, add notes |

---

## Feature Breakdown — MVP → Extended

### LAYER 1 — MVP (Ship in 8–12 weeks)

---

#### MODULE 1: FOUNDATION

| Feature | Description | Priority |
|---|---|---|
| Auth & Org Setup | Register org, invite by email, verify users | P0 |
| Role Management | Admin / Manager / Member role assignment | P0 |
| Team Builder | Create teams, assign and remove members | P0 |
| Profile Setup | Name, role, department, avatar | P0 |

---

#### MODULE 2: SURVEYS & ASSESSMENTS

| Feature | Description | Priority |
|---|---|---|
| Survey Builder | Question types: Likert scale, MCQ, open text, rating | P0 |
| Pre-built Templates | Team health, strengths, 5 dysfunctions, psych safety | P0 |
| Individual Assessment | Self-evaluation per role and skill area | P0 |
| Team Assessment | Collective survey with configurable anonymity | P0 |
| Survey Scheduling | One-time or recurring (weekly / monthly / quarterly) | P0 |
| Anonymous Mode | Hide respondent identity; visible anonymity guarantee | P0 |
| Survey Distribution | Email link, in-app notification, shareable URL | P0 |
| Response Reminders | Automated nudges for incomplete surveys | P1 |
| Survey Preview | Manager previews survey before sending | P1 |

---

#### MODULE 3: RESULTS & REPORTING

| Feature | Description | Priority |
|---|---|---|
| Individual Dashboard | Strengths radar chart, gap analysis, score history | P0 |
| Team Dashboard | Aggregated heatmap, trend lines, participation rate | P0 |
| Response Rate Tracking | Completion status per survey, per person | P0 |
| Score Breakdown | Per-dimension scoring with color-coded indicators | P0 |
| PDF Export | Shareable reports formatted for 1:1s and reviews | P1 |
| CSV Export | Raw data export for analysis | P1 |
| Trend Over Time | Compare results across survey cycles | P1 |

---

#### MODULE 4: ACTION PLANS

| Feature | Description | Priority |
|---|---|---|
| Auto-generated Plan | Plan generated from survey result gaps | P0 |
| Goal Setting (SMART) | Attach SMART goals to identified weak areas | P0 |
| Manager Assignment | Manager assigns tasks or resources to members | P0 |
| Check-in Cadence | Scheduled reminders for plan follow-up | P0 |
| Goal Status Tracking | Not started / In progress / Complete / Blocked | P1 |
| Plan History | Archive completed plans for reference | P1 |

---

### LAYER 2 — Growth Phase (Week 12–24)

---

#### MODULE 5: WORKSHOP ENGINE

| Feature | Description |
|---|---|
| Workshop Templates | Pre-built facilitation guides for common team scenarios |
| Live Session Mode | Real-time collaborative answering during a live session |
| Workshop Outcomes | Capture decisions, commitments, and owners |
| Follow-up Surveys | Auto-send post-workshop check-in survey |
| Facilitator Controls | Timer, anonymity toggle, force-close responses |
| Session Recording Summary | Text summary of outcomes and commitments |

---

#### MODULE 6: 360° FEEDBACK

| Feature | Description |
|---|---|
| Peer Review Cycles | Request and give structured feedback to peers |
| Manager → Member | Structured top-down feedback with rubrics |
| Member → Manager | Safe upward feedback with anonymity protection |
| Feedback Aggregation | Theme extraction from free-text using NLP |
| Feedback Visibility Controls | What each role can see and when |
| Review Cycle Scheduling | Open / close feedback windows per quarter |

---

#### MODULE 7: SKILL MAPPING

| Feature | Description |
|---|---|
| Skill Library | Custom and standard competency catalog per org |
| Role Benchmarks | Expected vs actual skill score comparison |
| Growth Paths | Suggested next skills based on role and goals |
| Strength Profiles | Per-person radar card with shareable link |
| Team Skill Matrix | Grid view of all skills across the team |
| Gap Heatmap | Visual of where the team is collectively weak |

---

### LAYER 3 — Scale Phase (Month 6+)

---

#### MODULE 8: AI COACH

| Feature | Description |
|---|---|
| AI Plan Generator | LLM-generated personalized improvement plans |
| Insight Summaries | Plain-language explanations of dashboard data |
| Anomaly Alerts | Flags sudden drops in team health scores |
| Recommendation Engine | "Teams like yours improved X by doing Y" suggestions |
| Manager Coaching Tips | Contextual suggestions for managers during check-ins |

---

#### MODULE 9: BENCHMARKING

| Feature | Description |
|---|---|
| Industry Benchmarks | Compare scores to anonymized industry data |
| Internal Benchmarking | Compare teams within the same organization |
| Progress Over Time | Longitudinal performance charts per dimension |
| Cohort Comparison | Compare new vs tenured members, or team vs team |

---

#### MODULE 10: INTEGRATIONS

| Feature | Description |
|---|---|
| Slack / Microsoft Teams | Survey notifications, pulse check delivery |
| HRIS (BambooHR, Workday) | Sync team structure and org chart |
| Jira / Linear | Link action plan goals to actual engineering tickets |
| SSO (SAML / OAuth 2.0) | Enterprise authentication |
| Zapier / Webhooks | Custom automation triggers on events |
| Calendar (Google / Outlook) | Schedule workshops and check-ins |

---

## Core Assessment Templates

| Template | Dimensions Measured | Model Basis |
|---|---|---|
| **Team Health Check** | Trust, Clarity, Energy, Conflict, Communication | Custom |
| **5 Dysfunctions Diagnostic** | Trust, Conflict, Commitment, Accountability, Results | Lencioni |
| **Individual Strengths Map** | Technical, Soft skills, Leadership, Collaboration | Custom |
| **Psychological Safety Index** | Speak-up culture, Risk tolerance, Inclusion | Edmondson |
| **Manager Effectiveness** | Clarity, Coaching, Support, Recognition, Delegation | Custom |
| **Onboarding Readiness** | 30 / 60 / 90 day integration and alignment | Custom |

---

## Data Model Overview

```
Org
 └── Teams
 │     └── Members (Users)
 │           └── Survey Responses
 │           └── Strength Profile
 │           └── Action Plans
 │                 └── Goals
 │                       └── Check-ins
 │
 └── Surveys
 │     └── Questions
 │     └── Responses
 │     └── Reports
 │
 └── Workshops
       └── Sessions
       └── Outcomes
       └── Follow-up Surveys
```

### Key Entities

```
User
  id, org_id, team_id[], role, name, email, avatar, created_at

Team
  id, org_id, name, manager_id, created_at

Survey
  id, org_id, team_id, title, type, anonymous, schedule, status, created_by

Question
  id, survey_id, type, text, options[], order, required

Response
  id, survey_id, user_id (nullable if anon), answers[], submitted_at

ActionPlan
  id, user_id, survey_id, goals[], status, created_at, updated_at

Goal
  id, plan_id, dimension, description, due_date, status, owner_id

Workshop
  id, org_id, team_id, template_id, status, started_at, ended_at

WorkshopOutcome
  id, workshop_id, description, owner_id, due_date, status
```

---

## Tech Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js + Tailwind CSS | Fast dev, SSR, SEO |
| **Charts** | Recharts / D3.js | Flexible visualizations |
| **Backend** | Node.js (tRPC) or FastAPI | Type-safe or Python ML |
| **Database** | PostgreSQL | Relational, proven |
| **Auth** | Clerk or NextAuth | Fast MVP auth |
| **Survey Engine** | Custom builder | Owned UX and logic |
| **Email** | Resend or Postmark | Reliable delivery |
| **AI** | Claude API (Anthropic) | Plans and insights |
| **Hosting** | Vercel + Supabase | Zero DevOps to start |
| **Storage** | S3 / Supabase Storage | PDF exports |

---

## MVP Build Sequence

```
WEEK 1–2    ──▶  Auth + Org Setup + Team Builder
     │
WEEK 3–4    ──▶  Survey Builder + 3 Launch Templates
     │
WEEK 5–6    ──▶  Response Collection + Individual Dashboard
     │
WEEK 7–8    ──▶  Team Dashboard + Heatmap
     │
WEEK 9–10   ──▶  Action Plan Generator + Goal Tracking
     │
WEEK 11–12  ──▶  PDF Export + Email Notifications + Polish
     │
WEEK 12     ──▶  Beta Launch with 3–5 real teams
```

---

## Customer Validation Scorecard

| Feature | Customer Value | Build Effort | MVP? |
|---|---|---|---|
| Survey builder | ★★★★★ | Medium | YES |
| Pre-built templates | ★★★★★ | Low | YES |
| Team heatmap | ★★★★★ | Medium | YES |
| Action plans | ★★★★★ | Medium | YES |
| Anonymous mode | ★★★★★ | Low | YES |
| Recurring surveys | ★★★★☆ | Low | YES |
| PDF export | ★★★★☆ | Low | YES |
| 360° feedback | ★★★★☆ | High | NO — Phase 2 |
| Workshop engine | ★★★★☆ | High | NO — Phase 2 |
| Skill mapping | ★★★★☆ | Medium | NO — Phase 2 |
| AI coach | ★★★★☆ | High | NO — Phase 3 |
| Industry benchmarks | ★★★☆☆ | High | NO — Phase 3 |
| HRIS integrations | ★★★☆☆ | Very High | NO — Phase 3 |
| Slack / Teams notify | ★★★★☆ | Medium | NO — Phase 2 |
| SSO | ★★★☆☆ | Medium | NO — Phase 3 |

---

## Critical Success Factors

1. **Time-to-value under 15 minutes** — Manager signs up, runs first survey, sees results in the same session. If onboarding is longer, churn is immediate.

2. **Anonymity that people actually trust** — Must be explicit, visible, and auditable. Show a clear message: "Your name is never attached to this response." Without this, honest answers don't happen.

3. **Action plans that are specific, not generic** — Survey results must drive role-relevant, dimension-specific recommendations. Generic advice kills trust in the platform.

4. **Recurring cadence built in** — Value compounds with every re-survey. Build the habit loop early. Default to monthly pulse checks, not just annual reviews.

5. **Manager buy-in is the sale** — Managers are the buyers. Individual members are the users. Design the manager experience to be effortless and the results to be defensible in leadership meetings.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Survey fatigue — users stop completing | High | High | Keep surveys short (< 5 min), show personal value |
| Action plans ignored after generation | High | High | Embed check-ins, link to calendar, manager visibility |
| Anonymity doubts killing honest responses | Medium | High | Clear UI, anonymity audit trail for admins |
| Generic AI plans feel useless | Medium | High | Dimension-specific plan templates first, AI layer later |
| Manager doesn't act on results | Medium | High | Manager dashboard makes inaction visible |
| Low participation rate | Medium | High | Slack/email reminders, manager nudge tools |

---

## Biggest Risk: The Survey Dumping Ground Problem

> The most common failure mode for this type of product is becoming a **survey dumping ground** — people fill forms, nothing changes, engagement collapses within 60 days.
>
> The action plan module is **not optional infrastructure**. It is the product. Every survey result must lead visibly to a next step, owned by someone, with a date attached — or the platform is a more expensive version of Google Forms.
>
> **Ship the action plan module before shipping 360° feedback or workshops.**

---

## Competitive Landscape

| Tool | Strength | Gap |
|---|---|---|
| Culture Amp | Deep analytics, enterprise | Expensive, complex setup |
| Lattice | OKR + feedback | Not workshop/team focused |
| Leapsome | Learning + performance | Heavy, long onboarding |
| 15Five | Pulse surveys | Weak on action planning |
| Google Forms | Free, familiar | Zero analysis or planning |
| **TeamPulse** | Fast setup + action plans | Early stage — build trust |

**Our angle:** Fastest path from survey to concrete action plan. Less enterprise overhead, more team-first UX.

---

## Go-to-Market Strategy (MVP)

1. **Target:** Engineering and product teams at 20–200 person companies
2. **Buyer:** Engineering manager or Head of People
3. **Channel:** Direct outreach, LinkedIn, ProductHunt launch
4. **Pricing model:** Per seat / month — Free up to 10 members, paid above
5. **Land and expand:** One team adopts → HR sees results → org-wide rollout

---

## North Star Metric

> **% of teams that complete a second survey within 60 days of their first**

If teams return, the product is delivering value. If they don't, no amount of features saves it.

---

## Next Steps

- [ ] Validate core survey flow with 3 real managers (discovery interviews)
- [ ] Wireframe the survey builder and team dashboard
- [ ] Define the 3 launch templates in full detail
- [ ] Set up Next.js + Supabase project scaffold
- [ ] Build auth + org + team foundation (Week 1–2)
- [ ] First internal beta with one real team by Week 8
