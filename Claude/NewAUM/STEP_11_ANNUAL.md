# Step 11 — Tab: Årsrapport

Create `modules/amu/tabs/AnnualReportTab.tsx`.

Depends on: Step 5.
Reference: `Claude/NewAUM/04_UI_VIEWS.md` § "Tab 6 · Årsrapport".

---

## Layout

```tsx
<div className="grid grid-cols-[1fr_380px] gap-6">
  <div>{/* main draft card */}</div>
  <div className="space-y-4">{/* source data + versions */}</div>
</div>
```

---

## Main card — "Årsrapport · {year} (kladd)"

```tsx
<ModuleSectionCard
  title={`Årsrapport · ${currentYear}${report?.status === 'draft' ? ' (kladd)' : ''}`}
  headerRight={<>
    <Button variant="secondary" onClick={handleExportPdf}>Eksporter PDF</Button>
    {amu.canChair && report?.status === 'draft' && (
      <Button variant="primary" onClick={() => setShowSignOff(true)}>
        Send til signering
      </Button>
    )}
  </>}
>
```

### Generate draft prompt (when no report exists)

```tsx
{!report && amu.canManage && (
  <div className="text-center py-8 space-y-3">
    <p className="text-sm text-gray-600">Ingen årsrapport for {currentYear} ennå.</p>
    <Button variant="primary" onClick={() => amu.draftAnnualReport(currentYear)}>
      Generer kladd automatisk
    </Button>
  </div>
)}
```

### Five sections — each editable by `canChair`

```tsx
const SECTIONS = [
  { key: 'sammensetning',  label: '§ 1 Sammensetning og møtevirksomhet' },
  { key: 'hms',           label: '§ 2 HMS-arbeid' },
  { key: 'avvik',         label: '§ 3 Avvik og yrkesskader' },
  { key: 'sykefravær',    label: '§ 4 Sykefravær' },
  { key: 'varsling',      label: '§ 5 Varsling og medvirkning' },
]

{report && SECTIONS.map(section => (
  <div key={section.key} className="mb-6">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
      {section.label}
    </p>
    {amu.canChair && report.status === 'draft'
      ? (
        <StandardTextarea
          value={report.body[section.key] ?? ''}
          onChange={e => handleSectionEdit(section.key, e.target.value)}
          rows={4}
        />
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {report.body[section.key] ?? '—'}
        </p>
      )
    }
  </div>
))}
```

`handleSectionEdit` debounces (500ms) a Supabase upsert on `amu_annual_reports.body`. Do this directly in the component (it is a simple jsonb patch — acceptable as a local save action):

```ts
const handleSectionEdit = useMemo(
  () => debounce(async (key: string, value: string) => {
    if (!report) return
    await supabase.from('amu_annual_reports').update({
      body: { ...report.body, [key]: value },
    }).eq('id', report.id)
  }, 500),
  [report]
)
```

> Exception to the "no direct supabase in UI" rule — this is a live-edit textarea autosave, identical to the pattern used by the existing referat textarea. Keep it self-contained in this component.

---

## Right column

### "Kildedata · auto-trukket"

```tsx
<ModuleSectionCard title="Kildedata · auto-trukket">
  {[
    { label: 'Møtereferat', value: `${signedMeetings}/${totalMeetings}`, ok: signedMeetings === totalMeetings },
    { label: 'Avvik', value: String(amu.avvik?.length ?? 0), ok: true },
    { label: 'Sykefravær (kvartal)', value: `${sickLeaveQuarters}/4`, ok: sickLeaveQuarters >= 2 },
    { label: 'HMS-plan', value: hmsPlanned ? '✓' : '–', ok: hmsPlanned },
  ].map(row => (
    <div key={row.label} className="flex items-center gap-2 py-1.5 border-b last:border-0">
      <span className="text-sm flex-1">{row.label}</span>
      <Badge variant={row.ok ? 'success' : 'warning'}>{row.value}</Badge>
    </div>
  ))}
</ModuleSectionCard>
```

### "Versjoner"

```tsx
<ModuleSectionCard title="Versjoner">
  {signedReports.map(r => (
    <div key={r.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
      <span className="text-sm flex-1">Årsrapport {r.year}</span>
      <Badge variant="success">Signert</Badge>
      <Button variant="ghost" size="sm">PDF →</Button>
    </div>
  ))}
  {signedReports.length === 0 && (
    <p className="text-xs text-gray-400 py-2">Ingen tidligere signerte rapporter</p>
  )}
</ModuleSectionCard>
```

`signedReports` — fetch all `amu_annual_reports` where `status='signed'` in `useAmu.refresh()` and expose as `annualReports: AmuAnnualReport[]`.

---

## Sign-off flow (`showSignOff`)

```tsx
<ModulePreflightChecklist
  items={[
    { label: 'Alle § 1–5 seksjoner utfylt', ok: allSectionsFilled },
    { label: 'Alle møtereferat signert', ok: signedMeetings === totalMeetings },
    { label: 'Kildedata komplett', ok: sourceDataComplete },
  ]}
/>
{allChecksPassed && (
  <>
    <ModuleSignatureCard
      role="leader"
      signerName={leader?.display_name ?? 'Leder'}
      onSign={id => setLeaderSignerId(id)}
    />
    <ModuleSignatureCard
      role="deputy"
      signerName={deputy?.display_name ?? 'Nestleder'}
      onSign={id => setDeputySignerId(id)}
    />
    <Button
      variant="primary"
      disabled={!leaderSignerId || !deputySignerId}
      onClick={() => amu.signAnnualReport(report!.id, leaderSignerId!, deputySignerId!)}
    >
      Signer årsrapport
    </Button>
  </>
)}
```

---

## `handleExportPdf`

```ts
const handleExportPdf = () => {
  if (!report) return
  const html = buildAnnualReportHtml(report, amu.committee, amu.members)
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 500)
}
```

`buildAnnualReportHtml` is a pure function at the bottom of the file. It generates a minimal print-ready HTML document with report sections.

---

## Commit

```
feat(amu): Årsrapport tab — 5-section draft + dual signatures
```
