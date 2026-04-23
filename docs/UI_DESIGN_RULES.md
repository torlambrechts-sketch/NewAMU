# UI design rules (Dokumenter og moduler)

This project’s UI consistency is defined in:

- **`docs/UI_PLACEMENT_RULES.md`** — module shells, hub layouts, table shells, and where to place new primitives (`src/components/module/`).
- **`DESIGN_SYSTEM.md`** — shared controls: use `Button`, `StandardInput`, `SearchableSelect`, `WarningBox`, etc. from `src/components/ui/`, not ad-hoc HTML controls.

**Dokumenter — én ramme:** `DocumentsModuleShellLayout` med `ModulePageShell` + `DocumentsHubSecondaryNav` (Dokumenter, Malbibliotek, Samsvar, Årsgjennomgang, Innstillinger). **Dokumenter-hub:** `ModuleDocumentsKandidatdetaljHub` (`centerContent="pages"`). **Malbibliotek:** `/documents/malbibliotek` (`centerContent="templates"`, kun malmapper i venstre kolonne). **Standard dokumentredaktør:** `/documents/page/:pageId/reference-edit` (TipTap; ingen duplikat topptekst — `showHeader={false}`). Primærknapper: `Button` **default**-størrelse (som SJA «Ny analyse»), ikke `size="sm"`.

---

## Handlinger — justering (Dokumenter / malbibliotek)

Følg samme mønster som `WorkplacePageHeading1` / `ModulePageShell.headerActions`:

1. **Rad med tittel + handlinger:** `flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between` — tekst `min-w-0`, handlinger i egen kolonne.
2. **Knappegruppe:** `flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end` — høyrejustert på store skjermer, linjebryting med jevn `gap-2`.
3. **Rekkefølge:** sekundær(e) til venstre, **primær til høyre** innenfor gruppen (siste i DOM for «hovedhandling» ytterst til høyre), samme som SJA-modulens toppknapper.
4. **Ikke** bruk `sm:`-breakpoint alene for denne spliten når `lg:` allerede brukes i page shell — bruk `lg:` for konsistens med `WorkplacePageHeading1`.

Dialogskjemaer (Ny mal, Rediger mal, hub «Ny mappe»): knapperad `flex flex-wrap items-center justify-end gap-2` med **Avbryt** (secondary) før **Lagre / Opprett** (primary), default `Button`-størrelse der det er hovedhandlinger.
