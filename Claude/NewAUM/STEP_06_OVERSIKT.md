# Step 6 — Tab: Oversikt

Create `modules/amu/tabs/OverviewTab.tsx`.

Depends on: Step 5 (`AmuHook` type, page shell).
Reference: `Claude/NewAUM/04_UI_VIEWS.md` § "Tab 1 · Oversikt" and `AMU Mockup.html` first tab.

---

## Layout

```tsx
<div className="space-y-6">
  {/* KPI row */}
  <div className="grid grid-cols-4 gap-4">…</div>

  {/* Two-column body */}
  <div className="grid grid-cols-[1fr_380px] gap-6">
    <div className="space-y-6">   {/* left */} </div>
    <div className="space-y-6">   {/* right */} </div>
  </div>
</div>
```

---

## KPI row — 4 `<ModuleSectionCard>` stat blocks

| # | Label | Value | Footer |
|---|---|---|---|
| 1 | Møter i {year} | `{meetings_held} / {meetings_required}` | `Lovkrav: 4 · neste {next.scheduled_at formatted}` |
| 2 | Sammensetning | `{members.length} medlemmer` | `{employer}/{employee} paritet · BHT representert` |
| 3 | Saker til behandling | count of `agendaItems` where `status='pending'` | `{n} må avklares før neste møte` |
| 4 | Kritiske aktiviteter | `criticalQueue.length` | `{n} forsinket signering` |

KPI 4 gets `className="border-l-4 border-l-red-500"` when `criticalQueue.length > 0`.

Derive `next` as `meetings.find(m => m.status === 'scheduled')`.

---

## Left column

### Card 1 — "Neste møte — automatisk saksliste"

```tsx
<ModuleSectionCard
  title="Neste møte — automatisk saksliste"
  headerRight={<>
    <Badge variant="info">AML § 7-2</Badge>
    <Button variant="ghost">Forhåndsvis</Button>
    {amu.canManage && (
      <Button variant="primary" onClick={() => amu.startMeeting(next.id)}>
        Åpne møterom
      </Button>
    )}
  </>}
>
```

Body when `next` exists:
- Date pill (Forest Green bg `#1a3d32` text-white rounded-full px-3 py-1) — formatted `next.scheduled_at`
- Title h3 + location meta
- Attendee avatars row (first 5 `amu.members`, +N more)
- Auto-tag row: `<Badge variant="success">Saksliste generert automatisk</Badge>` + caption + `{amu.canManage && <Button variant="ghost">Rediger</Button>}`
- Agenda list: map `agendaItems` filtered to `next.id`, sorted by `position`. Each item: position circle (w-6 h-6 rounded-full bg-gray-100 text-xs flex items-center justify-center) · title · `<Badge>{item.source_type}</Badge>` · `{item.legal_ref && <Badge variant="neutral">{item.legal_ref}</Badge>}`

Body when no next meeting: `<InfoBox>Ingen kommende møter. Beram neste møte under Møteplan.</InfoBox>`

When `agendaItems` for next meeting is empty and `amu.canManage`:
```tsx
<Button variant="secondary" onClick={() => amu.generateAutoAgenda(next.id)}>
  Generer saksliste automatisk
</Button>
```

### Card 2 — "Lovkrav inneværende år"

```tsx
<ModuleSectionCard title="Lovkrav inneværende år"
  headerRight={<ComplianceBanner refs={['AML kap. 7','IK § 5']} compact />}
>
```

Map these rows from `amu.compliance`:

| Label | Ok condition | Link target |
|---|---|---|
| Minimum 4 møter | `meetings_held >= meetings_required` | `schedule` tab |
| Lik representasjon | `parity_ok` | `members` tab |
| BHT representert | `bht_present` | `members` tab |
| HMS-kurs gyldig | `hms_training_all_valid` | `members` tab |
| Årsrapport signert | `annual_report_signed` | `report` tab |

Each row:
```tsx
<div className="flex items-center gap-3 py-2 border-b last:border-0">
  {ok
    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
    : partial
    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
  }
  <span className="flex-1 text-sm">{label}</span>
  {!ok && <Button variant="ghost" size="sm">Fullfør →</Button>}
</div>
```

---

## Right column

### Card 3 — "Kritiske aktiviteter"

```tsx
<ModuleSectionCard
  title="Kritiske aktiviteter"
  headerRight={<Badge variant="danger">{amu.criticalQueue.length} åpne</Badge>}
>
  {amu.criticalQueue.map(item => (
    <div key={item.source_id}
      className={`flex items-start gap-3 p-3 rounded border-l-4 mb-2
        ${item.severity === 'high' ? 'border-l-red-500 bg-red-50' : 'border-l-amber-400 bg-amber-50'}`}
    >
      <span className="flex-1 text-sm">{item.label}</span>
      <Button variant="secondary" size="sm">Åpne</Button>
    </div>
  ))}
  {amu.criticalQueue.length === 0 && (
    <p className="text-sm text-gray-500 py-4 text-center">Ingen kritiske aktiviteter</p>
  )}
</ModuleSectionCard>
```

### Card 4 — "Årsrapport {year}"

```tsx
<ModuleSectionCard
  title={`Årsrapport ${new Date().getFullYear()}`}
  headerRight={<Badge variant="neutral">§ 7-2 (6)</Badge>}
>
  {/* Progress summary */}
  <p className="text-sm text-gray-600 mb-4">
    {amu.annualReport?.status === 'signed'
      ? 'Signert og arkivert.'
      : 'Kladd under arbeid.'}
  </p>
  <Button variant="secondary" onClick={() => {/* switch to report tab */}}>
    Åpne kladd
  </Button>
</ModuleSectionCard>
```

---

## Commit

```
feat(amu): Oversikt tab — KPI row + next-meeting + compliance + critical cards
```
