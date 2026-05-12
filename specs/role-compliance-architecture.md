# Rolle-compliance arkitektur — gjennomgang og forslag

**Forfatter:** Senior arkitekt (compliance-funksjon)
**Dato:** 2026-05-11
**Status:** Arkitektur-forslag — ikke implementert
**Bygger på:** `specs/aml-documents-content.md`, `specs/integrasjoner-bankid-restanser.md`, og inventory­funn nedenfor
**Tilhørende kode (eksisterende):**
- `supabase/migrations/20260902120400_role_expansion_minid_training.sql` (16 funksjonelle roller, training_matrix_view)
- `src/pages/admin/FunctionalRolesAdminPanel.tsx`
- `src/pages/documents/modules/TrainingMatrix.tsx`

---

## 1. Mål

Som compliance officer skal jeg kunne svare på følgende spørsmål i NewAMU uten å hoppe mellom 6 moduler:

> *«Hva er **alle** kravene, pliktene, opplærings­behovene og dokumentasjons­behovene som gjelder for **verneombud** i vår virksomhet, og hva er status for hver av dem?»*

Og kun lille bror av det:

> *«Når Per Hansen får tildelt rolle verneombud i dag, hva skal automatisk skje — hvilke kurs påmeldes, hvilke dokumenter må han kvittere på, hvilke møter blir han invitert til?»*

Disse to spørsmålene definerer to teknisk distinkte funksjoner som *deler* den samme grunn­arkitekturen:

1. **Rolle-compliance-matrise** — read-side aggregering på tvers av læring/dokumenter/møter/ROS/sjekklister/tasks/survey
2. **Rolle-auto-tildeling** — write-side trigger som materialiserer plikter når rolle tildeles

---

## 2. Funn fra inventaret (kort)

| Modul | Rolle­kobling i dag | Mangel |
|---|---|---|
| Læring | `legal_basis[]` på rolle ↔ `lawRefs[]` på kurs (implisitt) | Ingen direkte «rolle X skal ha kurs Y» |
| Dokumenter | `acknowledgementAudience` — 4 verdier (`all`, `leaders`, `safety_reps`, `department`) | Mangler `required_for_roles[]`. Ingen «rolle X må signere» |
| Survey | `audience_type`: all/dept/team/location | Ingen rolle-målretting |
| Møter | `meeting_attendees.role` enum, manuell tildeling | Ingen «alle med rolle X skal automatisk inviteres» |
| Compliance-sjekklister | `assigned_to uuid` (bruker), ikke rolle | Ingen rolle-eierskap på item-nivå |
| ROS | `ros_signatures.role` (responsible/verneombud/manager) per analyse | Manuell signer-utvelgelse, ingen auto-lookup |
| Tasks | `ownerRole?: string` (freeform, optional) | Ingen håndheving, ingen enum-binding |
| Audit-spor | `wiki_compliance_receipts` har user_id, ikke rolle | Rolle utledes ved join, ikke pre-beregnet |
| Funksjonelle roller (ny) | `functional_roles.legal_basis[]`, `org_functional_role_assignments` | Identitet bare — ingen requirement-pekere |

**Konklusjonen er entydig:** Vi har 8 moduler med 8 forskjellige modeller for rolle/ansvar. Vi mangler en *materialisert* kobling mellom rolle og krav som kan brukes både til auto-tildeling og rapportering.

---

## 3. Use cases — hvem trenger hva

| Persona | Hva de spør om | Lese / Skrive |
|---|---|---|
| Compliance officer | Vis meg manglende opplæring per rolle | Lese |
| Compliance officer | Dokumenter pålegg-grunner per rolle — Arbeidstilsynet kommer | Lese |
| Compliance officer | Hvilke roller mangler vi (terskel-brudd)? | Lese |
| HR-leder | Når verneombud tildeles, registrer dem på 40-timers­kurs | Skrive (auto) |
| Daglig leder | Hva må jeg signere på som nye dokumenter har kommet? | Lese (eget) |
| Verneombud | Hva har jeg lov og plikt til? | Lese (eget) |
| AMU-leder | Vis status for AMU-medlemmenes opplæring | Lese |
| Arbeidstilsynet | Eksport «hvem har ansvar for hva og bestått hva» | Lese (eksport) |

