# Meetings (Møter) — Module Architecture Spec

> **Read this first:** `specs/PLAYBOOK.md` (§3 task shape, §4 capability inventory,
> §7 architect checklist). This spec is a **net-new module spec** rather than a
> parity port — but it follows the same shape so a future parity port to Møter
> doesn't reinvent the wheel.

**Reference modules (in priority order):**
- `modules/compliance/` — template + execution + categories + metadata_schema (gold standard).
- `modules/documents/` — system-catalog + per-org toggle + per-org custom (closest 3-layer template surface).
- `modules/survey/` — provision bundle + recovery pattern.
- `modules/amu/` + `src/pages/CouncilModule.tsx` — existing AMU-specific surfaces; the new module **supersedes the council module's meeting CRUD** and **co-exists** with AMU for now (Phase F will migrate AMU into the meetings module as a template).

**Owner:** human. **Spec status:** `✅ shipped` — Phases A–F merged via PRs #237–#241 plus follow-up H0–H12. See `ROADMAP.md §8` for the post-ship status table and `specs/meetings-lovdata-verification.md` for the live legal-text verification log.

---

## 1 · One-paragraph framing

Norwegian organisations are legally required to run a recurring set of meetings —
**AMU** (AML §7-2), **bedriftsutvalg** (Hovedavtalen §9-3),
**verneombudsmøter** (AML §6-2), **drøftingsmøter** (AML §15-1) — plus a
growing list of ISO-driven management reviews (ISO 9001 §9.3, ISO 27001 §9.3,
ISO 45001 §9.3) and GDPR-driven privacy reviews (DPIA, ROPA). Each of these
is a **structured meeting with mandatory agenda items, attendance rules,
quorum thresholds, decision records, and protocol signing**. The current
`CouncilModule.tsx` + `modules/amu/` solve this for AMU specifically with
~5000 lines of bespoke code; the new **`modules/meetings/`** module
generalises that work as a *template-driven* engine so:

1. Every legally-required meeting type is a **system template** the platform ships.
2. Admins can **toggle** a system template on/off for their org (mirrors documents).
3. Admins can **author org-specific custom templates** (e.g. company board, project review).
4. New ISO/GDPR meeting types ship by **adding a new system template** — no module code change.
5. **Compliance** is enforced by the template (mandatory agenda items, minimum participants, cadence_hint, law_refs[]) and surfaced as badges in the UI.

This module mirrors the **compliance checklist module's data + metadata_schema
architecture** end-to-end, with a **documents-style three-layer template surface**.

---

## 2 · Architecture decisions (made up front)

| Decision | Choice | Rationale |
|---|---|---|
| Template surface shape | **3-layer** (system catalog → per-org settings → per-org custom) | Mirrors documents. Cleanest separation: system templates immutable, org settings = enable/disable/order, org templates = entirely custom. |
| Where do org overrides of system templates go? | Org **settings** carry overrides (`override_name`, `override_description`, `override_definition` jsonb, `nav_pinned`, `position`) | Avoids "shadow" mirror rows in `meeting_org_templates`. An admin who wants to change the agenda of a system template forks it into a custom org template explicitly. |
| Categories | **Per-org, free vocabulary** (mirror compliance categories) | Templates are categorisable by admin-curated buckets ("AML", "ISO 9001", "Personal", "Drift"). Seeded per org. |
| Instances table | Single `meetings` table; agenda/attendees/decisions/actions in **child tables** | Normalisation lets us run analytics + cross-meeting decision register without JSONB scans. |
| Per-agenda-item minutes | **Yes** — structured columns on `meeting_agenda_items` | The Council review (§2.2) explicitly called the current free-text `minutes` field as a competitive gap. |
| Decision register | Yes — `meeting_decisions` denormalised from agenda_items | Enables global "Vedtaksregister" view + analytics by `status`. |
| Action items | Linked to existing **tasks** module via `task_id` FK | Don't recreate a parallel task system. Closes Council Review §2.4. |
| Protocol signature | Workflow confirmation today (low-level eSign), upgrade-path to BankID | Council Review §3.4 — be honest about what the data is. |
| Metadata schema | Same `TemplateMetadataField` types as compliance (copy verbatim) | Reuse the renderer + admin editor. |
| Org-context FKs on instances | `location_id`, `department_id`, `team_id`, `participant_member_ids[]`, `metadata jsonb` (mirror compliance §C-6) | Universal filter dimensions on the analyse page. |
| Lock model | Lock at `protocol_signed_at`, with trigger that protects identity-bearing columns but allows metadata edits (mirror compliance trigger relaxation §C-5) | Same contract every other module uses. |
| Co-existence with `modules/amu/` | **Co-exist initially; do not delete.** New module is the canonical surface; AMU module routes still work; Phase F migrates AMU as a system template + import script | Don't break the live AMU module while the new one stabilises. |
| Co-existence with `CouncilModule.tsx` | **Council module remains for governance/election concerns** (board, elections, compliance items). Meetings tab inside CouncilModule will eventually delegate to new module | Council module is broader than meetings; only its meeting surface overlaps. |

