# UI design rules (Dokumenter og moduler)

This project’s UI consistency is defined in:

- **`docs/UI_PLACEMENT_RULES.md`** — module shells, hub layouts, table shells, and where to place new primitives (`src/components/module/`).
- **`DESIGN_SYSTEM.md`** — shared controls: use `Button`, `StandardInput`, `SearchableSelect`, `WarningBox`, etc. from `src/components/ui/`, not ad-hoc HTML controls.

**Dokumenter — standard oversikt:** `ModuleDocumentsKandidatdetaljHub` (`centerContent="pages"`). **Malbibliotek:** `/documents/malbibliotek` med samme hub (`centerContent="templates"`). **Standard dokumentredaktør:** `/documents/page/:pageId/reference-edit` (TipTap til første tekstblokk).
