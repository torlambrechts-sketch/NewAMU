# Documents module redesign — Claude Design handoff

> Handoff bundle: 10 prototype artboards (`Rec01`–`Rec10`) from Claude Design.
> This spec tracks the redesign of the Dokumenter module against those artboards.

## Decisions (approved)

- Accent: keep registered deep teal `#0f766e` for the `documents` dashboard
  scope. The prototype's forest `#1a3d32` is the shared app shell.
- All `/documents/page/:id` links open the new 3-column viewer (Rec02).
- Live co-editing (Rec04) is Sprint 10; Klarert AI answer card is Sprint 11.

## Artboard → page map

| Design | Page | Route |
|---|---|---|
| Rec01 Dokumenthub | `DocumentsOversiktPage` | `/documents` |
| Rec02 Wiki tre+leser+sidepanel | `WikiPageView` | `/documents/page/:id` |
| Rec03 Rich-text editor | editor workbench | `/documents/page/:id/reference-edit` |
| Rec05 Inline kommentarer | comment mode on viewer | — |
| Rec06 Forslag / sporing | track-changes view | — |
| Rec07 Versjonshistorikk diff | `WikiVersionDiff` | — |
| Rec08 Godkjenning | approval pipeline | `/documents/reviews` |
| Rec09 Maler-bibliotek | `DocumentsMalbibliotekPage` | `/documents/malbibliotek` |
| Rec10 Søk & oppslag | `DocumentsSokPage` | `/documents/sok` |

## Sprints

- S0 Foundation — `KpiRow`, `FilterChip`, `ReaderWidthContext`.
- S1 Oversikt frontpage (Rec01).
- S2 Viewer 3-col + size button (Rec02).
- S3 Rich-text editor — slash menu, block handles (Rec03).
- S4 Inline comments — text-anchored, persisted (Rec05) — DB migration.
- S5 Suggestions / track-changes (Rec06) — DB migration.
- S6 Version history diff (Rec07).
- S7 Approval & signing (Rec08).
- S8 Templates library (Rec09).
- S9 Search faceted (Rec10).
- S10 Live co-editing (Rec04).
- S11 Klarert AI answer card.

Status is tracked in commit history on `claude/plan-document-module-update-aLroQ`.