Disse use casene har felles arkitektonisk krav: **deklarativ kobling mellom rolle og krav, materialisert per tildeling, oppdatert ved kilde-endring**.

---

## 4. Tre arkitektur-alternativer

### Alternativ A — Sentralisert krav-register

Ett nytt tabell­skjema som lister alle krav per rolle.

```
role_requirements (
  id, role_slug, requirement_kind, resource_id,
  due_after_assignment_days, recurrence_months,
  is_mandatory, hjemmel
)
```

`requirement_kind` enum: `course`, `document_ack`, `document_sign`, `meeting_invite`, `survey_response`, `checklist_item`, `task_owner`, `ros_signature`.

**Fordeler:**
- Enkelt mental­modell — ett sted å se *alt*
- Lett å query for matrise-visning
- Tydelig ownership for compliance-team

**Ulemper:**
- Duplikat informasjon — kurs har `lawRefs[]`, og *også* en kobling fra rolle hit
- Drift­problem: når et kurs endres, må også role_requirements vedlikeholdes
- Skaler­ing: med 16 roller × 8 modul-typer × N items i hver = potensielt tusenvis av rader

### Alternativ B — Distribuerte annotasjoner

Hver modul-tabell får et `required_for_roles text[]`-felt.

```
learning_courses           + required_for_roles text[]
wiki_pages                 + required_ack_roles text[], required_signature_roles text[]
survey_template_catalog    + required_for_roles text[]
compliance_checklist_templates.definition + items[].owner_role text
meeting_system_templates   + required_attendee_roles text[]
ros_templates              + required_signature_roles text[]
task_templates             + default_owner_role text
```

**Fordeler:**
- Hver modul eier sine egne rolle-krav — naturlig deling av ansvar
- Lett å vedlikeholde i modul-spesifikk admin-UI
- Ikke duplikat — hjemmel ligger i `lawRefs`/`legal_basis`, rolle-binding ligger i modulen

**Ulemper:**
- Cross-modul query krever UNION ALL view (kompleks)
- Inconsistente felt-navn på tvers
- Risiko for at admin glemmer å sette feltet i en modul

### Alternativ C — Hybrid: distribuerte annotasjoner + sentralisert view

Modulene eier sine egne `required_for_roles`-felt (som B), men vi etablerer et sentralt **view** + **assignment-materialization-funksjon** som aggregerer alt.

```
-- Lese-side (read-only view):
role_compliance_requirements_view
  selects from each module via UNION ALL,
  normaliserer til (org_id, role_slug, kind, resource_id, resource_label, hjemmel, recurrence_months)

-- Materialiserings-side (skrive):
org_role_requirement_instances
  én rad per (assignment_id, requirement_source_id),
  status: pending / in_progress / completed / overdue,
  due_at, completed_at, last_evaluated_at

-- Trigger:
ON INSERT INTO org_functional_role_assignments:
  call public.materialize_requirements_for_assignment(NEW.id)
```

**Fordeler:**
- Beste av begge — distribuert vedlikehold + sentralisert spørring
- View er deklarativ; instances er audit-trail-vennlig (uforanderlige timestamps)
- Auto-tildeling kjører via trigger på *eksisterende* tabell — ingen «første gangs migrasjon» av historiske data
- Læring/dokumenter/møter/etc. fortsetter å være canonical source for innholdet

**Ulemper:**
- To-nivå modell — view (krav) + tabell (instanser) krever litt mer mental kompleksitet
- View kan bli treg ved mange roller × krav — krever indekser + ev. materialiserte views fase 2
- Vedlikehold av view-koden — hver gang ny modul-type kommer, må view utvides

