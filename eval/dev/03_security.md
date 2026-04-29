# Developer Pass — 03: Security

**Role:** Developer  
**Focus:** XSS, injection, authorisation, data access, file uploads

---

## XSS risks

### `dangerouslySetInnerHTML` usage

**Files:**
- `LearningPlayer.tsx` L685: `dangerouslySetInnerHTML={{ __html: html }}`
- `LearningPlayer.tsx` L410: `dangerouslySetInnerHTML={{ __html: instructionsHtml }}`
- `LearningPlayer.tsx` L813: `dangerouslySetInnerHTML={{ __html: otherHtml }}`

**Sanitization chain:**
1. `sanitizeLearningHtml` from `src/lib/sanitizeHtml.ts`
2. `normalizeModuleHtml` from `src/lib/richTextDisplay.ts`

Let me evaluate the sanitizer:

The `sanitizeHtml.ts` file exists in the codebase. The key question is: what does it allow?

**Assessment:** Cannot fully assess without reading `sanitizeHtml.ts`, but the pattern is correct — sanitize before inject. However:
- The sanitizer must be audited against the DOMPurify/sanitize-html allowlist
- If the sanitizer allows `<img>` with `onerror`, `<a href="javascript:...">`, or `<svg>` with inline scripts, XSS is possible
- Course content comes from course builders (privileged users) — lower XSS risk than user-submitted content, but still should be hardened

**Recommendation:** Verify sanitizer uses DOMPurify or equivalent. Add test for common XSS payloads.

---

### Certificate `verifyCode` — no CSRF protection on issuance

`issueCertificate` in `useLearning.ts` calls `supabase.rpc('learning_issue_certificate', ...)`.

The Supabase RPC runs server-side, so CSRF protection from the Supabase JWT is in effect ✅.

However, the local (non-Supabase) path allows certificate issuance with no server validation:
```ts
// Local path: no server check — trust client-side `modulesComplete`
const allDone = course.modules.every((m) => prog?.moduleProgress[m.id]?.completed)
if (!allDone) return s
```

This is appropriate for demo mode, but the comment "Not a legally binding credential" in `LearningCertifications.tsx` should be more explicit in the UI about this distinction.

---

## Authorisation

### `learning.manage` permission gating

The module correctly gates manager-only features behind `can('learning.manage')`:
- Course creation ✅
- Module editing ✅
- System course admin ✅
- Compliance matrix ✅
- External cert approval ✅
- ILT attendance marking ✅

**Issue found:** `canManageLearning` in `LearningPlayer.tsx` gates peer attendance marking (line 458), but the `peerProfiles` query (line 58-75) still runs even for non-managers if `canManageLearning` check changes mid-session. The condition is `!canManageLearning || !supabase || !organization?.id` — this is correct, returns early ✅.

### Cross-organisation data isolation

All queries include `.eq('organization_id', orgId)` — ✅ correct.

**Exception found:** `learning_ilt_attendance` query (in `EventModuleSection`):
```ts
const { data } = await supabase
  .from('learning_ilt_attendance')
  .select('user_id, present')
  .eq('event_id', ev.id)
```

**No `organization_id` filter.** If `ev.id` is from another organisation (unlikely with proper RLS, but belt-and-suspenders), attendance data could leak.

**Recommendation:** Add `.eq('organization_id', organization.id)` to this query. Or rely exclusively on Supabase RLS (which should scope this by default).

### `deleteModule` — no ownership check

`useLearning.ts` line 1229:
```ts
await supabase
  .from('learning_modules')
  .delete()
  .eq('id', moduleId)
  .eq('course_id', courseId)
  .eq('organization_id', orgId)
```

The `organization_id` check is present ✅. RLS should also enforce this on the server.

---

## File upload security

`LearningExternalTraining.tsx`:
- Client-side MIME check: `accept="application/pdf,image/*"` — browser only, easily bypassed
- No server-side file type validation visible in the frontend code
- Upload path: `${userId}/${uuid}.${ext}` where `ext` is taken from filename

**Concern:** `safeExt` logic in `useLearning.ts` line 1721:
```ts
const ext = input.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
const safeExt = ext.length <= 8 ? ext : 'bin'
```

This only validates length, not content type. A file named `malware.js` would be stored as `malware.js` in the bucket. If the bucket serves files with permissive Content-Type headers, this could enable stored XSS.

**Recommendation:**
```ts
const ALLOWED_EXTS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])
const safeExt = ALLOWED_EXTS.has(ext) ? ext : 'bin'
```

Also add a Supabase Edge Function to validate MIME type server-side before committing the upload.

---

## Input validation

### Course title / description
`createCourse` and `updateCourse` do client-side `.trim()` only. No length limits enforced client-side.

**Recommendation:** Enforce max lengths matching DB constraints (e.g., `maxLength={200}` on title input).

### `learnerName` on certificate
Freetext, no length limit, no sanitisation. Stored directly in DB. If the DB column is `VARCHAR(255)`, very long names will be truncated server-side but no client feedback.

**Recommendation:** Add `maxLength={120}` on the input and validate before submission.

### Module order numbers
`reorderModules` sends an array of UUIDs trusted from client state. The server-side RPC should validate that all provided IDs belong to the specified `course_id` and `organization_id`.

---

## Supabase RLS dependency

The module relies heavily on Supabase RLS for data isolation. If RLS is disabled or misconfigured, all organisation data becomes accessible to authenticated users.

**Critical RPCs that must have SECURITY INVOKER + RLS:**
- `learning_department_leaderboard` — must scope to caller's org
- `learning_compliance_matrix` — must scope to caller's org AND check `learning.manage`
- `learning_issue_certificate` — must verify module completion server-side
- `learning_approve_external_certificate` — must verify manager role

**Recommendation:** Audit each RPC's `SECURITY` setting and ensure none bypass RLS with `SECURITY DEFINER` unless explicitly scoped.

---

## Secret management

`LearningSettings.tsx` stores Teams/Slack webhook URLs in `learning_flow_settings`:
```ts
teams_webhook_url: teamsDisplay.trim() || null,
slack_webhook_url: slackDisplay.trim() || null,
```

These are stored as plaintext in the DB. Webhook URLs are effectively secrets — anyone with DB read access can use them to post to the organisation's Slack/Teams.

**Recommendation:**
1. In production: store webhook URLs as Supabase secrets (Vault) or environment variables in Edge Functions
2. In the UI: mask the displayed URL after save (show only last 8 characters)
3. Document that column `learning_flow_settings` should have column-level encryption in production

---

## Dependency: `sanitizeLearningHtml`

Cannot fully audit without reading the file, but this is the most security-critical function in the module.

**Required audit items:**
- Is `DOMPurify` or `sanitize-html` used (not a custom regex sanitizer)?
- Does it strip `javascript:` href values?
- Does it strip `data:` href values?
- Does it prevent `<script>` tags?
- Does it prevent `style` attributes with `expression()` (IE)?
- Does it strip `onerror`, `onload`, `onclick` attributes?
