# Fase D — samsvar og pedagogikk (e-læring) ✅

**Status:** UI-deler implementert (mai 2026).

## Utført

| # | Oppgave | Implementasjon |
|---|---------|----------------|
| D1 | Personvernmerknad første besøk (sessionStorage) | `src/lib/learningPrivacyAck.ts`, `LearningPrivacyNotice.tsx` på kursliste og kursvisning |
| D2 | `ComplianceBanner` på oversikt | Allerede på dashboard (fase C) |
| D3 | Navn på kursbevis | Ved `supabaseConfigured` + `profile.display_name`: felt **låst** (`StandardInput` disabled); ellers fritekst (demo) |
| D4 | Utskriftsvennlig kursbevis | `LearningCertificatePrintPage.tsx` — rute `/learning/certificates/:certId/print`, «Skriv ut» i sertifikatliste, `@media print` |

## Merk

- Full PDF-RPC, sletting av brukerdata og lovhenvisning per kurs krever backend — ikke del av denne leveransen.