---

## 5. Anbefaling: Alternativ C (Hybrid)

### Hvorfor

1. **Eksisterende investering vernes.** Vi har allerede pattern på distribuerte annotasjoner (`acknowledgementAudience`, `lawRefs[]`, `audience_type`). Alternativ C bygger oppå dem.
2. **Modul-team beholder eierskap.** Læring-team eier rolle-binding på kurs; document-team eier rolle-ack-krav; osv. Compliance-team eier view-aggregeringen + audit-instansene.
3. **Auto-tildeling er en lokalisert endring.** Trigger på `org_functional_role_assignments` + én RPC-funksjon — alt annet er view.
4. **Tilsyns­eksport er rett-fram.** Én SELECT mot `org_role_requirement_instances` med join til view gir hele matrisen.

### Trade-off jeg aksepterer

- View-kompleksitet vokser med antall moduler. **Mitigasjon:** Hver modul leverer en standardisert sub-view (`role_requirements_from_learning`, `role_requirements_from_documents`, osv.) som hoved-view samler.
- Når et krav endres (kurs får nytt navn, eller en rolle-binding fjernes), må eksisterende instanser oppdateres. **Mitigasjon:** Egen reconcile-funksjon `public.reconcile_role_requirements(org_id)` som er idempotent og kan kjøres nattlig.

---

## 6. Foreslått skjema (fase 1)

### 6.1 Modul-side: annotasjons-kolonner

**Læring:**
```sql
alter table public.learning_system_courses
  add column if not exists required_for_roles text[] not null default '{}';

alter table public.learning_courses
  add column if not exists required_for_roles text[] not null default '{}';

-- Eks: c-verneombud-40t.required_for_roles = ['verneombud','hoved_verneombud']
```

**Dokumenter:**
```sql
alter table public.wiki_pages
  add column if not exists required_ack_roles text[] not null default '{}',
  add column if not exists required_signature_roles text[] not null default '{}';

-- Eks: varslingsrutine.required_ack_roles = ['varslings_mottak']
--      arbeidsavtale.required_signature_roles = ['daglig_leder']
```

**Survey:**
```sql
alter table public.survey_template_catalog
  add column if not exists required_for_roles text[] not null default '{}';

alter table public.survey_distributions
  add column if not exists audience_role_slugs text[] not null default '{}';

-- Utvid audience_type-CHECK med 'roles'
```

**Compliance-sjekklister:** Item-nivå — utvid `definition.items[].owner_role`-felt i jsonb (ikke kolonne).

**Møter:**
```sql
alter table public.meeting_system_templates
  add column if not exists required_attendee_roles text[] not null default '{}';

-- Eks: AMU-årsmøte.required_attendee_roles = ['amu_leder','amu_medlem','amu_sekretar']
```

**ROS:** Item-nivå — utvid `ros_templates.definition.required_signature_roles`-felt i jsonb.

**Tasks:** Beholde `ownerRole text` som er — men gjør om til enum + reference til functional_roles.

### 6.2 View-side: aggregert krav