---

## 3 · Data model

### 3.1 Tables

```
meeting_template_categories       (id, organization_id, slug, name, description, position,
                                    is_active, is_system, deleted_at, created_at, updated_at,
                                    unique(organization_id, slug))

meeting_system_templates          (id text PK, slug text unique, label, description,
                                    framework text,                  -- 'AML' | 'ISO_9001' | 'ISO_27001' | 'ISO_45001' | 'GDPR' | 'INTERNAL'
                                    frameworks text[],               -- ['AML', 'IK-f'] etc — multi-framework
                                    law_refs text[],                 -- ['AML § 7-2', 'IK-f § 5 nr. 7']
                                    cadence_hint text,               -- 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'ad_hoc'
                                    default_duration_minutes int,
                                    default_category_slug text,      -- maps to category seed
                                    definition jsonb not null,       -- see §3.2
                                    metadata_schema jsonb not null,  -- {fields: TemplateMetadataField[]}
                                    is_active, sort_order, created_at, updated_at)

meeting_org_template_settings     (organization_id, system_template_id text references meeting_system_templates(id),
                                    enabled bool default true,
                                    nav_pinned bool default false,
                                    position int default 100,
                                    category_id uuid references meeting_template_categories,
                                    override_name text,              -- optional per-org rename
                                    override_description text,
                                    override_definition jsonb,       -- merged onto definition at read time; null = use system
                                    override_metadata_schema jsonb,  -- same merge pattern
                                    created_at, updated_at,
                                    primary key (organization_id, system_template_id))

meeting_org_templates             (id uuid PK, organization_id, slug,
                                    name, description,
                                    category_id, frameworks, law_refs, cadence_hint,
                                    default_duration_minutes,
                                    definition jsonb, metadata_schema jsonb,
                                    nav_pinned, is_active, deleted_at, created_at, updated_at,
                                    unique(organization_id, slug))

meetings                          (id uuid PK, organization_id,
                                    source_kind text check in ('system','org'),  -- which template table
                                    system_template_id text references meeting_system_templates(id),
                                    org_template_id uuid references meeting_org_templates(id),
                                    title text not null,
                                    description text,
                                    status text not null default 'planned'
                                      check in ('planned','in_progress','completed','cancelled'),
                                    scheduled_at timestamptz,
                                    ends_at timestamptz,
                                    completed_at timestamptz,
                                    confidentiality_level text not null default 'standard'
                                      check in ('standard','restricted','confidential'),
                                    location_label text,             -- free-form (e.g. 'Zoom', 'Møterom 3')
                                    location_id uuid references locations(id),
                                    department_id uuid references departments(id),
                                    team_id uuid references teams(id),
                                    participant_member_ids uuid[] not null default '{}',
                                    metadata jsonb not null default '{}',
                                    definition_snapshot jsonb,       -- frozen template definition at scheduling time
                                    metadata_schema_snapshot jsonb,
                                    invitation_sent_at timestamptz,
                                    invitation_recipients uuid[] default '{}',
                                    quorum_met bool,
                                    minutes_summary text,
                                    next_meeting_proposed_at timestamptz,
                                    protocol_signed_at timestamptz,  -- LOCK MARKER
                                    protocol_signed_by uuid,
                                    sign_checksum text,
                                    archived_at timestamptz,
                                    created_at, updated_at, created_by uuid)

meeting_agenda_items              (id uuid PK, meeting_id, position int,
                                    template_item_key text,          -- maps back to template.definition.items[].key
                                    title text not null,
                                    description text,
                                    law_ref text,
                                    prepared_by_member_id uuid,
                                    is_mandatory bool default false, -- inherited from template
                                    -- minutes (per item)
                                    minutes_summary text,
                                    decision_text text,
                                    decision_status text check in ('open','implemented','dropped'),
                                    vote_for int, vote_against int, vote_abstain int,
                                    conflict_of_interest jsonb,      -- [{member_id, reason}]
                                    created_at, updated_at)

meeting_attendees                 (meeting_id, member_id uuid references organization_members(id),
                                    role text check in ('chair','secretary','member','observer','guest'),
                                    invited bool default true,
                                    present bool,                    -- null = not yet checked in
                                    excused bool default false,
                                    digital bool default false,
                                    primary key (meeting_id, member_id))

meeting_decisions                 (id uuid PK, meeting_id, agenda_item_id,
                                    decision_text text not null,
                                    decision_at timestamptz default now(),
                                    status text default 'open',      -- 'open' | 'implemented' | 'dropped'
                                    follow_up_task_id uuid,
                                    created_at, updated_at)
                                    -- Materialised from agenda_items.decision_text on save; queryable cross-meeting.

meeting_action_items              (id uuid PK, meeting_id, agenda_item_id,
                                    description text not null,
                                    responsible_member_id uuid,
                                    due_date date,
                                    task_id uuid references tasks if you have a normalised tasks table; jsonb otherwise,
                                    status text default 'open',
                                    created_at, updated_at)

meeting_signatures                (id uuid PK, meeting_id, signer_member_id uuid,
                                    signer_name text, role text,     -- 'chair'|'secretary'|'management'
                                    signed_at timestamptz default now(),
                                    level1_event_id uuid,            -- existing level1 audit table
                                    created_at)
```

