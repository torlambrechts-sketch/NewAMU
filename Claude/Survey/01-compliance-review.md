# Survey Module — Compliance Review
*Perspective: Norwegian labour law, GDPR, Åpenhetsloven*
*Date: 2026-04-29*

---

## C1 · Keyword-based AML § 4-3 detection is fragile

**File:** `SurveyPage.tsx:38-43`, `useSurvey.ts:1179`

The function `isMandatoryAml4_3` uses five hardcoded Norwegian keywords to decide whether a question is legally mandatory:

```ts
const AML_4_3_MANDATORY_KEYWORDS = ['trakassering', 'integritet', 'medvirkning', 'sikkerhet', 'psykososial']
```

**Problems:**
- The same array is duplicated in two files — one change does not update the other.
- English-language questions (e.g. from legacy templates) will never be flagged.
- Broad keywords like `sikkerhet` will match irrelevant questions ("IT-sikkerhet").
- A question explicitly authored as mandatory in the template `body` will lose that flag if the keyword match fails.

**Recommendation:** Mark mandatory questions in the template catalog's `body.questions[].required` field (add an `is_mandatory` boolean and `mandatory_law` string). `catalogQuestionToUpsert` should read those fields directly, and the keyword fallback should be removed.

---

## C2 · AMU signing accepts any typed name — no identity link

**File:** `SurveyAmuTab.tsx:192-210`

The AMU protocol signature is just a free-text name field. Any user with `survey.manage` can type any name and click "Signer som AMU-leder". There is no link to the authenticated user's identity, no email confirmation, and no audit trail beyond the `amu_chair_name` column.

**AML § 7-2(2)(e)** requires that the AMU has *behandlet* (processed) the results. A typed name in a text box provides weak evidence of this.

**Recommendation:**
- Prepopulate the name field from the authenticated user's profile (`display_name`).
- Store `auth.uid()` alongside `amu_chair_name` in a new `amu_chair_user_id` column.
- Show the current authenticated user's name as read-only and require them to confirm it is correct before signing.

---

## C3 · Anonymity threshold is UI-only — no database enforcement

**File:** `SurveyDetailView.tsx:315`, `surveyAnalytics.ts`

The k-anonymity threshold (default: 5) is applied only in the `AnalyseTab` React component. Raw answers are accessible directly via the `org_survey_answers` table to any authenticated manager. A user with direct Supabase access (or a custom query) can read individual answers even for anonymous surveys.

**GDPR Art. 25 (data protection by design)** requires that protection is built into the processing, not just the display layer.

**Recommendation:**
- Create a Postgres view `survey_question_analytics` that only returns aggregated data where `count >= anonymity_threshold`. Expose this view via PostgREST instead of the raw answers table.
- Alternatively, add a server-side RLS policy on `org_survey_answers` that blocks individual row access after a survey is closed.

---

## C4 · External / vendor surveys — no vendor-side verification

**File:** `SurveyLeverandorerTab.tsx`, `SurveyPage.tsx:396-421`

An external survey is just a regular survey with `survey_type = 'external'`. There is no mechanism to:
- Send the survey to the vendor (no email/link generation).
- Confirm the vendor filled it out (any internal user can submit responses).
- Attach the vendor's organization number to the *response*, only to the survey.

**Åpenhetsloven § 4** requires documentation from *leverandøren* (the supplier). An internally-completed "vendor survey" provides no such documentation.

**Recommendation:**
- Add a public-link respondent flow with a token scoped to `vendor_org_number`. The vendor follows the link and submits without needing a Klarert account.
- Record the IP address and timestamp on the response row as the submission attestation.
- Display a "Sendt til leverandør / Mottatt" status on the Leverandører table.

---

## C5 · No data retention / deletion mechanism

**Files:** All survey tables via migrations.

Survey answers, responses, and even closed surveys are stored indefinitely. There is no:
- Retention period field on surveys.
- Scheduled deletion or anonymization workflow.
- Data-minimization pathway for `archived` surveys.

**GDPR Art. 5(1)(e)** (storage limitation) requires that personal data is kept no longer than necessary. For psychosocial surveys with identifiable responses, this is typically 2–5 years.

**Recommendation:**
- Add a `retention_months` column to `surveys` (default: 60).
- Create a scheduled Supabase Edge Function that nulls out `user_id` on `org_survey_responses` and deletes `answer_text` on `org_survey_answers` after the retention period.

---

## C6 · Duplicate anonymous responses are not blocked

**File:** `useSurvey.ts:953-1031` (`submitResponse`)

The unique index `org_survey_responses_user_survey_uidx` only prevents duplicates where `user_id IS NOT NULL`. Anonymous respondents can submit multiple times because the constraint is filtered:

```sql
create unique index ... where user_id is not null;
```

A disgruntled employee could submit the same anonymous survey dozens of times, skewing results that feed into legally-required compliance reporting.

**Recommendation:**
- For anonymous surveys, issue a single-use token (stored server-side) tied to the invite/distribution. Invalidate the token on first submission.
- Alternatively, use a browser fingerprint + server-side rate limiting as a lighter backstop.

---

## C7 · Action plan due dates are optional — IK-forskriften § 5 requires follow-up

**File:** `SurveyTiltakTab.tsx:200-205`

Action plan due dates (`due_date`) are entirely optional in both the UI and the database schema. IK-forskriften § 5 requires that corrective actions have a defined deadline and a responsible person.

**Recommendation:**
- Make `due_date` and `responsible` required fields when creating a new action plan tied to a closed survey.
- Add a compliance indicator on the Oversikt tab when open action plans have no due date.

---

## C8 · Protocol can be edited after first signature

**Migration:** `20260801100000_survey_additions.sql:142-146`

The RLS update policy for `survey_amu_reviews` allows modification when `amu_chair_signed_at IS NULL OR vo_signed_at IS NULL`. This means after the AMU chair signs, the verneombud can still update the `protocol_text` before signing. They sign a potentially different document than what the chair approved.

**Recommendation:**
```sql
-- Block all field edits once any signature is present
create policy survey_amu_reviews_update
  on public.survey_amu_reviews for update to authenticated
  using (
    organization_id = public.current_org_id()
    and amu_chair_signed_at is null
    and vo_signed_at is null
  );
```

---

## C9 · "Kampanjer" / module terminology inconsistent with legal language

**File:** `SurveyPage.tsx:215`

The tab label "Kampanjer" (campaigns) is a marketing term. Norwegian labour law uses "kartlegging" (mapping/survey) or "undersøkelse". Using "kampanje" could undermine the legal seriousness of the process in an audit context.

**Recommendation:** Rename to "Undersøkelser" or "Kartlegginger" in the tab label.

---

## C10 · AMU tab available on external (vendor) surveys

**File:** `SurveyDetailView.tsx:670`

The AMU-gjennomgang tab is shown for all survey types including `external`. Vendor surveys do not need AMU treatment under AML § 7-2. Showing the tab creates confusion and may lead managers to incorrectly believe vendor surveys require AMU sign-off.

**Recommendation:** Hide the AMU and Handlingsplan tabs when `s.survey_type === 'external'`. External surveys have their own follow-up workflow under Åpenhetsloven.