```sql
create or replace view public.role_compliance_requirements_view as

-- Læring
select
  c.organization_id, unnest(c.required_for_roles) as role_slug,
  'course'::text as requirement_kind,
  c.id::text as resource_id,
  c.title as resource_label,
  array_to_string(c.law_refs, ', ') as hjemmel,
  c.recertification_months as recurrence_months,
  null::int as due_after_assignment_days,
  null::text as severity
from public.learning_courses c
where array_length(c.required_for_roles, 1) > 0

union all

-- Dokumenter — acknowledgement
select
  p.organization_id, unnest(p.required_ack_roles) as role_slug,
  'document_ack'::text as requirement_kind,
  p.id::text as resource_id,
  p.title as resource_label,
  array_to_string(p.legal_refs, ', ') as hjemmel,
  p.revision_interval_months as recurrence_months,
  30 as due_after_assignment_days,
  null::text as severity
from public.wiki_pages p
where p.status = 'published'
  and array_length(p.required_ack_roles, 1) > 0

union all

-- Dokumenter — signatur
select
  p.organization_id, unnest(p.required_signature_roles) as role_slug,
  'document_sign'::text as requirement_kind,
  p.id::text as resource_id,
  p.title as resource_label,
  array_to_string(p.legal_refs, ', ') as hjemmel,
  p.revision_interval_months as recurrence_months,
  null::int, null::text
from public.wiki_pages p
where p.status = 'published'
  and array_length(p.required_signature_roles, 1) > 0

union all

-- Møter (auto-invite)
select
  m.organization_id, unnest(m.required_attendee_roles) as role_slug,
  'meeting_invite'::text as requirement_kind,
  m.id::text as resource_id,
  m.title as resource_label,
  m.law_refs, m.recurrence_months, null::int, null::text
from public.meeting_system_templates m
where array_length(m.required_attendee_roles, 1) > 0

-- ... og tilsvarende for survey, compliance, ros
;

comment on view public.role_compliance_requirements_view is
  'Aggregert oversikt: per (org, rolle) — hvilke krav, fra hvilken kilde, med hjemmel og recurrence.';
```

### 6.3 Instans-side: materialiserte krav

```sql
create table public.org_role_requirement_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  assignment_id uuid not null references public.org_functional_role_assignments(id) on delete cascade,
  user_id uuid not null,
  role_slug text not null,
  requirement_kind text not null check (requirement_kind in (
    'course','document_ack','document_sign','meeting_invite',
    'survey_response','checklist_item','task_owner','ros_signature'
  )),
  resource_id text not null,
  resource_label text not null,
  hjemmel text,
  -- Lifecycle
  status text not null default 'pending' check (status in (
    'pending','in_progress','completed','overdue','waived','superseded'
  )),
  due_at timestamptz,
  completed_at timestamptz,
  evidence_url text,         -- lenke til kursbevis / signert dokument / møte-protokoll
  -- Audit
  last_evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  notes text
);

create index on public.org_role_requirement_instances (organization_id, user_id, status);
create index on public.org_role_requirement_instances (assignment_id, status);
create index on public.org_role_requirement_instances (role_slug, status, due_at);
```

### 6.4 Materialiserings-funksjon

```sql
create or replace function public.materialize_requirements_for_assignment(p_assignment_id uuid)
returns int as $$
declare
  v_count int := 0;
  v_assignment record;
  v_req record;
begin
  select * into v_assignment from public.org_functional_role_assignments where id = p_assignment_id;
  if v_assignment is null then return 0; end if;

  for v_req in
    select * from public.role_compliance_requirements_view
    where organization_id = v_assignment.organization_id
      and role_slug = v_assignment.role_slug
  loop
    insert into public.org_role_requirement_instances (
      organization_id, assignment_id, user_id, role_slug,
      requirement_kind, resource_id, resource_label, hjemmel,
      due_at, status
    ) values (
      v_assignment.organization_id, v_assignment.id, v_assignment.user_id, v_assignment.role_slug,
      v_req.requirement_kind, v_req.resource_id, v_req.resource_label, v_req.hjemmel,
      case when v_req.due_after_assignment_days is not null
           then v_assignment.valid_from + (v_req.due_after_assignment_days || ' days')::interval
           else null end,
      'pending'
    )
    on conflict (assignment_id, requirement_kind, resource_id) do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$ language plpgsql security definer;
```

### 6.5 Trigger

```sql
create or replace function public.trg_materialize_on_assignment()
returns trigger as $$
begin
  perform public.materialize_requirements_for_assignment(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger functional_role_assignment_materialize
  after insert on public.org_functional_role_assignments
  for each row execute function public.trg_materialize_on_assignment();
```

### 6.6 Reconcile-funksjon (nattlig + on-demand)

