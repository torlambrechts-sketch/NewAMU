# Step 10 — Tab: Kritiske saker

Create `modules/amu/tabs/CriticalTab.tsx`.

Depends on: Step 5.
Reference: `Claude/NewAUM/04_UI_VIEWS.md` § "Tab 5 · Kritiske saker".

---

## Layout

```tsx
<div className="space-y-6">
  {/* KPI row */}
  <div className="grid grid-cols-3 gap-4">…</div>

  {/* avvik */}
  <ModuleSectionCard title="Avvik som AMU må behandle">…</ModuleSectionCard>

  {/* two-column */}
  <div className="grid grid-cols-2 gap-6">
    <ModuleSectionCard title="Varslingssaker — aggregert">…</ModuleSectionCard>
    <ModuleSectionCard title="Manglende signaturer">…</ModuleSectionCard>
  </div>
</div>
```

---

## KPI row

Derive counts from `amu.criticalQueue`:

```tsx
const openAvvik     = criticalQueue.filter(i => i.item_type === 'unsigned_meeting' /* or avvik type */).length
const openVarsler   = criticalQueue.filter(i => i.item_type === 'draft_annual_report').length
const missingSigs   = criticalQueue.filter(i => i.item_type === 'unsigned_meeting').length

const kpis = [
  { label: 'Avvik åpne',           value: openAvvik,  severity: openAvvik > 0 },
  { label: 'Varsler åpne',         value: openVarsler, severity: false },
  { label: 'Manglende signaturer', value: missingSigs, severity: missingSigs > 0 },
]
```

Each KPI card:
```tsx
<ModuleSectionCard className={k.severity ? 'border-l-4 border-l-red-500' : ''}>
  <p className="text-2xl font-bold">{k.value}</p>
  <p className="text-sm text-gray-500">{k.label}</p>
</ModuleSectionCard>
```

---

## Avvik card

> Reads from the existing avvik module — filter by `requires_amu_review = true OR risk >= 12`.
> Add a Supabase query in `useAmu.refresh()` for this if not already present, or accept it as a prop.

For now, fetch inline using a `useEffect` (acceptable since this is a cross-module read, not a mutation):

```tsx
const [avvik, setAvvik] = useState<unknown[]>([])
useEffect(() => {
  supabase
    .from('deviations')
    .select('id,title,risk_score,requires_amu_review,created_at')
    .eq('organization_id', organization.id)
    .or('requires_amu_review.eq.true,risk_score.gte.12')
    .order('risk_score', { ascending: false })
    .then(({ data }) => setAvvik(data ?? []))
}, [organization?.id])
```

Wait — this breaks the rule "UI never imports supabase directly". Instead add `avvik` state + fetch to `useAmu.refresh()` and expose it from the hook. Update Step 4's `refresh()` to also fetch:

```ts
supabase.from('deviations').select('id,title,risk_score,requires_amu_review,created_at')
  .eq('organization_id', organization.id)
  .or('requires_amu_review.eq.true,risk_score.gte.12')
  .order('risk_score', { ascending: false })
```

Add `avvik` state to hook, expose in return object.

Render the avvik list:
```tsx
{amu.avvik.map((a: any) => (
  <div key={a.id}
    className={`flex items-center gap-3 p-3 rounded border-l-4 mb-2
      ${a.risk_score >= 12 ? 'border-l-red-500 bg-red-50' : 'border-l-amber-400 bg-amber-50'}`}
  >
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{a.title}</p>
      <p className="text-xs text-gray-500">Risiko: {a.risk_score}</p>
    </div>
    <Button variant="secondary" size="sm">Åpne</Button>
  </div>
))}
{amu.avvik.length === 0 && (
  <p className="text-sm text-gray-500 py-4 text-center">Ingen avvik krever AMU-behandling</p>
)}
```

---

## Whistleblowing card

**Privacy rule (AML § 2 A-3):** Never show raw cases. Show counts only.

```tsx
<ModuleSectionCard title="Varslingssaker — aggregert">
  <ComplianceBanner refs={['AML § 2 A-3']}>
    AMU mottar kun aggregerte tall uten persondata.
  </ComplianceBanner>

  {/* Fetch counts via RPC — never raw whistleblowing_cases */}
  <WhistleblowingStats organizationId={organization.id} />

  <p className="text-xs text-gray-500 mt-3">
    Kontakt: {amu.committee ? amu.members.find(m => m.role === 'leader')?.display_name : '—'}
  </p>
</ModuleSectionCard>
```

`WhistleblowingStats` is a small local component that calls the existing privacy RPC:
```tsx
function WhistleblowingStats({ organizationId }: { organizationId: string }) {
  const [stats, setStats] = useState<{ open: number; closed_ytd: number } | null>(null)
  useEffect(() => {
    supabase.rpc('amu_privacy_whistleblowing_stats', { p_org_id: organizationId })
      .then(({ data }) => setStats(data as any))
  }, [organizationId])

  if (!stats) return null
  return (
    <div className="flex gap-6 mt-3">
      <div><p className="text-2xl font-bold">{stats.open}</p><p className="text-xs text-gray-500">Åpne</p></div>
      <div><p className="text-2xl font-bold">{stats.closed_ytd}</p><p className="text-xs text-gray-500">Lukket i år</p></div>
    </div>
  )
}
```

This component is the only place that may call supabase directly — it uses the privacy RPC and is purely presentational with no mutations.

---

## Missing signatures card

```tsx
<ModuleSectionCard title="Manglende signaturer">
  {unsignedMeetings.map(m => (
    <div key={m.id} className="flex items-center gap-2 py-2 border-b last:border-0">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
      <span className="text-sm flex-1">{m.title}</span>
      <span className="text-xs text-gray-400">{formatDate(m.scheduled_at)}</span>
      <Button variant="secondary" size="sm">Påminn</Button>
      <Button variant="primary" size="sm">Åpne</Button>
    </div>
  ))}
  {unsignedMeetings.length === 0 && (
    <p className="text-sm text-gray-500 py-4 text-center">Alle referater er signert</p>
  )}
</ModuleSectionCard>
```

`unsignedMeetings = amu.meetings.filter(m => m.status === 'completed' && !m.signed_at)`

---

## Commit

```
feat(amu): Kritiske saker tab — avvik + whistleblowing + signatures
```
