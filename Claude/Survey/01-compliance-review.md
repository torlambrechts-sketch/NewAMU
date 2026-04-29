# Survey Module — Compliance Review (v2)
*Perspective: Norwegian labour law, GDPR, Åpenhetsloven*
*Date: 2026-04-29 · Updated after main merge*

---

## C1 · Keyword-based AML § 4-3 detection is fragile (open)

**File:** `SurveyPage.tsx:38-43`, `useSurvey.ts` (applyTemplateToSurvey)

The function `isMandatoryAml4_3` uses five hardcoded Norwegian keywords to classify questions as legally mandatory. The same array is duplicated in two files and misses English-language questions, dialect variants, and broad matches like `sikkerhet` ("IT-sikkerhet" would also match). Nothing changed here in the main update.

**Recommendation:** Mark mandatory questions in the template catalog's `body.questions[].is_mandatory` and `mandatory_law` fields. `catalogQuestionToUpsert` reads those fields directly; the keyword fallback is removed. Export a single `isAml4_3Mandatory` from `surveyCompliance.ts` as the only allowed call site.

---

## C2 · AMU signing accepts any typed name — no identity link (open)

**File:** `SurveyAmuTab.tsx`

Any user with `survey.manage` can type any name in the AMU chair or verneombud text field and sign. There is no link to the authenticated user's `auth.uid()` and no audit trail beyond the stored name string. AML § 7-2(2)(e) requires demonstrable AMU treatment of survey results.

**Recommendation:**
- Add `amu_chair_user_id uuid references auth.users(id)` and `vo_user_id uuid` to `survey_amu_reviews`.
- Prepopulate the name field from the authenticated user's `display_name` (read-only).
- Require the user to confirm identity before the sign action is enabled.
- Set `amu_chair_user_id = auth.uid()` in the DB update, not just the name string.

---

## C3 · k-anonymity is UI-only — no database enforcement (open)

**File:** `SurveyDetailView.tsx` AnalyseTab, `surveyAnalytics.ts`

The anonymity threshold (default: 5) is applied only in the React `AnalyseTab`. A user with direct Supabase access or the PostgREST API can read individual `org_survey_answers` rows. GDPR Art. 25 (data protection by design) requires protection to be built into the data layer.

**Recommendation:** Create a Postgres view `survey_question_analytics` that aggregates only when `count >= anonymity_threshold`. Expose this through a PostgREST endpoint and replace the raw `org_survey_answers` reads in the analytics tab. Alternatively, add an RLS policy that returns `null` for `answer_text` and `answer_value` on individual rows once the survey is closed.

---

## C4 · Vendor survey distribution exists but token enforcement is incomplete (partial ✅)

**Files:** `tabs/SurveyDistribusjonTab.tsx`, `surveyInviteLink.ts`, migrations `20260802120006`, `20260802120007`

**Progress:** The main update added a full distribution engine with audience selection (all org, departments, teams, locations), per-profile invitation tokens, and a `SurveyPendingInvitesBanner` that shows pending surveys to invited users.

**Remaining gaps:**

1. **External (vendor) surveys still have no vendor-specific token path.** The distribution tab selects from internal `orgProfiles` — a vendor with no Klarert account cannot receive or complete an invitation through this system.
2. **No status tracking on the vendor response.** `SurveyInvitationRow.status` tracks `pending | completed` for internal users, but for external surveys the vendor submits via an unauthenticated public link. There is no record tying the response back to the vendor's `vendor_org_number`.

**Recommendation:** For `survey_type = 'external'`, replace the audience selector with an "external respondent" form: email + vendor_org_number. Generate a public access token (like `randomSurveyInvitationToken`) scoped to that org number. When the vendor submits, record `vendor_org_number` on the response row. Display submission status on the Leverandører table.

---

## C5 · No data retention / GDPR deletion mechanism (open)

**Files:** All survey tables. No change in main update.

Survey answers and responses are stored indefinitely with no retention period, scheduled anonymization, or data-minimization workflow for archived surveys. GDPR Art. 5(1)(e) (storage limitation) applies to psychosocial survey responses which may be treated as sensitive data.

**Recommendation:**
- Add `retention_months int default 60` to `surveys`.
- Create a scheduled Supabase Edge Function that nulls `user_id` on `org_survey_responses` and clears `answer_text` on `org_survey_answers` after `retention_months` from `closed_at`.

---

## C6 · Anonymous survey duplicate submissions not blocked (open)

**Migration:** `20260801100000_survey_additions.sql:53-55`

The unique index prevents duplicate submissions only `WHERE user_id IS NOT NULL`. Anonymous respondents can submit multiple times, skewing compliance-critical results.

**Recommendation:** Issue single-use tokens for each invited respondent (now supported via `survey_invitations.access_token`). For non-invited anonymous surveys, use a server-side rate-limit or a browser-local submission record (`localStorage`) as a lightweight backstop.

---

## C7 · Action plan due dates optional — IK-forskriften § 5 (open)

**File:** `SurveyTiltakTab.tsx`

IK-forskriften § 5 requires corrective actions to have a defined deadline and responsible person. Both remain optional in the form and database schema. No change in main update.

**Recommendation:** Make `due_date` and `responsible` required fields when `survey.status === 'closed'`. Show a compliance warning on the Oversikt tab when open action plans have no due date.

---

## C8 · AMU protocol editable after first signature — RLS gap (open)

**Migration:** `20260801100000_survey_additions.sql`

The `survey_amu_reviews_update` policy allows modification when either signature is absent. After the chair signs, the verneombud can change the protocol text before signing — a different document from what was approved.

**Fix:**
```sql
create policy survey_amu_reviews_update
  on public.survey_amu_reviews for update to authenticated
  using (
    organization_id = public.current_org_id()
    and amu_chair_signed_at is null
    and vo_signed_at is null
  );
```

---

## C9 · "Kampanjer" label — non-legal terminology (open)

**File:** `SurveyPage.tsx`

"Kampanjer" (campaigns) is a marketing term. Norwegian labour law uses "kartlegging" or "undersøkelse". No change in main update.

**Recommendation:** Rename tab to "Undersøkelser" or "Kartlegginger".

---

## C10 · AMU and Tiltak tabs visible on vendor (external) surveys (open)

**File:** `SurveyDetailView.tsx`

The tab list is the same for all survey types. AMU treatment (AML § 7-2) does not apply to vendor surveys; showing these tabs creates confusion and potential mis-categorization in audit trails.

**Recommendation:** Conditionally exclude the `amu` and `tiltak` tabs when `s.survey_type === 'external'`. For external surveys, show a dedicated "Leverandøroppfølging" tab instead.