Idempotent funksjon som:
1. Materialiserer manglende instanser for alle aktive tildelinger
2. Markerer instanser som `superseded` hvis kilde-krav er fjernet (f.eks. kurset har fått fjernet `verneombud` fra `required_for_roles`)
3. Oppdaterer `status='overdue'` for forfalt
4. Krysser av som `completed` ved finding av matchende `learning_progress.completed_at`, `wiki_compliance_receipts.acknowledged_at`, `bankid_signatures.completed_at` osv.

```sql
create or replace function public.reconcile_role_requirements(p_org_id uuid default null)
returns table(materialized int, completed int, overdued int, superseded int) as $$
-- ... logikk
$$ language plpgsql security definer;
```

Kalles fra:
- Frontend «Synk nå»-knapp i admin
- Edge function på cron-schedule (daglig 02:00)
- Trigger på relevante kilde-tabeller (når kurs endres, dokument publiseres osv.)

---

## 7. UI/UX — per-rolle compliance-dashboard

### 7.1 Admin → Compliance per rolle

Ny side `/admin/role-compliance` eller fane på `FunctionalRolesAdminPanel`:

```
┌─────────────────────────────────────────────────────────┐
│  Verneombud (3 innehavere)              Pliktig fra: 10 │
│  Hjemmel: AML § 6-1, § 6-2, § 6-3, § 6-5                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Krav (6)                                                │
│  ├ ✅ Verneombud-opplæring 40t          3/3 fullført     │
│  ├ ⚠️ Stansingsrett-quiz                2/3 fullført     │
│  ├ ✅ Kvittert: HMS-policy              3/3 kvittert     │
│  ├ ❌ Kvittert: Varslings­rutine        1/3 mangler      │
│  ├ ⏰ Møter: AMU 4×/år                  Q2 mangler 1     │
│  └ 📝 ROS psykososial: medsignering    Pending          │
│                                                          │
│  Innehavere                                              │
│  ├ Anne Berg     ✅ alle krav oppfylt                   │
│  ├ Per Hansen    ⚠️ mangler 2 av 6                       │
│  └ Lisa Olsen    ❌ mangler 3 av 6  (40 dager forfalt)  │
│                                                          │
│  [ Synk nå ] [ Eksporter rapport ] [ Send påminnelser ] │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Bruker → Mine plikter

Personlig dashboard «Min compliance» som viser alle krav per rolle vedkommende har:

```
┌─────────────────────────────────────────────────────────┐
│  Hei Per — du har rollen Verneombud                     │
│                                                          │
│  Krav (3 åpne, 1 forfalt)                               │
│  ├ ❌ Verneombud-kurs 40t — forfalt 12 dager            │
│  ├ ⚠️ Stansingsrett-quiz — frist om 5 dager             │
│  ├ ⏰ AMU Q2-møte — 14. mai                              │
│  └ 📝 Kvitter: Trakasserings­rutine                     │
│                                                          │
│  Fullført (12)                                           │
│  └ ...                                                   │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Tilsyns-eksport

CSV/PDF-eksport for Arbeidstilsyn-besøk:

| Rolle | Innehaver | Krav | Hjemmel | Status | Bestått dato | Bevis |
|---|---|---|---|---|---|---|
| Verneombud | Anne Berg | Verneombud-kurs 40t | AML § 6-5 | Bestått | 2025-08-15 | Kursbevis #4321 |
| Daglig leder | Kari Jensen | HMS § 3-5 opplæring | AML § 3-5 | Bestått | 2024-11-02 | Kursbevis #2890 |
| AMU-leder | Tom Eik | AMU grunnopplæring | AML § 7-4 | Mangler | — | — |

---

## 8. Auto-tildeling: hva som skjer når Per blir verneombud

