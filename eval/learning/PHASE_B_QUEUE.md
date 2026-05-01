# Fase B — full komponentinntog (e-læring) ✅

**Status:** Implementert i `src/pages/learning/*` (mai 2026).

## Utført

| # | Oppgave | Merknad |
|---|---------|--------|
| B1 | Søkefelt → `StandardInput` | `LearningCoursesList`, `LearningCertifications`, `LearningParticipants` |
| B2 | `<button>` → `Button` | Alle learning-sider inkl. `LearningPlayer`, `LearningCourseBuilder`, `LearningSettings`, … |
| B3 | `<select>` → `SearchableSelect` | Kursfilter (`Participants`), kursstatus på kort (`CoursesList`) |
| B4 | `<textarea>` → `StandardTextarea` | Kursbygger (beskrivelse, I praksis-oppgaver), læringsløp (beskrivelse) |
| B5 | Sjekkbokser / boolsk → `ToggleSwitch` | Systemkurs aktiv (`Settings`), forutsetninger (`CourseBuilder`), kurs i løp (`PathsPage`), ILT-oppmøte + video bekreftelse (`Player`) |
| B6 | Rå kontroller | Kun **skjulte** `<input type="file">` for JSON-import og filopplasting ekstern opplæring (nødvendig for nettleser-API) |

## Verifisering

```bash
rg '<button|<textarea |<select' src/pages/learning   # 0 treff
rg '<input' src/pages/learning                        # kun type=file (skjult)
```

`Button`/`StandardInput`/… er definert i `src/components/ui/` og brukes konsekvent for synlige kontroller.