### 3.2 `meeting_system_templates.definition` jsonb shape

```ts
{
  preparationChecklist: [
    { key: string, label: string, isMandatory: boolean, lawRef?: string }
  ],
  agendaItems: [
    {
      key: string,                  // stable key for instance.agenda_items.template_item_key
      title: string,
      description?: string,
      lawRef?: string,
      isMandatory: boolean,
      voteRequired?: boolean,       // if true, vote fields must be filled to close
      conflictCheck?: boolean,      // surface COI prompt
      defaultPosition: number
    }
  ],
  requiredAttendees: [
    { role: 'chair'|'secretary'|'member'|'verneombud'|'employer_rep'|'employee_rep', count?: number }
  ],
  minimumQuorum?: { kind: 'percent', value: number } | { kind: 'count', value: number },
  invitationLeadDays?: number,      // e.g. 7 for AMU
  protocolRoles: Array<'chair'|'secretary'|'management'>,
  defaultActionTaskModule?: string  // module the spawned action task belongs to
}
```

### 3.3 `metadata_schema` (same shape as compliance/survey/documents)

```ts
TemplateMetadataSchema = { fields: TemplateMetadataField[] }
TemplateMetadataField  = { key, kind, label?, help?, required?, options? }
  kind: 'location' | 'department' | 'team' | 'participants' | 'text' | 'number' | 'select' | 'date'
```

The kind-to-column binding mirrors compliance:
- `kind=location|department|team` → `meetings.location_id|department_id|team_id`
- `kind=participants` → `meetings.participant_member_ids`
- `kind=date|text|number|select` → `meetings.metadata[key]`

### 3.4 Lock trigger contract (mirror compliance §C-5)

BEFORE UPDATE trigger on `meetings`:
- **Reject** changes to: `protocol_signed_at` (once non-null going to null), `protocol_signed_by`, `sign_checksum`, `definition_snapshot`, `metadata_schema_snapshot`, `system_template_id`, `org_template_id`, `source_kind`, `organization_id`, `created_by`, `confidentiality_level` (post-sign — confidentiality is set at meeting creation and not relaxable post-protocol).
- **Allow** post-sign changes to: `title`, `description`, `location_label`, `location_id`, `department_id`, `team_id`, `participant_member_ids`, `metadata`, `next_meeting_proposed_at`, `archived_at`, `minutes_summary`, `invitation_sent_at`, `invitation_recipients`, `quorum_met`, and any child-table writes.

### 3.5 Provision function

```sql
function public.provision_meetings_baseline_for_org(p_org_id uuid)
returns void
language plpgsql security definer
```

Does:
1. Insert one `meeting_org_template_settings` row per system template (enabled=true). Idempotent via composite PK.
2. Seed default `meeting_template_categories` for the org (system rows). Idempotent via `(org, slug)` unique.
3. Map each system template to its default category via the `default_category_slug` column.

Wired to `after insert on organizations` trigger. Backfill loop at migration end.

---

## 4 · Module file layout (under `modules/meetings/`)