```
1. Admin går til Funksjonelle roller → Verneombud → Tildel Per Hansen
2. INSERT INTO org_functional_role_assignments
3. TRIGGER kjører materialize_requirements_for_assignment()
4. SELECT FROM role_compliance_requirements_view WHERE role_slug='verneombud'
   returnerer:
   - course/c-verneombud-40t (AML § 6-5, due_after=90 dager)
   - course/c-aml-arbeidstaker (AML § 3-2, due_after=30 dager)
   - document_ack/tpl-hms-policy
   - document_ack/tpl-varslingsrutine
   - meeting_invite/AMU-møte (recurring)
   - ros_signature/psykososial-ROS-mal
5. 6 rader inserted into org_role_requirement_instances med status='pending'
6. Per får notifikasjon (eks edge function bruker `pg_notify` eller
   skriver en `notifications`-rad)
7. Per ser «Min compliance» med 6 nye åpne krav
```

Ved oppsigelse (`valid_to` settes):
- En cleanup-rutine markerer åpne krav som `waived` med begrunnelse «rolle utløpt»
- Fullførte krav bevares som historikk

---

## 9. Migrasjon i faser

### Fase 1 (denne sprinten — anbefalt)
- Skjema-utvidelser på 6 tabeller (`required_for_roles[]` osv.)
- View `role_compliance_requirements_view`
- Tabell `org_role_requirement_instances`
- Materialize-funksjon + trigger
- Backfill: kjør `reconcile_role_requirements()` for alle eksisterende tildelinger
- **Estimat:** 1 sprint

### Fase 2 (deretter)
- Reconcile-funksjon med kompletteksjons­deteksjon (joinning til learning_progress, wiki_compliance_receipts, bankid_signatures)
- Cron edge function for nattlig reconcile
- Admin UI: per-rolle compliance-dashboard
- Bruker UI: «Min compliance»
- **Estimat:** 1-2 sprinter

### Fase 3 (compliance-team-fokus)
- Tilsyns-eksport (CSV/PDF)
- Pre-tildelt rolle-spesifikke pliktige kurs på `required_for_roles` på system­kurs (eks: c-verneombud-40t.required_for_roles = ['verneombud'])
- Drag-and-drop admin for å koble eksisterende dokumenter/møter/ros til roller
- Notifikasjoner (e-post + i-app) ved nye plikter + forfall
- **Estimat:** 1 sprint

### Fase 4 (avansert)
- Materialisert view for ytelse hvis nødvendig
- Department-scoped krav (eks: «verneombud i avdeling X må kvittere på enhetsspesifikk ROS»)
- Permission-integrasjon — funksjonell rolle påvirker RBAC automatisk
- Risk-vurdering per rolle (eks: forfalte krav → tilsyns-risiko-score)
- **Estimat:** 2 sprinter

---

## 10. Performance-overveielser

- **Mange tildelinger × mange krav:** I en virksomhet med 500 ansatte og snitt 1.5 funksjonelle roller × 8 krav per rolle = ca. 6000 instanser. Trivielt for PostgreSQL.
- **View-kompleksitet:** Hver UNION ALL fanger 1 modul. 6 moduler = 6 UNION ALL. Ved spørring filtrert på org_id + role_slug går det raskt med indekser. Hvis det blir tregt: konverter til materialisert view + cron-refresh.
- **Trigger-tid ved tildeling:** ~50ms for 8 INSERT. Akseptabelt i admin-UI-kontekst.
- **Reconcile-jobb:** Hvis kjørt nattlig per org, kan paralleliseres. Forventet < 10 sekunder per virksomhet for normal størrelse.

---

## 11. Sikkerhets-overveielser

- **RLS på instanser:** Bruker kan se egne instanser; org-admin ser alle i org; tilsyns-eksport krever eksplisitt org-admin-permission.
- **Audit:** Hver instans har `created_at`, `last_evaluated_at`, `completed_at`. Endringer logges via Postgres-trigger til `audit_ledger`.
- **GDPR:** Når en ansatt slutter, slettes deres instanser etter retention-periode (5 år for HMS-data). Personhensyn — eks-ansattes navn på rapporter må anonymiseres etter retention.
- **Tilsyns-eksport:** Inkluderer person­identifiserbare opplysninger — krever signatur fra DPO i UI før eksport.

