# Step 9 — Tab: Møterom (live meeting)

Create `modules/amu/tabs/MeetingRoomTab.tsx`.

Depends on: Step 5. This is the most complex tab — implement fully before moving on.
Reference: `Claude/NewAUM/04_UI_VIEWS.md` § "Tab 4 · Møterom".

---

## Guard: no active meeting

```tsx
const activeMeeting = amu.meetings.find(m =>
  m.status === 'in_progress' || m.status === 'scheduled'
)
if (!activeMeeting) {
  return (
    <InfoBox>
      Ingen aktiv møteøkt. Åpne et planlagt møte fra Møteplan-fanen.
    </InfoBox>
  )
}
```

On mount when `activeMeeting` exists:
```ts
useEffect(() => {
  amu.loadMeetingDetail(activeMeeting.id)
}, [activeMeeting.id])
```

---

## Header strip

```tsx
<div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-lg border">
  <div className="flex-1">
    <h2 className="text-lg font-semibold">{activeMeeting.title}</h2>
  </div>
  <Badge variant="success" dot>
    {activeMeeting.status === 'in_progress' ? `Pågår nå · ${elapsedTime}` : 'Planlagt'}
  </Badge>
  {amu.canManage && activeMeeting.status === 'scheduled' && (
    <Button variant="secondary" onClick={() => amu.startMeeting(activeMeeting.id)}>
      Start møte
    </Button>
  )}
  {amu.canChair && activeMeeting.status === 'in_progress' && (
    <Button variant="primary" onClick={() => setShowSignOff(true)}>
      Avslutt og signer referat
    </Button>
  )}
</div>
```

Elapsed time: `useEffect` with `setInterval(1000)` computing `now - meetingStartTime`.

---

## Body layout

```tsx
<div className="grid grid-cols-[1fr_320px] gap-6">
  <div>{/* agenda cards */}</div>
  <div className="space-y-4">{/* attendance + timer */}</div>
</div>
```

---

## Agenda cards

`meetingAgendaItems = amu.agendaItems.filter(ai => ai.meeting_id === activeMeeting.id).sort by position`

```tsx
{meetingAgendaItems.map(item => (
  <AgendaItemCard
    key={item.id}
    item={item}
    decision={amu.decisions.find(d => d.agenda_item_id === item.id)}
    members={amu.members}
    canManage={amu.canManage}
    onDecisionSave={(dec) => amu.recordDecision(dec)}
    onAdvance={handleAdvanceItem}
  />
))}
```

### `AgendaItemCard` — local component

Three visual states based on `item.status`:

**`decided`** — collapsed:
```tsx
<div className="flex items-center gap-3 p-3 bg-gray-50 rounded border opacity-75">
  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
  <span className="w-6 h-6 rounded-full bg-gray-200 text-xs flex items-center justify-center shrink-0">
    {item.position}
  </span>
  <span className="flex-1 text-sm line-through text-gray-500">{item.title}</span>
  <Badge variant="success">Vedtatt</Badge>
  {decision && <span className="text-xs text-gray-400 max-w-[200px] truncate">{decision.decision_text}</span>}
</div>
```

**`active`** — expanded with Forest-green outline:
```tsx
<div className="border-2 border-[#1a3d32] rounded-lg p-4 space-y-4">
  {/* header */}
  <div className="flex items-center gap-2">
    <span className="w-7 h-7 rounded-full bg-[#1a3d32] text-white text-xs flex items-center justify-center font-bold">
      {item.position}
    </span>
    <h3 className="font-semibold">{item.title}</h3>
    {item.legal_ref && <Badge variant="neutral">{item.legal_ref}</Badge>}
    <Badge>{item.source_type}</Badge>
  </div>

  {/* notes */}
  <StandardTextarea
    label="Notater fra møtet"
    value={notes}
    onChange={e => setNotes(e.target.value)}
    rows={3}
  />

  {/* decision box */}
  <div className="bg-[#f0f7f4] rounded-lg p-4 space-y-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-[#1a3d32]">Vedtak</p>
    <StandardTextarea
      label="Vedtakstekst"
      value={decisionText}
      onChange={e => setDecisionText(e.target.value)}
      rows={2}
    />
    <div className="grid grid-cols-3 gap-2">
      <StandardInput label="For" type="number" min={0} value={votesFor} onChange={…} />
      <StandardInput label="Mot" type="number" min={0} value={votesAgainst} onChange={…} />
      <StandardInput label="Avst." type="number" min={0} value={votesAbstained} onChange={…} />
    </div>
    <SearchableSelect
      label="Ansvarlig"
      options={amu.members.map(m => ({ value: m.id, label: m.display_name }))}
      value={responsibleId}
      onChange={setResponsibleId}
    />
    <StandardInput label="Frist" type="date" value={dueDate} onChange={…} />
  </div>

  {/* footer */}
  <div className="flex gap-2 justify-end">
    <Button variant="secondary" onClick={handlePrevious}>Forrige sak</Button>
    <Button variant="primary" onClick={handleConfirmAndAdvance}>
      Bekreft vedtak og gå videre
    </Button>
  </div>
</div>
```

