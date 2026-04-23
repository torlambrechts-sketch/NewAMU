# UI design rules (Dokumenter og moduler)

This project’s UI consistency is defined in:

- **`docs/UI_PLACEMENT_RULES.md`** — module shells, hub layouts, table shells, and where to place new primitives (`src/components/module/`).
- **`DESIGN_SYSTEM.md`** — shared controls: use `Button`, `StandardInput`, `SearchableSelect`, `WarningBox`, etc. from `src/components/ui/`, not ad-hoc HTML controls.

**Dokumenter — standard oversikt:** `ModuleDocumentsKandidatdetaljHub` (mapper venstre, sider høyre, dra-og-slipp). **Standard dokumentredaktør:** TipTap-arbeidsflate på `/documents/page/:pageId/reference-edit` (tidligere «editor-test»-layout), med lagring til wiki-sidens første tekstblokk.
