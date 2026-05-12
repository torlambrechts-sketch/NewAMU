# Integrasjoner + BankID — restanse-leveranse

**Status:** Levert 2026-05-11
**Bygger på:** specs/aml-documents-content.md §17 (restanse fase 2)

## Levert i denne runden

### 1. Integrasjoner — ny admin-kategori

- **Ny fane i `AdminPage`:** «Integrasjoner» (Plug-ikon), `tab=integrations`
- **Ny tabell `org_integrations`** per-org integrasjons­konfig (kind, enabled, config jsonb, health-status)
- **Støttede kinds:** `bankid`, `eco_online`, `altinn`, `lovdata_pro`, `feide`
- **`IntegrationsAdminPanel.tsx`** — admin-UI med per-integrasjon kort, konfig-skjema, aktiver/deaktiver
- **Sikkerhets­design:** klient-hemmeligheter lagres aldri i `config`-jsonb — kun klient-ID, callback-URL, miljø. Hemmeligheter går i Supabase Vault (TODO-instruks i UI)

### 2. BankID — signering av dokumenter

- **Ny tabell `bankid_signatures`** (page-id, page-version, signer info, OIDC sub, sha256-hash av FNr, status, log)
- **View `bankid_signatures_by_page`** for aggregert signatur-status
- **`SignatureBlock.tsx`-modul** med to varianter:
  - **BankID aktivert:** Knapp som kaller `bankid-init` edge function (returnerer OIDC redirect-URL)
  - **BankID ikke aktivert:** Manuell signering (lagrer rad med note «Manuell signering»)
- Vises automatisk per part definert i `signature_block`-modulens `parties`-array
- RLS: bare org-medlemmer kan lese; signatur­rader er uforanderlige (no update/delete via klient)
- **TODO fase 3:** Faktisk edge function `bankid-init` + `bankid-callback` med OIDC flow + sertifikat­håndtering

### 3. UI-renderere for 5 nye dokument­moduler

| Modul | Komponent | Status |
|---|---|---|
| `signature_block` | `SignatureBlock.tsx` | ✅ med BankID-integrasjon |
| `revision_log` | `RevisionLog.tsx` | ✅ leser `wiki_revisions` |
| `confidentiality_marker` | `ConfidentialityMarker.tsx` | ✅ åpen/fortrolig/strengt-fortrolig |
| `contact_card` | `ContactCard.tsx` | ✅ varslings­mottak/BHT/VO/Tilsynet/Datatilsynet |
| `retention_marker` | `RetentionMarker.tsx` | ✅ kategori + min-år + lovhjemmel |

Alle innvevd i `WikiBlockRenderer.tsx` med type-safe param-mapping.

### 4. To nye dokument­maler

- **`tpl-lonnskartlegging`** (LDL § 26 a) — lønns­kartlegging hvert 2. år for ≥ 50 ansatte
- **`tpl-apenhetsloven-redegjorelse`** (Åpenhets­loven § 5) — årlig rapport om aktsomhets­vurderinger

Begge i kategorien `likestilling`, fullt utformet med metode­avsnitt, mal-tabeller for innfylling, lovhjemler.

## Restanse — fase 3

### Større innsats

- **Faktisk BankID OIDC flow:** edge functions `bankid-init` og `bankid-callback`, sertifikat­håndtering, fødselsnummer-verifisering, callback-state-håndtering. Krever BankID Merchant-avtale + test­miljø-tilgang.
- **Edge function `bankid-health-check`** som periodisk verifiserer tilkobling og oppdaterer `last_health_status` på `org_integrations`.
- **Eco-Online stoff­kartotek-synk:** Edge function som henter kjemikalie­liste + SDS-blad og speiler inn i NewAMU. Krever Eco-Online API-konto.
- **Rolle­modell­utvidelse** fra 5 til 16 funksjonelle roller per dokument-compliance-analyse. Krysser permission-system, RBAC, RLS-policy. Egen leveranse.
- **Opplærings-register-kobling** mellom `learning_courses`/`learning_progress` og `wiki_pages` — ny modul `training_matrix` som rendrer trenings­matrise i HMS-håndbok. Vurder om gjøres som modul eller som dedikert side i lærings-modulen.

### Mindre innsats

- **Altinn-integrasjon** — Maskinporten-OIDC + skjema-innsending. Pliktig for visse offentlige innsendinger.
- **Lovdata Pro-oppslag** — Direkte-link mot Lovdata Pro for verifisert lovtekst i `law_ref`-blokker.
- **Feide SSO** — For utdannings­sektor-kunder.

## Smoke-test

For å verifisere leveransen lokalt:

1. Logg inn som org-admin
2. Gå til `/admin?tab=integrations` (eller `/organisation/admin?tab=integrations`)
3. Konfigurer BankID med test-environment: `urn:bankid:test:dummy-client-id`, callback `https://localhost:5173/bankid/callback`
4. Åpne dokument med `tpl-varslingsrutine`
5. Verifiser at `signature_block`-blokken viser «Signer med BankID»-knapp
6. Klikk — får forventet feilmelding fra edge function (ikke implementert)
7. Deaktiver BankID i admin → samme dokument viser «Bekreft signering» (manuell)
8. Klikk → rad legges i `bankid_signatures` med status `completed`, note «Manuell signering»
