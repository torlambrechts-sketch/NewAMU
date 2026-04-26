# 04 · UI Views (per tab)

Page shell — identical for the whole module. Build it once in `modules/amu/AmuPage.tsx`:

```tsx
import { ModulePageShell, ModuleSectionCard } from '../../src/components/module'
import { Tabs, ComplianceBanner, WarningBox } from '../../src/components/ui'
import { useAmu } from './useAmu'

const TABS = [
  { id: 'overview',    label: 'Oversikt' },
  { id: 'members',     label: 'Medlemmer',       badgeCount: 7 },
  { id: 'schedule',    label: 'Møteplan',        badgeCount: 4 },
  { id: 'meetingroom', label: 'Møterom' },
  { id: 'critical',    label: 'Kritiske saker',  badgeCount: 5 },
  { id: 'report',      label: 'Årsrapport' },
] as const

export function AmuPage() {
  const amu = useAmu()
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('overview')

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Medvirkning' }, { label: 'Arbeidsmiljøutvalg' }]}
      title="Arbeidsmiljøutvalg"
      description="Partssammensatt utvalg som behandler virksomhetens HMS-arbeid"
      headerActions={<>
        <Button variant="secondary" onClick={() => exportAnnualReport()}>Eksporter årsrapport</Button>
        {amu.canManage && <Button variant="primary" onClick={() => openNewMeetingModal()}>Nytt møte</Button>}
      </>}
      tabs={<Tabs items={TABS} activeId={activeTab} onChange={setActiveTab} />}
      loading={amu.loading}
    >
      <ComplianceBanner refs={['AML § 7-1', '§ 7-2', '§ 7-3', 'IK-forskriften § 5']}>
        Lovpålagt utvalg for virksomheter med 50 eller flere ansatte.
      </ComplianceBanner>

      {amu.error && <WarningBox>{amu.error}</WarningBox>}

      {activeTab === 'overview'    && <OverviewTab amu={amu} />}
      {activeTab === 'members'     && <MembersTab amu={amu} />}
      {activeTab === 'schedule'    && <ScheduleTab amu={amu} />}
      {activeTab === 'meetingroom' && <MeetingRoomTab amu={amu} />}
      {activeTab === 'critical'    && <CriticalTab amu={amu} />}
      {activeTab === 'report'      && <AnnualReportTab amu={amu} />}
    </ModulePageShell>
  )
}
```

Below: per tab, the layout, the components used, and the data-source mapping. **All controls — buttons, inputs, dropdowns, tabs, badges — must come from `src/components/ui/`.** No raw `<button>`, `<input>`, `<select>` or `<table>` chrome.

---

## Tab 1 · Oversikt

Two-column layout (`grid-cols-[1fr_380px] gap-6`). Above the columns, a 4-up KPI row.

### KPI row — `<ModuleSectionCard>` × 4 (or one card with 4 stat blocks)

| Label | Value | Foot |
|---|---|---|
| Møter i 2026 | `meetings_held` / `meetings_required` | "Lovkrav: 4 · neste {next.scheduled_at}" |
| Sammensetning | `members.length` medlemmer | "{employer}/{employee} paritet · BHT representert" |
| Saker til behandling | open agenda count | "{n} må avklares før neste møte" |
| Kritiske aktiviteter | `criticalQueue.length` | "{n} forsinket signering" |

Severity left-border on the critical KPI (`border-l-4 border-l-red-500`).

### Left column

**Card 1 — "Neste møte — automatisk saksliste"** (`<ModuleSectionCard>`)
- Header: title + `<Badge variant="info">AML § 7-2</Badge>` + `<Button variant="ghost">Forhåndsvis</Button>` + `<Button variant="primary">Åpne møterom</Button>`
- Body: date pill (Forest Green) · meeting title · location · attendee avatars
- Auto-tag row: `<Badge variant="success">Saksliste generert automatisk</Badge>` + small caption + `<Button variant="ghost">Rediger</Button>`
- Agenda list (8 rows): position circle · title · source caption with `<Badge>` for `legal_ref` · right-side `<Badge>` showing source type (`Standard` / `Auto`)
- `canManage` gates the Rediger and Åpne møterom actions.

**Card 2 — "Lovkrav inneværende år"**
- Header: title + `<ComplianceBanner refs={['AML kap. 7','IK § 5']}>`
- Body: list of compliance rows. Each row = circle indicator (`ok` ✓ green / `partial` ! amber / `miss` × red) + label + small + status text on right.
- Rows derive from `amu_compliance_status` view. Missing items show `<Button variant="ghost">Fullfør →</Button>` linking to the relevant tab.

