# English locale — review needed

All keys in `en.json` were machine-translated by Claude during the i18n
scaffold (P3-#20). A native English speaker (and a Norwegian-fluent
reviewer for original-meaning checks) should pass over them before
the partner-console / multi-org rollout.

## Keys flagged for review

Every key in `en.json` is machine-translated — there are no "human-verified"
strings yet. Reviewer should confirm:

- `workflow.title` — "Automation" vs "Workflows" vs "Process automation"
- `workflow.description` — long sentence with several domain terms
  (mal-bibliotek, bevispakke, arbeidsflyt-substraten). Verify these
  read naturally in English and aren't overly literal.
- `workflow.tabs.canvas` — Norwegian says "Bygg" (Build). English
  rendered as "Builder" for parity with `workflow.title=Automation`;
  could also be "Canvas" if we keep the visual-canvas metaphor.
- `workflow.tabs.dryRun` — "Dry-run" is a domain term and may be
  preferred over "Test run" / "Simulation".
- `workflow.tabs.evidence` — "Evidence bundle" mirrors the Norwegian
  domain term `Bevispakke` (a signed package for audit). Consider
  "Audit bundle" or "Evidence pack" depending on partner audience.
- `workflow.stats.govSubmissionsSub` — "Rules that report to
  authorities" — verify "authorities" is the right register
  (vs. "regulators" / "government agencies").
- `workflow.stats.runs7dSome` — "Count of workflow_runs" — uses the
  internal table name; consider "Total executions" for non-technical
  audiences.
- `workflow.newRule` — "New workflow" — Norwegian says "Ny arbeidsflyt",
  matches well.

## Glossary anchors

When more pages are migrated in v1, keep these consistent:

| nb | en (proposed) |
|---|---|
| Automatisering | Automation |
| Arbeidsflyt | Workflow |
| Bevispakke | Evidence bundle / Audit pack |
| Tørrløp / Dry-run | Dry-run |
| Mal-bibliotek | Template library |
| Pålegg | Order (regulator-issued requirement) |
| Tilsyn | Inspection / Regulator |
| Bibliotek | Library |
| Bygg | Builder / Canvas |
| Kjøringer | Runs / Executions |
| Endringslogg | Change log |
| Godkjenninger | Approvals |
