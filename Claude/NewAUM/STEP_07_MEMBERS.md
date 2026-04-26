# Step 7 — Tab: Medlemmer

Create `modules/amu/tabs/MembersTab.tsx`.

Depends on: Step 5.
Reference: `Claude/NewAUM/04_UI_VIEWS.md` § "Tab 2 · Medlemmer".

---

## Layout

```tsx
<div className="grid grid-cols-[1fr_320px] gap-6">
  <div>{/* main */}</div>
  <div className="space-y-4">{/* right */}</div>
</div>
```

---

## Main card — member roster

```tsx
<ModuleSectionCard
  title={`AMU-medlemmer · ${amu.committee?.term_start ?? ''}–${amu.committee?.term_end ?? ''}`}
  headerRight={amu.canManage && <Button variant="primary">Legg til medlem</Button>}
>
```

Use a `<DataTable>` if available in `src/components/ui/`; otherwise a plain styled table inside the card.

Columns:

**Medlem** — avatar initials circle + `display_name` bold + `function_label` muted small

**Side** —
```tsx
<Badge variant={
  m.side === 'employer' ? 'warning' :
  m.side === 'employee' ? 'info' : 'success'
}>
  {m.side === 'employer' ? 'Arbeidsgiver' :
   m.side === 'employee' ? 'Arbeidstaker' : 'BHT'}
</Badge>
```

**Rolle** — `leader` → bold "Leder" + `<small>(rotere {nextYear})</small>` · `deputy_leader` → "Nestleder" · `member` → "Medlem" · `bht_observer` → "BHT-observatør"

**HMS-kurs** —
```tsx
const valid = m.hms_training_valid_until && new Date(m.hms_training_valid_until) >= new Date()
const expiringSoon = m.hms_training_valid_until &&
  new Date(m.hms_training_valid_until) < new Date(Date.now() + 90*24*60*60*1000)

<Badge variant={valid && !expiringSoon ? 'success' : expiringSoon ? 'warning' : 'danger'}>
  {valid ? `40t · gyldig` : `Utløpt`}
  {m.hms_training_valid_until && ` · ${formatDate(m.hms_training_valid_until)}`}
</Badge>
```

**Frammøte** — count from `amu.attendance` for current year's meetings for this member: `{present}/{total}`

**Stemmerett** — `m.voting ? '✓' : '–'`

Last column (only `canManage`): `<Button variant="ghost" size="sm">…</Button>` kebab menu placeholder.

---

## Composition warnings

Above the table, show compliance alerts:

```tsx
const employerVoting = amu.members.filter(m => m.side === 'employer' && m.voting && m.active).length
const employeeVoting = amu.members.filter(m => m.side === 'employee' && m.voting && m.active).length
const bhtPresent     = amu.members.some(m => m.side === 'bht' && m.active)

{employerVoting !== employeeVoting && (
  <WarningBox>
    Ubalanse i representasjon: {employerVoting} arbeidsgiver vs {employeeVoting} arbeidstaker (krav: lik AML § 7-1).
  </WarningBox>
)}
{!bhtPresent && (
  <WarningBox>BHT er ikke representert i utvalget (krav AML § 7-1 (3)).</WarningBox>
)}
```

---

## Right column

### Card — "Krav til sammensetning"

```tsx
<ModuleSectionCard title="Krav til sammensetning">
  <ComplianceBanner refs={['AML § 7-1']}>
    Likt antall representanter fra arbeidsgiver og arbeidstaker. BHT skal delta.
  </ComplianceBanner>
  <ul className="mt-3 space-y-2 text-sm">
    <li className="flex gap-2">
      {employerVoting > 0 ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
      {employerVoting} arbeidsgiverside
    </li>
    <li className="flex gap-2">
      {employeeVoting > 0 ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
      {employeeVoting} arbeidstakersside
    </li>
    <li className="flex gap-2">
      {bhtPresent ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
      BHT representert
    </li>
  </ul>
</ModuleSectionCard>
```

### Card — "Frammøte {year}"

List each meeting from `amu.meetings` filtered to current year:

```tsx
{yearMeetings.map(m => {
  const att = amu.attendance.filter(a => a.meeting_id === m.id)
  const presentCount = att.filter(a => a.status === 'present').length
  const totalCount   = amu.members.length
  const ratio        = totalCount > 0 ? presentCount / totalCount : 0
  return (
    <div key={m.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
      <div className={`w-3 h-3 rounded-full ${ratio >= 0.5 ? 'bg-green-500' : 'bg-red-400'}`} />
      <span className="text-sm flex-1">{m.title}</span>
      <span className="text-xs text-gray-500">{presentCount}/{totalCount}</span>
    </div>
  )
})}
```

---

## Commit

```
feat(amu): Medlemmer tab — roster + composition check
```
