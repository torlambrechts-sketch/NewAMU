# Secrets inventory — NewAMU edge functions og integrasjoner

**Forfatter:** Senior dev / compliance
**Dato:** 2026-05-11
**Status:** Levende dokument — oppdater ved nye integrasjoner
**Lagring:** Alle secrets lagres i **Supabase Vault** ELLER **Edge Function Environment Variables** — aldri i `org_integrations.config` jsonb.

---

## 1. Prinsipper

1. **Aldri i klartekst i databasen.** `org_integrations.config` holder bare offentlig info: klient-ID, callback-URL, miljø.
2. **Aldri i Git.** Secrets settes manuelt via `supabase secrets set` eller via Supabase Vault.
3. **Rotasjon planlagt.** Hver secret har dokumentert rotasjons­regel og frist.
4. **Revocation-prosedyre.** Hver secret har dokumentert hvordan den tilbakekalles ved kompromittering.
5. **Least privilege.** Hver edge function har egen secret-tilgang — ikke shared blanket-secrets.

---

## 2. Aktive secrets

### 2.1 `COMPLIANCE_CRON_SECRET`
- **Brukes av:** `role-compliance-reconcile` edge function
- **Type:** Shared secret string (UUID anbefales)
- **Lagring:** Edge function env via `supabase secrets set COMPLIANCE_CRON_SECRET=...`
- **Rotasjon:** Hver 12. måned, eller umiddelbart ved mistanke om kompromittering
- **Revocation:** `supabase secrets unset COMPLIANCE_CRON_SECRET` + generer ny
- **Tilgjengelig for:** Cron-jobben som kaller funksjonen

### 2.2 `COMPLIANCE_ADMIN_SECRET`
- **Brukes av:** `role-compliance-reconcile` edge function (admin-mode for å reconcile én org)
- **Type:** Shared secret string
- **Lagring:** Edge function env
- **Rotasjon:** Hver 6. måned (mer brukt enn cron)
- **Revocation:** Som over
- **Tilgjengelig for:** DevOps / org-admin under troubleshooting

### 2.3 `BANKID_CLIENT_SECRET` (FASE 5 — ikke aktiv ennå)
- **Brukes av:** `bankid-init`, `bankid-callback`
- **Type:** OIDC client secret fra Vipps BankID
- **Lagring:** Supabase Vault (anbefalt) eller edge function env
- **Rotasjon:** Etter Vipps' policy (typisk årlig)
- **Revocation:** Via Vipps BankID-portal + `unset` lokalt
- **Tilgjengelig for:** Bare bankid-* edge functions

### 2.4 `BANKID_PRIVATE_KEY` (FASE 5 — ikke aktiv ennå)
- **Brukes av:** `bankid-init` (for client_assertion JWT)
- **Type:** PKCS#8 PEM-encoded private key (X.509 sertifikat)
- **Lagring:** Supabase Vault (PEM som secret value)
- **Rotasjon:** Når sertifikat utløper (typisk 2 år)
- **Revocation:** Via Vipps BankID-portal — revoke + ny CSR
- **Tilgjengelig for:** Bare bankid-* edge functions

### 2.5 `MINID_CLIENT_SECRET` (FASE 5 — ikke aktiv ennå)
- **Brukes av:** `idporten-init`, `idporten-callback`
- **Type:** OIDC client secret fra Digdir
- **Lagring:** Edge function env
- **Rotasjon:** Etter Digdir-policy
- **Revocation:** Via Digdir Self-Service-portal

### 2.6 `ALTINN_MASKINPORTEN_PRIVATE_KEY` (FASE 5 — ikke aktiv ennå)
- **Brukes av:** `datatilsynet-breach-report`, framtidig `nav-yrkesskade-report`
- **Type:** PKCS#8 PEM-encoded private key
- **Lagring:** Supabase Vault
- **Rotasjon:** Når sertifikat utløper (2 år)
- **Revocation:** Via Digdir Self-Service-portal

### 2.7 `ECO_ONLINE_API_TOKEN` (FASE 5 — ikke aktiv ennå)
- **Brukes av:** `eco-online-sync` (planlagt)
- **Type:** Bearer-token fra Eco-Online API
- **Lagring:** Edge function env per org (hver org har egen Eco-Online-konto)
- **Pattern:** Lagres som `ECO_ONLINE_API_TOKEN__<org_id>` for å støtte multi-tenant
- **Rotasjon:** Eco-Online sin policy
- **Revocation:** Via Eco-Online portal

