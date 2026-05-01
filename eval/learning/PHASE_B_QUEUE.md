# Fase B — kø (full komponentinntog, e-læring)

**Forutsetning:** Fase A fullført i kode (varsler, språk, k-anonymitet, kursbevis-UX).

Utfør i anbefalt rekkefølge; hver rad kan bli egen PR.

| # | Oppgave | Filer (startliste) |
|---|---------|---------------------|
| B1 | Erstatt søkefelt med `StandardInput` (+ eventuelt felles søkerad) | `LearningCoursesList.tsx`, `LearningCertifications.tsx`, `LearningParticipants.tsx` |
| B2 | Alle gjenværende `<button>` → `Button` | Alle `src/pages/learning/*.tsx`, ev. `LearningFlowEntry.tsx` |
| B3 | `<select>` → `SearchableSelect` | `LearningParticipants.tsx`, `LearningCoursesList.tsx` |
| B4 | `<textarea>` → `StandardTextarea` | `LearningCourseBuilder.tsx`, `LearningPathsPage.tsx`, `LearningExternalTraining.tsx` |
| B5 | Sjekkbokser / boolsk → `YesNoToggle` der passende | `LearningPlayer.tsx` (ILT), `LearningCourseBuilder.tsx`, `LearningSettings.tsx`, `LearningPathsPage.tsx` |
| B6 | Etter B2–B5: `rg '<button|<input |<textarea |<select '` i `src/pages/learning` skal være **0** treff (unntatt skjult file input der nødvendig) | — |

**Verifisering etter B:** `rg "from ['\\\"].*components/ui" src/pages/learning` skal treffe alle relevante imports; ingen `alert(` i learning.