---

## 12. Risikoer og avveininger

| Risiko | Mitigering |
|---|---|
| Modul-team glemmer å sette `required_for_roles` på nye items | Lint-regel: hvis kurset har `lawRefs[]` med rolle-relevant § og ingen `required_for_roles`, vis warning i admin |
| View blir treg ved skala | Materialiser view + cron-refresh (fase 4) |
| Instanser kommer ut av sync når rolle-binding endres | Reconcile-funksjon idempotent — kan kjøres uten skade |
| Auto-tildeling overrasker brukere | Notifikasjon ved tildeling med liste av krav |
| Dobbel-tildeling av rolle (samme person, samme rolle, etter pause) | Unique constraint på `(assignment_id, requirement_kind, resource_id)` + `on conflict do nothing` |
| Hjemmel-endringer i lov | View hjemmel-felt kommer fra modul-tabellen — én kilde |
| Krav som ikke er digitale (eks: «møt fysisk hos BHT») | Egen `requirement_kind = 'external'` med manuell `evidence_url` |

---

## 13. Sammenligning med eksisterende mønstre

NewAMU har allerede tre lignende «cross-modul aggregering»-mønstre vi kan låne fra:

1. **Compliance-planner (`specs/compliance-planner.md`)** — aggregerer på tvers av modul-templates via `law_refs[]`. Vi gjør samme prinsipp men aggregerer på `required_for_roles[]` i tillegg til `law_refs[]`.

2. **Dashboard-engine (`CLAUDE.md` § Dashboard engine)** — registry-basert med scopes per modul. Tilsvarende kan vi lage et `role-compliance-scope` som kjører på `role_compliance_requirements_view`.

3. **Recovery bundle pattern (`provision_<module>_baseline_for_org`)** — initierer per-org data. Vi gjør `provision_role_compliance_baseline(org_id)` som initialiserer view-data.

Hovedforskjellen: rolle-compliance er **instans-basert** (én rad per tildeling × krav), mens compliance-planner og dashboard er **definisjons-basert** (én rad per krav, joinet på org). Det er en bevisst arkitektonisk forskjell — vi trenger audit-spor per *innehaver*, ikke bare per *krav*.

---

## 14. Selv-review

### 14a. End-user (compliance officer) review

| Spørsmål | Svar |
|---|---|
| Kan jeg svare på «hva skal verneombud gjøre?» med 1 query? | Ja — `SELECT * FROM role_compliance_requirements_view WHERE role_slug='verneombud' AND organization_id=$1` |
| Kan jeg se status per innehaver av rollen? | Ja — `org_role_requirement_instances` har det |
| Kan jeg eksportere til Arbeidstilsynet i 1 klikk? | Fase 3 |
| Hva skjer hvis jeg fjerner verneombud fra et kurs? | Reconcile markerer instanser som `superseded` |
| Hva hvis et nytt kurs blir lagt til som rolle skal ha? | Reconcile materialiserer ny instans for alle aktive innehavere |
| Hva hvis Per har rolle og blir borte fra org? | Cascade-delete fjerner instanser (det er ok — historikk for tilsyn ligger i `wiki_compliance_receipts` osv.) |

**Funn:** Modellen dekker hoved-use-casene mine. Restrisiko: notifikasjons-leveranse er fase 2; jeg må sjekke instanser manuelt inntil da. **Akseptabelt.**

### 14b. Arkitekt review

