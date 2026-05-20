# i18n — remaining execution plan (Phases 3–5)

Handover spec for the multi-language initiative. Phases 0–2 and the
foundations of 3/5 are shipped (see `ROADMAP.md §9`). What remains is
**execution volume, not unsolved design** — every pattern below already
exists as a working reference in the codebase. This plan slices the rest
into focused, independently-shippable sessions.

## Ground truth

| Metric | Value |
|---|---|
| Files containing Norwegian (`æøå`) | **583** — 438 under `src/`, 145 under `modules/` |
| Hardcoded `nb-NO` formatting sites | 70 |
| Estimated distinct UI strings | ~4,000–4,500 |
| Locale JSON | `src/lib/i18n/locales/{nb,en}.json` (single `translation` namespace, module-prefixed keys) |

## Reference patterns (copy these — do not invent)

| Situation | Pattern | Reference in tree |
|---|---|---|
| Function component | `const { t } = useT()` → `t('ns.key')` | `ShellHeaderWidgets.tsx` |
| Class component | `import i18n` → `i18n.t('ns.key')` | `RouteErrorBoundary.tsx` |
| Plural | `_one`/`_other` keys + `t(k,{count})` | `shell.header.overdueTasks` |
| Non-component `.ts` data file | builder fn taking `t` | `marketing/content/navigation.ts` |
| Date/number/currency | `lib/i18n/format.ts` helpers | `format.ts` (built, not yet adopted) |
| Server-side | `_shared/i18n.ts` catalog + `t(locale,k)` | `send-meeting-invites/index.ts` |

## Per-module loop (every Phase 3 session repeats this)

1. `grep -rl '[æøå]' <dir>` — enumerate the module's files.
2. Add a `<module>` block to `nb.json` **and** `en.json` (keep key parity).
3. Wire `useT()` / `i18n.t`; replace JSX text, `aria-label`, `title`,
   `placeholder`, toast and constant-array strings; plurals via `_one/_other`.
4. Migrate that module's `nb-NO` / `localeCompare(...,'nb')` sites to
   `lib/i18n/format.ts`.
5. Verify: `npx tsc -b` · `npx eslint <files>` · `npx vite build` ·
   browser walk of the module's golden path in both locales.
6. Commit (`i18n Phase 3: extract <module>`), confirm nb/en key parity.

**Definition of done per module:** `grep -rl '[æøå]' <dir>` returns only
files where the Norwegian is a code identifier/comment, not user-facing copy.

## Phase 3 — sessions

Sized to ~30–60 files each; each session is one or more commits.

| Session | Scope | Files | Notes |
|---|---|---|---|
| **P3-1** | `components/layout` remainder + `common` namespace + zod error-map (`lib/validation`) | ~25 | Foundational — shared vocabulary + `AticsShell` nav. Build the `common` keys first; later sessions reuse them. |
| **P3-2** | compliance (`modules/compliance`, `pages/compliance`) + registers | ~33 | |
| **P3-3** | survey (`modules/survey`, `components/survey`, `pages/survey`) | ~60 | Largest single module — own session. |
| **P3-4** | documents (`pages/documents`, `components/documents`, `modules/documents`) | ~63 | Largest — own session. |
| **P3-5** | learning (`pages/learning`, `components/learning`) + meetings (`modules/meetings`, `pages/meetings`) | ~68 | |
| **P3-6** | tasks (`modules/tasks`) + alerts (`modules/alerts`) + risk (`modules/risk`) | ~42 | |
| **P3-7** | workflow (`components/workflow`) + `pages/overview` | ~52 | Workflow POC already partly done. |
| **P3-8** | admin (`pages/admin`, `components/admin`) + platform/partner (`pages/platform`, `pages/partner`) + `pages/iso` + `pages/auditor` | ~73 | Split into 2 commits if needed. |
| **P3-9** | `src/lib/**` non-component files (~41) + sweep remaining `nb-NO` sites + **enable ESLint `æøå`-literal guard** | ~41 | Guard goes last — it would flag every un-migrated literal before this. |

Estimate: **~9 sessions**, 2–3 modules each.

## Phase 4 — marketing site + SEO

Ships as **one atomic release** — an `/en` URL serving Norwegian prose is
worse than no English route. Chrome (`marketing.*` namespace) is already done.

| Session | Scope |
|---|---|
| **P4-1** | Translate `pages/marketing/content/*.ts` (~745 lines: features, compliance, integrations, endringer) to locale-keyed exports; extract the 7 page components + section components under `pages/marketing/sections` to the `marketing` namespace. |
| **P4-2** | `useMarketingLocale()` (locale from URL prefix); `/en/*` route subtree in `App.tsx` + `Accept-Language` root negotiation; `LanguageDropdown` mounted in `MarketingNav`; rewrite `scripts/prerender-marketing.mjs` for per-locale `dist/en/**` output with per-locale `<title>`/meta/JSON-LD and reciprocal `<link rel="alternate" hreflang>`. Verify: `npm run build`, inspect `dist/en/**`. |

Estimate: **1–2 sessions** (P4-1 and P4-2 can merge if content translation is quick).

## Phase 5 — server-side text

Foundation (`_shared/i18n.ts`) + `send-meeting-invites` done.

| Session | Scope |
|---|---|
| **P5-1** | Wire `send-survey-invites`, `send-meeting-digest`, `documents-notification-digest` to `_shared/i18n.ts` (same per-recipient pattern — resolve locale via `profiles.locale`, fall back to org `default_locale`). Convert the notification SQL functions (`scan_and_create_compliance_notifications`, `workflow_notification_dispatch`, doc reminder snippets) from rendered Norwegian text to a **message-key + params** shape rendered at display time. **Deploy** the edge functions and run a verification send per locale (cannot be type-checked locally — Deno). Government PDFs (`gov-arbeidstilsynet-rapport`, `helsetilsynet-build-melding`, `partner-invoice-pdf`) stay nb — legally locked. |

Estimate: **1 session** (notification SQL may warrant its own follow-up).

## Tail items

- **9.7 finish** — add `p_locale` to the 4 `provision_*_baseline_for_org`
  RPCs so an `en`-default org provisions English baseline content. Small;
  fold into P5-1 or its own migration.
- **Phase 6 (sv/da)** — config-only once the above lands: `insert into
  app_locales`; add `sv.json`/`da.json`; widen `isAppLocale` /
  `normalizeLocale` in `lib/i18n/locales.ts` (hardcoded `'nb'|'en'` today);
  add `_shared/i18n.ts` catalog entries; author `_locales` rows. No schema
  migration.

## Cross-cutting rules

- nb/en (later sv/da) key parity is non-negotiable — check after every
  session: `keys(nb).length === keys(en).length`, no missing either way.
- Law references (`AML §`, `IK-f §`, `GDPR Art.`, ISO clauses) and proper
  nouns (statute names, framework names, "AMU") stay verbatim — never
  translated.
- Machine-translated `en` strings need a native-speaker QA pass before they
  count as production copy (`en.review.md` flags this).
- Every commit must build clean — never commit a half-extracted file.

## Suggested order

P3-1 → P3-2 → P3-3 → P3-4 → P3-5 → P3-6 → P3-7 → P3-8 → P3-9 → P4-1+P4-2 →
P5-1. Phase 3 modules are independently shippable, so the order can flex to
match product priority; P3-1 (`common`) should stay first because later
sessions reuse its keys, and P3-9's ESLint guard must stay last.
