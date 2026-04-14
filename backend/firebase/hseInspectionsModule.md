# HMS inspeksjonsdata — lagring

**Primær:** Supabase Postgres — tabell `app_hse_state` (se `supabase/migrations/`). Klienten synker hele HSE-payloaden (vernerunder, klassiske inspeksjoner, hendelser, inspeksjonsmodul) når `VITE_SUPABASE_*` er satt.

**Alternativ / arkivert:** Firebase Firestore — samme JSON-form kan speiles dit ved behov.

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