```
modules/meetings/
  index.ts                              # barrel exports
  types.ts                              # row + enum + jsonb shapes
  schema.ts                             # zod parsers + parseRows helper
  useMeetings.ts                        # main hook (state + mutations)
  useMeetingsNav.ts                     # pinned nav items resolver for AticsShell
  useMeetingsCategories.ts              # sub-hook (parallel to useSurveyCategories)
  meetingsLegalReferences.tsx           # legal-refs banner
  meetingsLabels.ts                     # status label maps, framework labels
  meetingsModuleSettingsSchema.ts       # zod for module-level settings (notifications, invite template)
  meetingTemplateApply.ts               # template → instance materialisation helper
  meetingsAnalytics.ts                  # bucketers shared by datasets + CSV

  components/
    MeetingMetadataPanel.tsx            # mirrors ExecutionMetadataPanel
    MeetingAgendaList.tsx               # per-item minutes editor
    MeetingAttendeeRoster.tsx
    MeetingDecisionRegister.tsx
    MeetingActionItemsList.tsx
    MeetingProtocolSignaturePanel.tsx
    MeetingInvitationBanner.tsx
    MeetingMandatoryTopicsCheck.tsx     # warns on missing AML §7-2 topics

  dashboards/
    meetingsDashboardScope.ts           # registerDashboardScope({ scopeId: 'meetings', ... })
    useMeetingsDatasets.ts

  admin/
    MeetingsKategorierTab.tsx
    MeetingsMalerTab.tsx                # system + org templates list
    MeetingsTemplateEditorPanel.tsx     # template editor (admin)
    MeetingsModuleSettingsPanel.tsx

  pages/                                # (re-exported from modules)
    MeetingsHubLanding.tsx
    MeetingsPage.tsx                    # hub router (?template= / no params)
    MeetingsDetailView.tsx
    MeetingsAllePage.tsx
    MeetingsAnalysePage.tsx
    MeetingsAdminPage.tsx
```

---

## 5 · Compliance plan (advisory POV)

The seed system templates ship with the platform. Every template must encode:
1. **Mandatory agenda items** that map to law/standard sections.
2. **Required attendee roles** + minimum quorum.
3. **Cadence hint** that drives the Årshjul integration.
4. **Law refs** populating the dashboard drill-down.

### 5.1 Norwegian labour law (AML + IK-f + Hovedavtalen + Likestillingsloven)

| Slug | Template | Cadence | Required attendees | Mandatory agenda topics | Law refs |
|---|---|---|---|---|---|
| `amu-kvartalsmote-q1` | AMU kvartalsmøte Q1 | quarterly | chair, secretary, employer reps, employee reps, verneombud | Vernerunde-status, sykefraværsutvikling, opplæringsplan HMS | AML § 7-2, AML § 7-2 (2), IK-f § 5 nr. 7 |
| `amu-kvartalsmote-q2` | AMU kvartalsmøte Q2 | quarterly | (samme) | Arbeidsmiljøundersøkelse oppfølging, ROS-status, fysisk arbeidsmiljø | AML § 7-2, AML § 4-1 |
| `amu-kvartalsmote-q3` | AMU kvartalsmøte Q3 | quarterly | (samme) | Psykososialt arbeidsmiljø, varslingssaker, mobbing/trakassering | AML § 7-2, AML § 4-3, AML § 2A-7 (5) |
| `amu-arsrapport-q4` | AMU årsmøte + årsrapport | annual | (samme) | Årsrapport AMU, neste års plan, evaluering, godkjenning § 7-2 (6) | AML § 7-2 (6), Forskrift om org. ledelse § 3-4 |
| `verneombud-mote` | Verneombudsmøte | quarterly | verneombud (alle), hovedverneombud | Vernerunde-rapporter, avvik, opplæring | AML § 6-2, AML § 6-5 |
| `bedriftsutvalg` | Bedriftsutvalgsmøte | quarterly | adm.dir, tillitsvalgte, ledere | Drift, økonomi, organisasjon | Hovedavtalen § 9-3 |
| `drofting-omstilling` | Drøftingsmøte – omstilling | ad_hoc | adm.dir, tillitsvalgte | Begrunnelse, alternativer, konsekvenser, ansattes synspunkter | AML § 8-2, AML § 15-1 |
| `drofting-likestilling` | Drøftingsmøte – aktivitetsplikt | annual | adm.dir, tillitsvalgte, likestillingskontakt | Lønnskartlegging, kjønnsbalanse, tilretteleggingsbehov | Likestillingsloven § 26, § 26a |
| `mus` | Medarbeidersamtale (MUS) | annual | leder, ansatt | Mål, utvikling, trivsel, HMS, varslingsrutiner | AML § 4-2, AML § 4-3 |
| `personalmote` | Personalmøte | monthly | leder, alle ansatte i enhet | Informasjon, høring, HMS-tema | AML § 4-2 |
| `allmote` | Allmøte | semiannual | adm.dir, alle ansatte | Strategi, drift, HMS | AML § 4-2 |
| `varslingsutvalg` | Varslingsutvalgsmøte | ad_hoc | utvalg, ekstern fagperson | Saksgang, taushetsplikt, oppfølging, oversikt | AML § 2A-7 |

### 5.2 ISO management reviews

