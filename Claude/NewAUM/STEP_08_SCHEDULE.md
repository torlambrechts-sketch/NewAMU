# Step 8 — Tab: Møteplan

Create `modules/amu/tabs/ScheduleTab.tsx`.

Depends on: Step 5.
Reference: `Claude/NewAUM/04_UI_VIEWS.md` § "Tab 3 · Møteplan".

---

## Layout

```tsx
<div className="grid grid-cols-[1fr_380px] gap-6">
  <div>{/* timeline */}</div>
  <div className="space-y-4">{/* right */}</div>
</div>
```

---

## Main card — "Møteplan {year}"

```tsx
<ModuleSectionCard
  title={`Møteplan ${currentYear}`}
  headerRight={amu.canManage && (
    <Button variant="primary" onClick={() => setShowNewMeetingForm(true)}>
      Beram møte
    </Button>
  )}
>
```

Timeline list — `amu.meetings` filtered to current year, sorted by `scheduled_at`:

```tsx
{yearMeetings.map((m, i) => {
  const isNext = m.status === 'scheduled' && !yearMeetings.slice(0, i).some(prev => prev.status === 'scheduled')
  return (
    <div key={m.id}
      className={`flex items-start gap-4 py-3 border-b last:border-0
        ${missingQ4(m) ? 'border-l-4 border-l-red-500 pl-3' : ''}`}
    >
      {/* Date pill */}
      <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold
        ${isNext ? 'bg-[#1a3d32] text-white' : 'bg-gray-100 text-gray-700'}`}>
        {formatDate(m.scheduled_at)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{m.title}</span>
          <StatusBadge status={m.status} isNext={isNext} />
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {m.location} {m.is_hybrid && '· Hybrid'}
        </p>
      </div>

      <Button variant="secondary" size="sm">
        {m.status === 'signed' ? 'Se referat' : 'Åpne'}
      </Button>
    </div>
  )
})}
```

### `StatusBadge` helper (local, not exported)

```tsx
function StatusBadge({ status, isNext }: { status: string; isNext: boolean }) {
  if (status === 'signed')    return <Badge variant="success">Signert</Badge>
  if (status === 'completed') return <Badge variant="neutral">Fullført</Badge>
  if (status === 'in_progress') return <Badge variant="warning">Pågår nå</Badge>
  if (isNext)                 return <Badge variant="info">Neste</Badge>
  return <Badge variant="neutral">Berammet</Badge>
}
```

### Missing-meeting row

If `yearMeetings.length < (amu.committee?.min_meetings_per_year ?? 4)`:

```tsx
<div className="flex items-center gap-4 py-3 border-l-4 border-l-red-500 pl-3 bg-red-50 rounded">
  <Badge variant="danger">Lovkrav</Badge>
  <span className="text-sm flex-1">
    Mangler {(amu.committee?.min_meetings_per_year ?? 4) - yearMeetings.length} møte(r) for å oppfylle AML § 7-2
  </span>
  {amu.canManage && (
    <Button variant="primary" size="sm" onClick={() => setShowNewMeetingForm(true)}>
      Beram nå
    </Button>
  )}
</div>
```

### New meeting inline form (gated on `canManage`)

Show when `showNewMeetingForm`:

```tsx
<div className="border rounded-lg p-4 space-y-3 bg-gray-50">
  <StandardInput label="Tittel" value={title} onChange={…} />
  <StandardInput label="Dato og tid" type="datetime-local" value={scheduledAt} onChange={…} />
  <StandardInput label="Sted" value={location} onChange={…} />
  <div className="flex gap-2 justify-end">
    <Button variant="secondary" onClick={() => setShowNewMeetingForm(false)}>Avbryt</Button>
    <Button variant="primary" onClick={handleSchedule}>Beram</Button>
  </div>
</div>
```

`handleSchedule`:
```ts
await amu.scheduleMeeting({ title, scheduled_at: scheduledAt, location, status: 'draft' })
setShowNewMeetingForm(false)
```

---

## Right column

### Card — "Tidligere møter"

```tsx
<ModuleSectionCard title="Tidligere møter">
  {pastMeetings.map(m => (
    <div key={m.id} className="flex items-center gap-2 py-2 border-b last:border-0">
      <span className="text-sm flex-1">{m.title}</span>
      <span className="text-xs text-gray-400">{formatDate(m.scheduled_at)}</span>
      <Button variant="ghost" size="sm">Se →</Button>
    </div>
  ))}
</ModuleSectionCard>
```

Past meetings = `amu.meetings.filter(m => m.status === 'signed')` sorted descending.

### Card — "Foreslå sak til neste møte"

Available to all logged-in users (`amu.canPropose` is always `true`).

```tsx
<ModuleSectionCard title="Foreslå sak til neste møte">
  <StandardTextarea
    label="Beskrivelse av saken"
    value={proposalText}
    onChange={e => setProposalText(e.target.value)}
    rows={3}
  />
  <SearchableSelect
    label="Målmøte (valgfritt)"
    options={upcomingMeetings.map(m => ({ value: m.id, label: m.title }))}
    value={targetMeetingId}
    onChange={setTargetMeetingId}
    placeholder="Velg møte…"
  />
  <Button
    variant="primary"
    className="w-full mt-2"
    disabled={!proposalText.trim()}
    onClick={async () => {
      await amu.proposeTopic(proposalText, targetMeetingId)
      setProposalText('')
      setTargetMeetingId(undefined)
    }}
  >
    Send forslag
  </Button>
</ModuleSectionCard>
```

---

## Commit

```
feat(amu): Møteplan tab — timeline + topic proposal
```
