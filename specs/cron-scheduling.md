# Cron-scheduling for compliance-edge-functions

**Status:** Setup-instruks
**Avhengig av:** Supabase Scheduled Functions (eller alternativ cron-mekanisme)

NewAMU har 3 edge functions som bør kjøres på faste intervaller:

| Function | Anbefalt schedule | Hvorfor |
|---|---|---|
| `role-compliance-reconcile` | Daglig 02:00 | Materialiser nye krav, marker fullført/overdue/superseded |
| `compliance-notification-scan` | Hver time | Detekter nye situasjoner og opprett varsler |
| `documents-acknowledgement-reminders` | Daglig 09:00 | Eksisterende — påminnelser om kvittering |
| `documents-notification-digest` | Hver time | Eksisterende — e-post-digest |

---

## 1. Supabase Scheduled Functions (anbefalt)

I Supabase Dashboard → Edge Functions → Scheduled:

```
Function: role-compliance-reconcile
Schedule: 0 2 * * *           (daglig 02:00 UTC)
Header: X-Compliance-Cron-Secret: <secret>
Body: {}
```

```
Function: compliance-notification-scan
Schedule: 0 * * * *           (hver time)
Header: X-Compliance-Cron-Secret: <secret>
Body: {}
```

Secrets settes via:

```bash
supabase secrets set COMPLIANCE_CRON_SECRET=<uuid-gen>
```

---

## 2. pg_cron (alternativ — kjører i database)

Hvis Supabase Scheduled Functions ikke er tilgjengelig:

```sql
-- Aktiver extension (krever superuser)
create extension if not exists pg_cron;

-- Daglig reconcile 02:00 UTC
select cron.schedule(
  'compliance-reconcile-daily',
  '0 2 * * *',
  $$select public.reconcile_with_logging(null);$$
);

-- Hver time notification scan
select cron.schedule(
  'compliance-notification-scan-hourly',
  '0 * * * *',
  $$select public.scan_and_create_compliance_notifications(null);$$
);
```

Fordel med pg_cron: ingen edge function-secret, kjører som security definer.
Ulempe: Ingen e-post-dispatch (krever HTTP-kall til edge function).

---

## 3. GitHub Actions (alternativ — kjører i CI)

`.github/workflows/compliance-cron.yml`:

```yaml
name: Compliance cron
on:
  schedule:
    - cron: '0 2 * * *'    # daglig reconcile
    - cron: '0 * * * *'    # hver time scan

jobs:
  reconcile:
    if: github.event.schedule == '0 2 * * *'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/role-compliance-reconcile" \
            -H "X-Compliance-Cron-Secret: ${{ secrets.COMPLIANCE_CRON_SECRET }}" \
            -d '{}'

  scan:
    if: github.event.schedule == '0 * * * *'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/compliance-notification-scan" \
            -H "X-Compliance-Cron-Secret: ${{ secrets.COMPLIANCE_CRON_SECRET }}" \
            -d '{}'
```

---

## 4. Verifikasjon

Etter oppsett, sjekk `cron_run_log`-tabellen:

```sql
select function_name, invoked_at, status, duration_ms
from public.cron_run_log
order by invoked_at desc
limit 20;
```

Forventet rytme:
- `reconcile_with_logging` ~ én rad per dag
- `scan_and_create_compliance_notifications` — via edge function — én rad per time per org (logges fra edge function side, ikke db-side ennå)

---

## 5. Manuell test

Ad-hoc kjøring fra terminal:

```bash
# Reconcile alle orgs
curl -X POST "https://<projref>.supabase.co/functions/v1/role-compliance-reconcile" \
  -H "X-Compliance-Cron-Secret: $SECRET" -d '{}'

# Bare én org
curl -X POST "https://<projref>.supabase.co/functions/v1/role-compliance-reconcile" \
  -H "X-Compliance-Admin-Secret: $ADMIN_SECRET" \
  -d '{"org_id":"<uuid>"}'

# Notification scan
curl -X POST "https://<projref>.supabase.co/functions/v1/compliance-notification-scan" \
  -H "X-Compliance-Cron-Secret: $SECRET" -d '{}'
```

---

## 6. Alerts ved feilet kjøring

Sett opp Supabase Logs alert:

```
Filter: function_name in (role-compliance-reconcile, compliance-notification-scan)
Condition: response_status >= 500 OR duration_ms > 25000
Notify: Slack #ops or e-post
```

eller spør `cron_run_log` for siste 7 dager:

```sql
select function_name, count(*) filter (where status = 'error') as errors
from public.cron_run_log
where invoked_at > now() - interval '7 days'
group by function_name;
```