| Slug | Standard | Cadence | Mandatory agenda |
|---|---|---|---|
| `iso-9001-ledelsens-gjennomgang` | ISO 9001:2015 § 9.3 | annual (semiannual recommended) | Kvalitetspolicy, mål, prosesser, kundefokus, revisjon, avvik, ressurser, forbedring |
| `iso-27001-isms-gjennomgang` | ISO/IEC 27001:2022 § 9.3 | annual | ISMS-status, risikobilde, hendelser, kontrolltiltak, ressurser, forbedring, eierskap |
| `iso-45001-ledelsens-gjennomgang` | ISO 45001:2018 § 9.3 | annual | HMS-policy, mål, risiko, lovkrav, hendelser, høring, forbedring |
| `iso-14001-miljogjennomgang` | ISO 14001:2015 § 9.3 | annual | Miljøpolicy, miljømål, etterlevelse, hendelser, ressursbruk |

### 5.3 GDPR / personvern

| Slug | Authority | Cadence | Mandatory agenda |
|---|---|---|---|
| `gdpr-dpia-gjennomgang` | GDPR Art. 35 | ad_hoc | Behandlingsformål, lovgrunnlag, risiko, tiltak, restrisiko, beslutning |
| `gdpr-ropa-arsgjennomgang` | GDPR Art. 30 | annual | ROPA-statusgjennomgang, oppdaterte behandlinger, slettefrister, leverandøravtaler |

### 5.4 Default categories (per org, seeded)

| Slug | Name | Description | Position |
|---|---|---|---|
| `aml-amu` | AML — AMU og verneombud | Møter etter Arbeidsmiljøloven kap. 6 og 7 | 10 |
| `aml-drofting` | AML — Drøfting og medvirkning | Drøftingsmøter, allmøter, personalmøter | 20 |
| `iso-styring` | ISO — Styringssystem | Ledelsens gjennomgang og ISMS-revisjon | 30 |
| `personvern` | Personvern (GDPR) | DPIA, ROPA, behandlingsansvarliges møter | 40 |
| `personal` | Personalsamtaler | MUS og individuell oppfølging | 50 |
| `intern` | Interne møter | Org-spesifikke møtetyper | 60 |

### 5.5 Compliance officer self-audit (per Arbeidstilsynet POV)

- [x] AML § 7-2 (2) mandatory annual topics encoded in `amu-arsrapport-q4.definition.agendaItems` with `isMandatory: true`.
- [x] AML § 7-2 (6) annual report obligation reflected in the Q4 template and `meeting_decisions` enables the auto-generated report.
- [x] AML § 6-2 verneombud meeting cadence at quarterly per `verneombud-mote.cadence_hint`.
- [x] Forskrift om org. ledelse § 3-2 — 7-day invitation rule encoded in `definition.invitationLeadDays = 7` for AMU; surfaced as a red badge if `invitation_sent_at + 7 days > scheduled_at`.
- [x] AML § 8-2 / § 15-1 drøftingsplikt — `drofting-omstilling` template forces "Begrunnelse" + "Alternativer" + "Konsekvenser" + "Ansattes synspunkter" as mandatory agenda items.
- [x] Likestillingsloven § 26a — `drofting-likestilling` template enforces annual cadence and lønnskartlegging agenda item.
- [x] AML § 2A-7 (5) — varslingsutvalg template separated from AMU, has confidentiality + COI prompts.
- [x] Hovedavtalen § 9-3 — bedriftsutvalg template available for orgs that choose this structure.
- [x] **Restrisiko** (acknowledged, not in scope for v1):
  - Verneombud threshold (5+ ansatte → mandatory) is a compliance-checklist surface, not a meetings surface. Cross-module surfaced via existing `useCouncil` thresholds — no duplication.
  - Truly secret election ballots remain in scope of `modules/amu/` (representatives elections), not this module.
  - eSignature (BankID) integration is deferred; protocol-signature UI labels itself as "Bekreftelse (forhåndsregistrering — ikke juridisk signatur)" per Council Review §3.4.

---

## 6 · Phase plan

### Phase A · DB schema + seed templates  *(1 commit, the foundation)*

**A1** Migration `20260901120000_meetings_module_core.sql` — every table + RLS + triggers + provision fn.
**A2** Migration `20260901120001_meetings_seed_system_templates.sql` — system templates listed in §5.1-5.3.

Acceptance: `select count(*) from meeting_system_templates` returns ≥ 18 rows.
Re-applying migration is a no-op.

### Phase B · Module skeleton  *(1 commit)*

`modules/meetings/{types.ts, schema.ts, useMeetings.ts, index.ts}` + barrel exports + `meetingsLabels.ts`.
No UI yet. TS clean.

Acceptance: `import { useMeetings } from 'modules/meetings'` compiles. Hook loads from Supabase (empty state) without crashing.

### Phase C · UI shell  *(1-2 commits)*