### 2.8 `LOVDATA_API_TOKEN` (FASE 5 — ikke aktiv ennå)
- **Brukes av:** `lovdata-pro-sync` (planlagt)
- **Type:** API-token fra Lovdata Pro
- **Lagring:** Edge function env per org

### 2.9 `FEIDE_SP_PRIVATE_KEY` (FASE 5 — ikke aktiv ennå)
- **Brukes av:** Feide SAML SP-flow (planlagt)
- **Type:** PKCS#8 PEM
- **Lagring:** Supabase Vault

### 2.10 `MEETINGS_CRON_SECRET` (aktiv — Sprint-1)
- **Brukes av:** `send-meeting-invites` edge function (reminder-sweep cron)
- **Type:** Shared secret string (UUID anbefales)
- **Lagring:** Edge function env via `supabase secrets set MEETINGS_CRON_SECRET=...`
- **Rotasjon:** Hver 12. måned
- **Revocation:** `supabase secrets unset MEETINGS_CRON_SECRET` + generer ny
- **Tilgjengelig for:** Cron-jobben som kaller funksjonen
- **Co-deps:** Funksjonen leser også `RESEND_API_KEY`, `RESEND_FROM`, `PUBLIC_APP_URL`, `EMAIL_SEND_DELAY_MS` — gjenbruk allerede satt for `send-survey-invites`.

### 2.11 `send-meeting-digest` secrets (aktiv — §8.34)
- **Brukes av:** `send-meeting-digest` edge function (post-signing protokoll-digest)
- **Type:** Ingen nye secrets — gjenbruker `RESEND_API_KEY`, `RESEND_FROM`, `PUBLIC_APP_URL`
- **Caller-driven only:** Ingen cron-secret; funksjonen krever user-JWT i Authorization-header (chair kaller fra Protokoll-tabben etter signering)

---

## 3. Tilgang og kontroll

| Rolle | Får tilgang til | Hvordan |
|---|---|---|
| DevOps-team | Alle | `supabase secrets list` |
| Edge function (runtime) | Bare egen secret-namespace | `Deno.env.get(...)` |
| Org-admin (UI) | Ingen secrets direkte | Kan toggle integrasjons-`enabled`-flagg |
| DPO | Kan se status av brudd-relevante integrasjoner | Via admin-UI, ikke direkte secret |

---

## 4. Audit og logging

- Hver edge function logger inn­kallings­tidspunkt og hvilke secrets som ble brukt (uten å logge selve verdien)
- Supabase Logs viser secret-tilgang
- Cron-runs lagres i `cron_run_log` (planlagt fase 5)

---

## 5. Compliance-perspektiv

- **GDPR Art. 32 (sikkerhet):** Krypterte secrets i Vault oppfyller «egnede tekniske tiltak»
- **GDPR Art. 25 (innebygd personvern):** Klart skille mellom public config (org_integrations) og secrets
- **Tilsyns-eksport:** Vault-secrets eksporteres ALDRI — bare integrasjons-konfigurasjon (`enabled`/`callback_url` osv.)

---

## 6. Rutine ved kompromittering

1. Identifiser hvilken secret er kompromittert
2. Revoke hos provider (Vipps/Digdir/Eco-Online portal)
3. `supabase secrets unset <name>` for å fjerne fra edge function
4. Generer ny via provider-portal
5. `supabase secrets set <name>=<new_value>`
6. Loggfør i `audit_ledger` med tidspunkt og årsak
7. Hvis brudd-mistanke: opprett `gdpr_breach_incidents`-record automatisk

---

## 7. Sjekkliste før ny integrasjon

- [ ] Secret-navn følger konvensjon: `<SYSTEM>_<TYPE>` (eks: `BANKID_CLIENT_SECRET`)
- [ ] Secret lagret i Vault eller env, IKKE i database
- [ ] Rotasjons­plan dokumentert her
- [ ] Revocation-prosedyre dokumentert her
- [ ] Edge function har minst mulig tilgang (least privilege)
- [ ] Audit-logging på inn­kalling
- [ ] Test-miljø-versjon adskilt fra produksjon (typisk separat secret)