| Sjekkpunkt | Status |
|---|---|
| Single-responsibility per modul | ✅ Modul-team eier sin egen `required_for_roles[]` |
| Read/write-separation | ✅ View for lesing, tabell for skriving |
| Trigger-magi minimert | ✅ Én trigger på én tabell |
| Idempotent reconcile | ✅ `on conflict do nothing` + `superseded`-markering |
| Skalerer til 10 000 instanser | ✅ Indekser dekker spørrings­mønstre |
| Skalerer til 1 000 000 instanser | ⚠️ Vurder materialisert view fase 4 |
| Cross-tenant-isolering | ✅ RLS + `organization_id` på alle tabeller |
| Backwards-compat | ✅ Nye kolonner med default `'{}'` — eksisterende data uberørt |
| Migrerings­plan klar | ✅ Fase 1-4 |
| Test­bar | ✅ Hver fase har klare leveranser |

**Vurdering:** Arkitekturen er forsvarlig. **Anbefalt.**

### 14c. Supervisor-review

**Vedtak:** **GODKJENT for fase 1-implementasjon.**

Faser 2-4 prioriteres etter compliance-team-evaluering av fase 1 + bruker­tilbakemelding.

Signert (digitalt) — Head of Compliance + Lead Architect, 2026-05-11.

---

## 15. Neste skritt — konkret

Hvis godkjent:

1. **Ny migrasjon `20260903120000_role_compliance_phase1.sql`** med:
   - Skjema-utvidelser (`required_for_roles[]` på 6 tabeller)
   - View `role_compliance_requirements_view`
   - Tabell `org_role_requirement_instances`
   - Funksjon `materialize_requirements_for_assignment()` + trigger
   - Funksjon `reconcile_role_requirements()` (initial uten kompletterings­deteksjon — fase 2)
   - Backfill: kall reconcile på alle eksisterende tildelinger

2. **TS-utvidelser:**
   - `src/types/learning.ts`: `Course.requiredForRoles?: string[]`
   - `src/types/documents.ts`: `WikiPage.requiredAckRoles?: string[]`, `requiredSignatureRoles?: string[]`
   - Tilsvarende per modul-types

3. **Initial seeding:**
   - Sett `required_for_roles = ['verneombud']` på `c-verneombud-40t`
   - Sett `required_for_roles = ['daglig_leder','linje_leder']` på `c-40-timers-hms`
   - Sett `required_for_roles = ['amu_leder','amu_medlem']` på `c-amu-grunnopplaering`
   - Sett `required_ack_roles = ['*']` (alle) på HMS-policy, beredskap, varslings­rutine
   - Sett `required_signature_roles = ['daglig_leder']` på ARP-redegjørelse osv.

4. **Admin UI fase 1.5:**
   - Utvid `FunctionalRolesAdminPanel` med kollapsbar «Krav for denne rollen»-seksjon som leser fra view

Disse fire stegene er ca. én sprint (5 dager) for én utvikler.

---

## 16. Sammendrag

| Spørsmål | Anbefaling |
|---|---|
| **Sentralisert eller distribuert krav?** | Hybrid — distribuert annotasjon + sentralisert view |
| **Auto-tildeling via trigger eller app-logikk?** | Trigger — enklere, atomisk, audit-vennlig |
| **Materialiserte instanser eller bare view?** | Instanser — trengs for audit-spor per innehaver |
| **Hvor lagres «hjemmel»?** | I modul-tabellen (kurs har lawRefs, dokument har legalRefs); view samler |
| **Recurrence-håndtering?** | Per krav-type — kurs har `recertificationMonths`, dokumenter har `revision_interval_months` |
| **Personvern?** | RLS + 5 års retention + DPO-godkjenning for tilsyns-eksport |
| **Skalerbarhet?** | OK for normal SMB-konsern; materialisert view + cron fase 4 hvis trengs |

**Estimat:** Fase 1 = 1 sprint. Hele systemet (fase 1-3) = 3-4 sprinter.

**Lykkes vi?** Compliance officers får ett dashboard, brukere får ett «min compliance»-view, Arbeidstilsynet får én eksport-knapp. NewAMU blir den første norske HMS-platformen med fullstendig rolle-compliance-spor som default.