`MeetingsPage.tsx` (router), `MeetingsHubLanding.tsx`, `MeetingsDetailView.tsx` (read-only first pass — tabs: Oversikt, Agenda, Deltakere, Vedtak, Protokoll), `MeetingsAllePage.tsx`, minimal `MeetingsAdminPage.tsx` (templates list, no editor yet).

Acceptance: navigate to `/meetings`, see system templates grouped by category. Click a template → see "no meetings yet, +Create".

### Phase D · Analyse page + dashboard scope  *(1 commit)*

`meetingsDashboardScope.ts` + `useMeetingsDatasets.ts` + `MeetingsAnalysePage.tsx` + default layout + dataset catalog.

Acceptance: `/meetings/analyse` opens, KPI tiles render, default layout matches the cross-module conventions.

### Phase E · Sidebar + routes + permissions  *(1 commit)*

`AticsShell.tsx` adds `meetingsGroup` between Documents and Tasks (per CLAUDE.md IA), `meetingsFixedSubs` for Analyse + Innstillinger, `useMeetingsNav` resolver. `App.tsx` routes. `permissionKeys.ts` adds `module.view.meetings` + `meetings.manage`.

Acceptance: top-level "Møter" entry visible in sidebar with Analyse/Innstillinger children and pinned templates below.

### Phase F (✅ shipped) · Legacy AMU + Council removal

Shipped in PR #237. The legacy `modules/amu/`, `modules/amu_election/`, `src/pages/CouncilModule.tsx`, and ~14 supporting files were deleted; `useCouncil` consumers migrated to `useMeetings`. The AMU election capability was re-homed as the `amu-valg-system` placeholder row in `survey_template_catalog` (full eligibility/sealing/handoff implementation deferred — see `ROADMAP.md §8.19`).

---

## 7 · Datasets for `meetings` dashboard scope (Phase D input)

| Key | Shape | Bucket logic |
|---|---|---|
| `meeting_kpi_summary` | kpi-record | `{ total, planned, completed, cancelled, overdueSign, mandatoryMissing, decisionsOpen, decisionsImplementedYtd }` |
| `meeting_status_distribution` | segments | `{ Planlagt, Pågår, Gjennomført, Avlyst }` |
| `meeting_framework_distribution` | segments | per `framework` (AML / ISO_9001 / ISO_27001 / ...) |
| `meeting_template_distribution` | segments | top-N templates by instance count |
| `meeting_category_distribution` | segments | by category |
| `meeting_completion_over_time` | series | last-12-month buckets by `completed_at` |
| `meeting_decisions_over_time` | series | last-12 months by `decisions.decision_at` |
| `meeting_quorum_distribution` | segments | `{ Quorum, IkkeQuorum, Ukjent }` |
| `meeting_invitation_compliance` | segments | `{ I tide (≥ leadDays), For sent (< leadDays), Ikke sendt }` |
| `meeting_instances_by_location` | segments | per location_id |
| `meeting_instances_by_department` | segments | per department_id |
| `meeting_law_ref_coverage` | segments | exact-string buckets over `definition.agendaItems[].lawRef` × instances completed |

Default layout (8 widgets):
1. KPI Total (sm) · KPI Planlagt (sm) · KPI Gjennomført (sm) · KPI Vedtak åpne (sm)
2. Donut: status (md)
3. Donut: framework (md)
4. Line: completion over time (lg)
5. Bar: top templates (md)

Accent: `#0891b2` (cyan) — distinct from existing scopes.

---

## 8 · Acceptance criteria for the whole module v1

After Phase A-E ships:
- [ ] `/meetings` opens, lists 18+ system templates grouped by category.
- [ ] Create a meeting from a system template — definition is snapshotted, agenda items materialised.
- [ ] Edit per-item minutes + decision + votes on a meeting; reload preserves them.
- [ ] Sign protocol → meeting is locked from identity changes but metadata still editable.
- [ ] Closed meeting can be reassigned to a different location/department.
- [ ] `/meetings/analyse` shows KPIs that respond to filter chips (status, framework, template, location, department, period).
- [ ] Sidebar shows Møter with Analyse + Innstillinger fixed children.
- [ ] Admin can: toggle a system template, change its category, override its name; create an org custom template from scratch.
- [ ] Mandatory-topics check on a Q4 AMU meeting flags missing AML § 7-2 (6) items.
- [ ] 7-day invitation badge shows red when invitation sent < 7 days before AMU.
- [ ] `npx tsc -b` clean. ESLint clean on touched files. Migration re-runnable.

---

## 9 · House-style checklist (mirrors PLAYBOOK §8)

