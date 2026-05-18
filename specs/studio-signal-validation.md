# Studio Builder — customer-signal validation kit

**Owner:** Product lead + sales lead (jointly).
**Status:** 📋 ready — kit shipped, interviews not yet started.
**Gates:** Studio Builder spec §11 Phase 0 Task 0.9 — Phase 2+ engineering does not commit beyond what's in `main` until thresholds below pass.

This file is the artefact promised by Task 0.9. It carries the interview script, the pricing-test landing-page copy, the threshold definitions, and the recording template for the eight customer interviews + 1-2 partner interviews.

When interviews complete, append a `## Results` section at the bottom of this file. The PL signs off on whether thresholds passed. If they pass: Phase 2 work unblocks. If they miss: Phase 0+1 ships as a consolidation deliverable; Phase 2+ is paused for 6 months.

---

## 1. Numeric thresholds (spec §11)

| Metric | Threshold | If miss |
|---|---|---|
| Customers who'd use Simple-mode monthly | ≥ 4 / 8 (50%) | Phase 2 paused. Studio remains a Phase 0+1 consolidation. |
| Customers willing to pay 2× Standard for Pro tier | ≥ 2 / 8 (25%) | Pro tier deferred; Studio stays free in Standard. |
| Partner LOIs (non-binding letter of intent) | ≥ 1 | Phase 3 partner authoring deferred; ship customer-only Studio. |

---

## 2. Customer interview script (45 min)

### 2.1 Pre-interview

- [ ] Confirm role (admin, manager, HMS-ansvarlig, daglig leder).
- [ ] Confirm vertical (barnehage, bygg, helse, finans, transport, IT).
- [ ] Confirm employee count band (<10 / 10–29 / 30–99 / 100+).
- [ ] Send the pricing-test landing-page link (§3 below) 24 h before the call — capture their email-capture-form behaviour passively.

### 2.2 Warm-up (5 min)

1. "Hva er typisk dagen din når det gjelder HMS/compliance i Klarert?"
2. "Hvis du må endre en sjekkliste-mal eller et dokument i dag — hvordan gjør du det?"

### 2.3 Simple-mode probe (15 min)

Show the `/studio` Simple-mode home (cards + scope picker — current branch). Walk through one preset live (e.g. HMS-grunnmur). Then:

3. "Hvor ofte ville du brukt denne overflaten? (Aldri / 1× per kvartal / 1× per måned / 1× per uke / oftere)"
4. "Hvor mange minutter sparte den deg i forhold til dagens flyt?"
5. "Hvilket scenario savner du? Hvilke 2-3 ekstra veivisere ville du laget?"

> **Anchor:** if the customer says monthly+, count toward Threshold 1.

### 2.4 Advanced-mode probe (10 min)

Show `/studio` Advanced (compliance scope; the real TemplateEditorPanel mounts inline). Then:

6. "Ville du brukt denne, eller forblitt på dagens innstillinger-side?"
7. "Hvis du betaler en konsulent for HMS-arbeid i dag — hva er timeprisen?"
8. "Hva ville Pro-tier (2× Standard) være verdt for deg konkret?"

> **Anchor:** if they say "yes, 2× Standard is fair", count toward Threshold 2.

### 2.5 Cool-down (5 min)

9. "Hva er det største friksjons-punktet i Klarert i dag som /studio IKKE løser?"
10. "Hvis vi shippet dette i morgen — ville du brukt det denne uka?"

### 2.6 Post-interview

- [ ] Append transcript to `## Results` below.
- [ ] Tag the interview with `monthly_simple_use: yes/no` and `pays_2x_standard: yes/no`.
- [ ] Update the threshold counter.

---

## 3. Pricing-test landing-page copy

Static landing page at `/studio/pricing-preview` (build target: a 1-file Vercel-prerendered marketing route). Body copy:

> **Klarert Studio — bygg din egen compliance-pakke**
>
> Lag sjekklister, dokumenter, undersøkelser og kurs i én flate.
> Bytt ut SaaS-låste maler med dine egne. Behold full Audit-trail.
>
> **Standard** — det dere har i dag.
>   Inkludert: lese alt, kjøre samsvar.
>
> **Pro** — for HMS-ledere som vil ta over.
>   Lag dine egne maler i Enkel-modus. Hold styr på alt fra én side.
>   *Ca. 2× Standard. Pris under ferdigstilling.*
>
> **Enterprise** — for konsernsystemer.
>   Avansert-modus med kanvas, version-historikk og pakke-eksport.
>   Inkludert i Enterprise-avtalen.

Email-capture form: "Send meg pris-info" → posts to a sales inbox; tag the lead with `studio_pricing_interest`. The capture-rate is the soft pricing signal that runs in parallel with the 8 interviews.

---

## 4. Partner interview script (30 min)

Target: 1–2 consultancy partners (revisor, HMS-konsulent, BHT med ≥3 kunder hos Klarert).

1. "Hvor mange Klarert-kunder eier dere i dag? Hvor mange potensielle?"
2. "Hva er typisk arbeidsmodellen — fakturerer dere timer, eller SaaS-resell?"
3. Demo `/studio` + PartnerOrgSwitcher.
4. "Hva ville fått dere til å bringe inn 3 nye kunder dette året?"
5. "Hvilken pricing-modell foretrekker dere? Per-seat / rev-share / bulk-rabatt?"
6. "Vil dere signere et LOI (ikke bindende intensjons-brev) for å være design-partner i 2026?"

> **Anchor:** if they say yes to question 6 with a concrete date, count toward Threshold 3.

---

## 5. Decision matrix

| Customer signal | Partner signal | Decision |
|---|---|---|
| ≥4/8 monthly + ≥2/8 pay-2× | ≥1 partner LOI | ✅ Phase 2+ commits |
| ≥4/8 monthly + ≥2/8 pay-2× | 0 LOI | 🟡 Customer Studio only (Phase 3 partner deferred 6 mo) |
| ≥4/8 monthly + <2/8 pay-2× | any | 🟡 Studio ships in Standard tier; no Pro upsell yet |
| <4/8 monthly | any | 🛑 Studio shipped as Phase 0+1 consolidation; Phase 2 paused 6 mo |

---

## 6. Operator runbook

When the 8 interviews are complete:

1. PL appends transcripts (anonymised where requested) to `## Results` below.
2. PL + sales lead pair on the decision matrix outcome.
3. PL opens an issue tagged `studio-signal-validation-decision` summarising the outcome.
4. If go: spec status flips Phase 2+ tasks from 🚧 to 📋, eng commits to next sprint.
5. If no-go: spec status updated, `ROADMAP.md` §6 reflects the pause.

---

## Results

*(Append interview transcripts + final decision here once the interviews run.)*