### Right column

**Card 3 — "Kritiske aktiviteter"**
- Header: title + `<Badge variant="danger">{n} åpne</Badge>`
- Body: alert-style rows with severity left-border. Each row links to the source module (avvik, varsling, signering).

**Card 4 — "Årsrapport 2026"**
- Header: title + `<Badge variant="neutral">§ 7-2 (6)</Badge>`
- Body: progress ring (use existing `<ProgressRing>` if present, else `<ModulePreflightChecklist>` summary) + caption + `<Button variant="secondary">Åpne kladd</Button>`

---

## Tab 2 · Medlemmer

Layout: `grid-cols-[1fr_320px] gap-6`.

### Main card — "AMU-medlemmer · valgperiode"

Use a `<DataTable>` if one exists in `src/components/ui/`; otherwise a `ModuleSectionCard` with `<table>` styled by the existing module CSS (no per-cell Tailwind soup). Columns:

| Medlem (avatar + name + function) | Side | Rolle | Verv | HMS-kurs | Frammøte | … |

- **Side** — `<Badge variant="info">Arbeidstaker</Badge>` / `variant="warning">Arbeidsgiver</Badge>` / `variant="success">BHT</Badge>`
- **Verv** — bold "Leder" / "Nestleder" with small "(rotere {year+1})"
- **HMS-kurs** — `<Badge variant="success">40t · gyldig</Badge>` or `variant="warning">Utløper {date}</Badge>`. Drives the `hms_training_all_valid` compliance flag.
- **Frammøte** — `{present}/{total}` per current year
- Edit menu only when `canManage`.

### Right column

- **"Krav til sammensetning"** — `<ModuleSectionCard>` containing `<ComplianceBanner>` referencing AML § 7-1 + bullet list (3 employer ✓ / 3 employee ✓ / BHT ✓)
- **"Frammøte 2026"** — list of meetings with circle indicators (ok/partial)

---

## Tab 3 · Møteplan

Layout: `grid-cols-[1fr_380px] gap-6`.

### Main card — "Møteplan 2026"

Timeline list. Each row: date pill (next meeting filled Forest Green) + title with status `<Badge>` + meta line + right-side `<Button>`.

Status → badge variant:
- `signed` → `<Badge variant="success">Signert</Badge>`
- `scheduled` and is next → `<Badge variant="info">I dag</Badge>` / "Neste"
- `scheduled` and future → `<Badge variant="neutral">Berammet</Badge>`
- Q4 missing → severity left-border red row + `<Badge variant="danger">Lovkrav</Badge>` + `<Button variant="primary">Beram nå</Button>` (gated on `canManage`)

### Right column

- **"Tidligere møter"** — alert-row list, each linking to read-only møteprotokoll
- **"Foreslå sak til neste møte"** — `<StandardTextarea>` + `<SearchableSelect>` for target meeting + `<Button variant="primary">Send forslag</Button>`. Available to all logged-in users (`canPropose`).

---

## Tab 4 · Møterom (live meeting)

Visible when there is an `in_progress` meeting (or via "Åpne møterom" CTA from Oversikt).

Layout: `grid-cols-[1fr_320px] gap-6`.

### Header strip
Meeting title (large, serif if existing module uses serif headlines) + `<Badge variant="success" dot>Pågår nå · {clock}</Badge>` + `<Button variant="secondary">Pause møte</Button>` + `<Button variant="primary">Avslutt og signer referat</Button>` (gated on `canChair`).

### Main column — agenda cards

Each agenda item is a card. States:
- **Decided** — collapsed, position cell shows ✓, right-side `<Badge variant="success">Vedtatt</Badge>` + decision summary line
- **Active** — expanded, Forest-green outline. Body contains:
  - Two-column "Bakgrunn fra avvik / Lenker"
  - "Notater fra møtet" — `<StandardTextarea>` saved live to `amu_agenda_items.notes`
  - Decision box (Forest soft bg) — `<StandardTextarea>` for `decision_text`, three small `<StandardInput>` for votes_for/against/abstained, `<SearchableSelect>` for responsible member, date input for due_date, optional `<SearchableSelect>` to link an action in tiltaksplan
  - Footer: `<Button variant="secondary">Forrige sak</Button>` + `<Button variant="primary">Bekreft vedtak og gå videre</Button>` (advances item to `decided`, next item to `active`)
