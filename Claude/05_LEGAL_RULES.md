# 05 · AML Rules as Validation Logic

These rules drive the **Lovkrav** card on Oversikt and the validation gates on signing. Encode them in a server-side function (or a typed view) `amu_compliance_status` so the hook reads a single row.

| Rule | AML / forskrift | Validation |
|---|---|---|
| AMU exists when ≥50 ansatte (or ≥30 if requested by either side) | § 7-1 (1) | `org.employee_count >= 50` ⇒ `committee` row required |
| Lik representasjon | § 7-1 (2) | `count(side='employer' AND voting AND active) == count(side='employee' AND voting AND active)` |
| BHT representert | § 7-1 (3) | `exists(amu_members where side='bht' AND active)` |
| Leder veksler hvert år | § 7-1 (4) | `committee.chair_side` differs from previous year's value |
| Minst 4 møter per år | § 7-2 | `count(amu_meetings where year=Y AND status in ('completed','signed')) >= 4` |
| Behandle HMS-plan | § 7-2 (2)a | `exists(agenda_items where source_type='auto_hms_plan' AND year=Y)` |
| Behandle yrkesskader | § 7-2 (2)b | aggregated yrkesskaderapport tabled at least once per year |
| Behandle sykefravær (anonymisert) | § 7-2 (2)d | quarterly sick-leave aggregate tabled (≥2 of 4 meetings) |
| Behandle medarbeiderundersøkelse | § 7-2 (2)e | tabled when one is conducted (≤24mnd) |
| Årsrapport signert | § 7-2 (6) | `amu_annual_reports where year=Y-1 AND status='signed'` exists by 31. mars |
| 40-timers HMS-kurs | § 6-5 | every voting member has `hms_training_valid_until >= today` |
| Varsling kun aggregert til AMU | § 2 A-3 | UI must use `whistleblowing_aggregates` view (no PII) — NEVER raw `whistleblowing_cases` |

The Oversikt KPI tile "Kritiske aktiviteter" sums:
- count(amu_meetings.signed_at IS NULL AND status='completed' AND now() - completed_at > 14 days)
- count(amu_annual_reports.status='draft' AND year < current_year)
- count(deviations open AND requires_amu_review AND age > 7 days)
- count(meetings missing for current year vs `min_meetings_per_year`)
- count(amu_members where voting AND hms_training_valid_until < today)

Each of these has a deep-link target in the UI.

---

## Immutability ladder

```
draft → scheduled → in_progress → completed → signed → archived
```

- `signed` and `archived` blocked by RLS.
- Decisions, agenda items, attendance: derived immutability — once parent meeting is `signed`, child rows are read-only.
- Annual report: `signed` blocks edits; create a new draft for next year.

## Permissions matrix

| Action | Permission |
|---|---|
| View AMU | any org member |
| Propose topic | any org member (`canPropose`) |
| Schedule meeting, generate agenda, edit members, edit annual-report draft | `amu.manage` (or `isAdmin`) |
| Sign meeting referat or annual report | `amu.chair` (typically committee leader + deputy) |
| Bypass everything | `isAdmin` |

`canManage = isAdmin || can('amu.manage')` — the mandatory pattern from the rule set.