- Norwegian (nb) for user-facing strings; English for code/types/commits.
- Side-effect import `import './dashboards/meetingsDashboardScope'` from `MeetingsAnalysePage.tsx`.
- Use `freshId('meeting')` not bespoke `crypto.randomUUID` polyfills.
- Component file headers: 3-6 lines, *why* not *what*.
- Migration header: 4-8 lines incl. Arbeidstilsynet self-audit (which pålegg-grunn the seed addresses).

---

## 10 · Senior architect self-review (PLAYBOOK §7)

- [x] **Reference precedent linked** — every architectural decision in §2 cites the source module.
- [x] **Vertical slices** — phases A-E each ship a working end-state.
- [x] **Dependency graph DAG** — A → B → (C, D in parallel) → E.
- [x] **Acceptance criteria observable** — §8 is all user-visible behaviour.
- [x] **Open questions enumerated** — §11.
- [x] **Migrations idempotent / additive** — all use `if not exists` / `on conflict do nothing`.
- [x] **Spec self-contained** — readable without re-opening other module specs.
- [x] **Playbook stays generic** — no module-specific edits propagated to PLAYBOOK.

**Concerns identified during self-review (applied):**

1. **Initially considered making `system_template_id` and `org_template_id` two
   separate FK columns on `meetings` with no discriminator.** Risk: ambiguous
   joins when both nullable. Fix: added `source_kind` discriminator + check
   constraint that exactly one is non-null.
2. **First draft had `meeting_decisions` as a view over agenda_items.** Switched
   to a materialised table so the global Vedtaksregister can be queried + indexed
   without touching every agenda row, and so a decision can outlive an agenda-item
   edit (audit-trail integrity).
3. **`attendees` initially planned as a single jsonb column on `meetings`** like
   the council module's `attendees text[]`. Promoted to a normalised
   `meeting_attendees` table so present/excused/digital is queryable for analytics
   and the quorum-check is a simple SQL aggregate, not a client-side scan.
4. **Tasks integration:** rather than rebuild action-tracking, `meeting_action_items.task_id`
   references the existing tasks system. Bidirectional reference closes Council
   Review §2.4.
5. **Co-existence with AMU module:** I almost moved AMU's data into the new
   module in Phase A. Stopped — the AMU module is live + battle-tested + has
   election/verneombud workflows orthogonal to meetings. Phase F (deferred)
   will do the merger properly with an import script + dual-write window.

**Result:** `📋 ready to execute`.

---

## 11 · Open questions

| ID | Question | Default if unanswered |
|---|---|---|
| OQ-M1 | Do we need a separate `meeting_packs` table (like compliance/survey) for license-gating templates? | **No** — framework is a column on the system template; license-gating piggybacks on existing module-permission `module.view.meetings`. ISO/GDPR templates are visible to all orgs by default; orgs disable what they don't need via settings. |
| OQ-M2 | Should `meeting_action_items.task_id` FK be to an actual table or a jsonb id (tasks today are jsonb in `org_module_payload`)? | Use plain `uuid` (no FK constraint) — matches the tasks-parity spec's "tasks are jsonb-backed" reality. The page resolves it client-side. |
| OQ-M3 | Should the protocol signature use the existing `level1_signature_events` infrastructure? | **Yes** — store `level1_event_id` on `meeting_signatures` and let the existing audit ledger view the entries. |
| OQ-M4 | Does the `meetings` table need a `pack` column or is `framework` (from template) sufficient? | Sufficient — meetings inherit framework via template. No per-instance pack switching. |
| OQ-M5 | Do drøftingsmøter need a private confidentiality flag (separate visibility)? | **Yes — in scope for v1.** ORG_ACCESS_CONTROL_ANALYSIS flagged HR drøftelsessamtaler (AML § 15-1) as a critical-gap security concern. v1 ships `confidentiality_level text not null default 'standard' check in ('standard','restricted','confidential')` plus RLS that gates `restricted`/`confidential` rows to: `participant_member_ids` ∋ current user, the `created_by` user, anyone holding `meetings.manage_confidential` permission, or org owners. Child tables (`meeting_agenda_items`, `meeting_attendees`, `meeting_decisions`, `meeting_action_items`, `meeting_signatures`) inherit visibility through `exists(... from meetings m where m.id = child.meeting_id and m.<rls predicate>)`. |

---

## 12 · Migration ordering

```
20260901120000  meetings_module_core.sql            (all tables + RLS + triggers + provision fn)
20260901120001  meetings_seed_system_templates.sql  (system templates §5)
```

Both at `supabase/migrations/` top-level (CLAUDE.md convention). Basenames are
unique across the tree (verified against `supabase/migrations/archive/`
which tops out at `20260830120016`).

---

## 13 · House-style commit messages