- **Pending** — collapsed, right-side `<Badge variant="neutral">Står for tur</Badge>` / `<Badge variant="neutral">Venter</Badge>`

### Right column

- **"Deltakere"** — roster pulled from `amu_attendance`. Each row: avatar + name + role + check-mark toggle (`<YesNoToggle>` for `present`/`absent`). BHT-rep marked "(uten stemmerett)".
- **"Møtetid"** — elapsed-time card (large numeric) + simple progress bar + sak counter ("2 av 8 saker behandlet")

### Closing the meeting
Pressing **"Avslutt og signer referat"** triggers `<ModulePreflightChecklist>` listing:
- Alle saker behandlet eller utsatt
- Alle vedtak har ansvarlig + frist
- Notater lagret
- Deltakelse registrert
Then `<ModuleSignatureCard role="leader">` + `<ModuleSignatureCard role="deputy">`. Only `canChair` users can sign. Once signed, `amu_meetings.status = 'signed'` (immutable per RLS).

---

## Tab 5 · Kritiske saker

KPI row of 3 (`<ModuleSectionCard>` × 3): Avvik åpne · Varsler åpne · Manglende signaturer.

### Card — "Avvik som AMU må behandle"
Read-only list pulled from the existing avvik module (filter: `requires_amu_review = true OR risk >= 12`). Severity left-borders on each row. Last column = `<Button variant="secondary">Åpne</Button>` linking to that avvik.

### Two-column grid

- **"Varslingssaker — aggregert"** — only counts (open / closed YTD). `<ComplianceBanner refs={['AML § 2 A-3']}>AMU mottar kun aggregerte tall uten persondata.</ComplianceBanner>` Contact = `committee.leader`.
- **"Manglende signaturer"** — alert-row list. Each row: `<Button variant="secondary">Påminn</Button>` (sends notification) or `<Button variant="primary">Åpne</Button>`.

---

## Tab 6 · Årsrapport

Layout: `grid-cols-[1fr_380px] gap-6`.

### Main card — "Årsrapport · {year} (kladd)"

Header actions: `<Button variant="secondary">Eksporter PDF</Button>` + `<Button variant="primary" disabled={!canChair}>Send til signering</Button>`.

Body: 5 sections — each rendered as a panel with small uppercase eyebrow + body paragraph. Sections (driven by `amu_annual_reports.body` jsonb keys):
1. § 1 Sammensetning og møtevirksomhet
2. § 2 HMS-arbeid
3. § 3 Avvik og yrkesskader
4. § 4 Sykefravær
5. § 5 Varsling og medvirkning

Each paragraph is auto-generated server-side via `draftAnnualReport(year)` and then editable by `canChair` via inline `<StandardTextarea>`s.

### Right column

- **"Kildedata · auto-trukket"** — list of source datasets with completeness `<Badge>`s (Møtereferat 2/2 ✓, Avvik 14, Sykefravær 1/2 …).
- **"Versjoner"** — historical signed reports (read-only). Each row links to a static PDF.

### Sign-off

After `canChair` user clicks "Send til signering":
1. `<ModulePreflightChecklist>` validates that all referenced source data is present.
2. `<ModuleSignatureCard role="leader">` + `<ModuleSignatureCard role="deputy">` collect both signatures (different chair sides).
3. `amu_annual_reports.status = 'signed'`. Subsequent edits blocked by RLS.

---

## Component checklist (self-review before PR)

- [ ] No `<button className="…">` anywhere. All `<Button>`.
- [ ] No `<input className="…">` / `<textarea className="…">`. All `<StandardInput>` / `<StandardTextarea>`.
- [ ] No `<select>`. All `<SearchableSelect>`.
- [ ] No raw status pill divs. All `<Badge variant="…">`.
- [ ] Every legal reference in a `<ComplianceBanner>` or `<Badge>`, never as plain text.
- [ ] Page wrapped in `<ModulePageShell>`. Each card = `<ModuleSectionCard>`.
- [ ] All copy is Norwegian Bokmål.
- [ ] All Supabase calls live in `useAmu`. UI never imports `supabase` directly.
- [ ] Errors render via `<WarningBox>`.
- [ ] `canManage`, `canChair`, `canPropose` gates applied to every mutating control.
- [ ] Severity left-border classes used for risk lists.
