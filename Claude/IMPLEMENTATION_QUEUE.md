# Document module — implementation queue

**Last merged to `main` (local):** documents batch (P0, P1.1, P1.2, P1.3, P2.4, P2/P3 features, migrations) + merge resolutions. **Update this file** when you ship another slice.

## Operational (do before / alongside code)

1. **Supabase migrations** — Apply on each environment if not already:
   - `supabase/migrations/20260731250000_wiki_pages_full_text_search.sql`
   - `supabase/migrations/20260731260000_documents_p2_p3_features.sql`  
   *(Search RPC, reviews, comments, nested spaces, views, backlinks, mention notifications, etc.)*

2. **Smoke-test documents flows** — Publish, ack receipts, Cmd/Ctrl+K search, reviews inbox, nested folders, version **Sammenlign**, comments.

## Gaps / follow-ups (small, not full Claude specs)

3. **«Send påminnelse»** — Still a **stub** (`console.log` only) on compliance kvitteringer (P1.2). Replace with real notification or remove until backend exists.

4. **Spec vs code: P3.2–P3.5** — Read each spec once; confirm behaviour matches UI (`WikiPageView`, `TipTapRichTextEditor`, `useDocuments`). File issues only for real deltas.

## Queue — P1 (specs not yet implemented in app)

5. **P1.4** — `Claude/P1_high_value/P1.4_table_block.md`  
6. **P1.5** — `Claude/P1_high_value/P1.5_image_upload.md`

## Queue — P3 (long term; implement after P1 unless audit finds blocking gaps)

7. **P3.1** — `Claude/P3_long_term/P3.1_ai_writing_assistant.md`  
8. **P3.2** — `Claude/P3_long_term/P3.2_document_analytics.md` *(verify first)*  
9. **P3.3** — `Claude/P3_long_term/P3.3_backlinks.md` *(verify first)*  
10. **P3.4** — `Claude/P3_long_term/P3.4_mentions.md` *(verify first)*  
11. **P3.5** — `Claude/P3_long_term/P3.5_table_of_contents.md` *(verify first)*

## Queue — compliance (Norwegian labour law gaps; after core P1/P3)

12. **C1** — `Claude/compliance/C1_varslingsprosedyre.md`  
13. **C2** — `Claude/compliance/C2_bht_check.md`  
14. **C3** — `Claude/compliance/C3_leader_hms_training.md`  
15. **C4** — `Claude/compliance/C4_acknowledgement_rate.md`  
16. **C5** — `Claude/compliance/C5_verneombud_election.md`  
17. **C6** — `Claude/compliance/C6_lovregister.md`  
18. **C7** — `Claude/compliance/C7_amu_threshold.md` *(may overlap `ComplianceDashboard` — reconcile)*  
19. **C8** — `Claude/compliance/C8_aktivitetsrapport.md`  
20. **C9** — `Claude/compliance/C9_retention_intern_prosedyre.md`  
21. **C10** — `Claude/compliance/C10_psykososialt_arbeidsmiljo.md`  
22. **C11** — `Claude/compliance/C11_amu_meeting_count.md` *(may overlap dashboard — reconcile)*  
23. **C12** — `Claude/compliance/C12_annual_review_export.md`

---

*One spec per branch/PR unless a spec declares a dependency (`INSTRUCTIONS.md`).*