`handleConfirmAndAdvance`:
1. `await amu.recordDecision({ agenda_item_id: item.id, decision_text, votes_for, votes_against, votes_abstained, responsible_member_id, due_date })`
2. Update `item.status = 'decided'` via supabase (via a new `updateAgendaItemStatus(id, status)` call in hook — add this to useAmu)
3. Set next item `status = 'active'`

**`pending`** — collapsed:
```tsx
<div className="flex items-center gap-3 p-3 rounded border">
  <span className="w-6 h-6 rounded-full bg-gray-100 text-xs flex items-center justify-center shrink-0">
    {item.position}
  </span>
  <span className="flex-1 text-sm text-gray-600">{item.title}</span>
  <Badge variant="neutral">Venter</Badge>
</div>
```

---

## Right column

### Attendance card

```tsx
<ModuleSectionCard title="Deltakere">
  {amu.members.map(m => {
    const att = amu.attendance.find(a => a.meeting_id === activeMeeting.id && a.member_id === m.id)
    return (
      <div key={m.id} className="flex items-center gap-2 py-2 border-b last:border-0">
        <div className="w-7 h-7 rounded-full bg-gray-200 text-xs flex items-center justify-center shrink-0 font-semibold">
          {m.display_name.split(' ').map(n => n[0]).join('').slice(0,2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{m.display_name}</p>
          <p className="text-xs text-gray-400">{m.function_label ?? m.role}</p>
          {!m.voting && <p className="text-xs text-gray-400">(uten stemmerett)</p>}
        </div>
        <YesNoToggle
          value={att?.status === 'present'}
          onChange={v => amu.updateAttendance(
            activeMeeting.id, m.id, v ? 'present' : 'absent'
          )}
          disabled={!amu.canManage}
        />
      </div>
    )
  })}
</ModuleSectionCard>
```

### Timer card

```tsx
<ModuleSectionCard title="Møtetid">
  <div className="text-4xl font-mono font-bold text-center py-4">
    {formatElapsed(elapsedSeconds)}
  </div>
  <p className="text-xs text-center text-gray-500">
    {decidedCount} av {meetingAgendaItems.length} saker behandlet
  </p>
</ModuleSectionCard>
```

---

## Sign-off modal (`showSignOff`)

Shown when user clicks "Avslutt og signer referat".

```tsx
<ModulePreflightChecklist
  items={[
    { label: 'Alle saker behandlet eller utsatt', ok: allItemsDone },
    { label: 'Alle vedtak har ansvarlig og frist', ok: allDecisionsHaveResponsible },
    { label: 'Deltakelse registrert', ok: attendanceComplete },
  ]}
/>
{allChecksPassed && <>
  <ModuleSignatureCard
    role="leader"
    signerName={leader?.display_name ?? 'Leder'}
    onSign={leaderId => setLeaderSignerId(leaderId)}
  />
  <ModuleSignatureCard
    role="deputy"
    signerName={deputy?.display_name ?? 'Nestleder'}
    onSign={deputyId => setDeputySignerId(deputyId)}
  />
  <Button
    variant="primary"
    disabled={!leaderSignerId || !deputySignerId}
    onClick={() => amu.signMeeting(activeMeeting.id, leaderSignerId!, deputySignerId!)}
  >
    Signer referat
  </Button>
</>}
```

---

## Commit

```
feat(amu): Møterom tab — live agenda cards + attendance + sign-off
```
