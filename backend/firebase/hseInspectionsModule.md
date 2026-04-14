# Firebase — HMS inspeksjonsmodul (anbefalt struktur)

Klienten i repoet bruker **localStorage** (`atics-hse-v2`) med samme JSON-form som anbefales lagret i Firestore.

## Suggested paths

| Path | Innhold |
|------|---------|
| `modules/hseInspections/config` | `HseInspectionConfig` (versjon, typer, maler, lokasjoner, roller, statuser, planer, avviksnivåer) |
| `modules/hseInspections/runs/{runId}` | `InspectionRun` (svar, avvik, status) |
| `templates/hseInspection/{templateId}` | (valgfritt) delt mal — ellers innebygd i `config.templates` |

## Sikkerhet

- Les/skriv med **Custom Claims** eller roller som speiler `roleRules` i konfigurasjonen.
- Valider `answers` og bilde-størrelse på server (Cloud Functions) før skriv.

## Synkronisering

- Abonner på `modules/hseInspections/config` for live oppdatering av innstillinger.
- Query `runs` med `statusId` og `inspectionTypeId` for lister og dashboard.