```
meetings(db): seed module core — tables + RLS + provision fn (phase A1)

Why
- New top-level capability. Mirrors compliance/documents 3-layer template
  surface so future ISO/GDPR meetings ship as data, not code.

What moves
- meeting_system_templates, meeting_org_template_settings, meeting_org_templates
- meeting_template_categories, meetings, meeting_agenda_items, meeting_attendees
- meeting_decisions, meeting_action_items, meeting_signatures
- BEFORE UPDATE lock trigger on meetings (mirrors compliance)
- provision_meetings_baseline_for_org() + on-org-insert trigger

Self-audit (Arbeidstilsynet POV)
- AML § 7-2 obligations encoded via mandatory agenda items + cadence_hint
- 7-day invitation rule (Forskrift om org. ledelse § 3-2) carried as
  definition.invitationLeadDays — surfaced as red badge if breached
- Restrisiko: eSignature still demo-level (Council Review §3.4 noted)
```

---

## 14 · Klarert Phase 1+2 additions (post-ROADMAP §8.29-31)

The original §3 tables were extended with Klarert-design-derived additions
in the H13 batch. Shipped tables + RPCs:

| Table | Purpose |
|---|---|
| `meeting_votes` | Per-ballot record (one row per voter per agenda item). `side` enum drives AML § 7-1 (2) parity tally; `is_pre_vote` distinguishes async from live votes. Anonymous voting is a *display-time* concern — the schema always carries a non-null `member_id` so PG unique-key semantics work correctly. |
| `meeting_live_sessions` | Ephemeral live-room state per meeting (one row): `started_at`, `active_agenda_item_id`, `ended_at`. Timer elapsed is *derived* from `started_at` client-side; never written to the DB. |
| `meeting_speaker_queue` | Taleliste — append + drain queue per agenda item. Position-ordered; `given_floor_at` / `yielded_at` for floor handoff. |
| `meeting_external_invitees` | Token-gated non-user attendees (Arbeidstilsynet inspector, ekstern tillitsvalgt, BHT-guest). 128-bit `secure_token` via `crypto.getRandomValues`. Access levels: observer/speak/vote. |
| `meeting_digest_recipients` | Post-signing filtered distribution list. `recipient_filter` jsonb + `extract_mode` ('full' | 'decisions_only'). |

Plus `meetings.required_signer_roles text[]` (default `{chair,secretary}`)
and a CHECK on `meeting_agenda_items.voting_model in ('simple','qualified',
'parity','consensus','anonymous')`.

### 14.1 New RPCs

| Function | Returns | Purpose |
|---|---|---|
| `meeting_vote_result(p_agenda_item_id uuid)` | `jsonb {model, passed, reason, tally, parity}` | Server-computed outcome applying the correct rule per model. Parity model returns `passed=null, reason='parity_missing_employer/employee'` when one side has zero ballots — distinct from "not passed". |
| `meeting_parity_check(p_meeting_id uuid)` | `jsonb {employer_count, employee_count, bht_count, total_present_or_accepted, parity_ok, quorum_min, quorum_ok}` | SECURITY INVOKER so RLS-cascaded counts. Used by `ParityPanel` on the Deltakere tab + the live-room top-bar. |

### 14.2 New triggers

| Trigger | Fires | Behaviour |
|---|---|---|
| `meeting_check_all_signed_tg` | AFTER INSERT on `meeting_signatures` | Flips `protocol_signed_at` only when all `required_signer_roles` have signed. Replaces single-shot stamp in `meetings_sign_protocol_v1`. Race-safe via `WHERE protocol_signed_at IS NULL` guard. |
| `meeting_votes_set_org_id_tg` + speaker-queue equivalent | BEFORE INSERT | Auto-populates `organization_id` from the parent meeting (defense-in-depth — RLS already enforces via EXISTS-from-meetings cascade). |

### 14.3 UI surfaces shipped

- `/meetings/:id/live` — full-screen workspace, 3-col (agenda / active item + voting / speakers + attendance). Cyan accent #0891b2 per CLAUDE.md.
- `TimeBudgetBar` on Agenda tab — summed durations vs. meeting window.
- `CadenceWarningCard` on Hub — derived warnings for templates whose cadence is exceeded.
- `ParityPanel` on Deltakere tab — quorum + parity tiles.
- `RsvpRosterEditor` replaces the static attendance table on Deltakere tab.
- `AutoSourceRail` on Agenda tab — clickable cards for resolved data bindings.

### 14.4 Deferred (post-§8.31)

See ROADMAP entries 8.32-8.38: live-room Realtime sync, external-invitee public viewer, digest dispatch, chair-disconnect recovery, COI UI, GDPR erasure, vitest framework. Schemas are complete; UI/edge-function surfaces are the gap.
