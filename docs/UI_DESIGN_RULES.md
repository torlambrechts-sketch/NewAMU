# UI design rules (Dokumenter og moduler)

This project’s UI consistency is defined in:

- **`docs/UI_PLACEMENT_RULES.md`** — module shells, hub layouts, table shells, and where to place new primitives (`src/components/module/`).
- **`DESIGN_SYSTEM.md`** — shared controls: use `Button`, `StandardInput`, `SearchableSelect`, `WarningBox`, etc. from `src/components/ui/`, not ad-hoc HTML controls.

**Dokumenter — én ramme:** `DocumentsModuleShellLayout` med `ModulePageShell` + `DocumentsHubSecondaryNav` (Dokumenter, Malbibliotek, Samsvar, Årsgjennomgang, Innstillinger). **Dokumenter-hub:** `ModuleDocumentsKandidatdetaljHub` (`centerContent="pages"`). **Malbibliotek:** `/documents/malbibliotek` (`centerContent="templates"`, kun malmapper i venstre kolonne). **Standard dokumentredaktør:** `/documents/page/:pageId/reference-edit` (TipTap; ingen duplikat topptekst — `showHeader={false}`). Primærknapper: `Button` **default**-størrelse (som SJA «Ny analyse»), ikke `size="sm"`.
