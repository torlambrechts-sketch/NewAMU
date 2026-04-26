# Document module — implementation queue

**Shipped in app (this branch):** P0, P1.1, P1.2, P1.3, **P1.4** (tabellblokk), **P1.5** (bildeopplasting til `wiki_space_files`), P2.4, P2.6, P2/P3 batch (søk, godkjenning, kommentarer, visninger, tilbakekoblinger, omtaler, TOC, print, migreringer m.m.).

---

## 1. Drift og kvalitet (gjør først)

1. **Supabase** — Kjør migrasjoner der de mangler:
   - `supabase/migrations/20260731250000_wiki_pages_full_text_search.sql`
   - `supabase/migrations/20260731260000_documents_p2_p3_features.sql`
2. **Røyktest dokumenter** — Publiser, signatur, Cmd/Ctrl+K, tabellblokk, bildeopplasting, versjon «Sammenlign», kommentarer, søk.
3. **Lagring bucket** — Bekreft at `wiki_space_files` tillater opplasting for innloggede brukere (RLS/policy). Ved `getPublicUrl` uten offentlig bucket: bytt til signert URL eller juster policy.

---

## 2. Små hull i eksisterende funksjon

4. **«Send påminnelse»** (`ComplianceDashboard`) — Fortsatt stub (`console.log`). Implementer varsling (e-post / in-app) + spor i DB, eller skjul knappen til backend finnes.

---

## 3. P3 — lang sikt (prioritert rekkefølge)

5. **P3.1** — `Claude/P3_long_term/P3.1_ai_writing_assistant.md` *(stor funksjon; ikke startet i kodebasen her)*  
6. **P3.2–P3.5** — Verifiser mot `WikiPageView` / `TipTapRichTextEditor` / `useDocuments` etter siste merge. **Forventning:** det meste er allerede på plass; åpne kun oppgaver der sjekkliste i spec fortsatt feiler.

---

## 4. Compliance C1–C12 (store, egne leveranser)

Hver fil er et eget produktområde — **én spec = én branch/PR** (`INSTRUCTIONS.md`).

7. **C1** — `Claude/compliance/C1_varslingsprosedyre.md`  
8. **C2** — `Claude/compliance/C2_bht_check.md`  
9. **C3** — `Claude/compliance/C3_leader_hms_training.md`  
10. **C4** — `Claude/compliance/C4_acknowledgement_rate.md`  
11. **C5** — `Claude/compliance/C5_verneombud_election.md`  
12. **C6** — `Claude/compliance/C6_lovregister.md`  
13. **C7** — `Claude/compliance/C7_amu_threshold.md` *(sjekk overlapp mot `ComplianceDashboard`)*  
14. **C8** — `Claude/compliance/C8_aktivitetsrapport.md`  
15. **C9** — `Claude/compliance/C9_retention_intern_prosedyre.md`  
16. **C10** — `Claude/compliance/C10_psykososialt_arbeidsmiljo.md`  
17. **C11** — `Claude/compliance/C11_amu_meeting_count.md` *(sjekk overlapp mot dashboard)*  
18. **C12** — `Claude/compliance/C12_annual_review_export.md`

---

*Oppdater denne filen når noe leveres: flytt til «Shipped» og noter PR / migrasjon.*
