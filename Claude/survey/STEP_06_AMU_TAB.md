# Step 6 — AMU-gjennomgang Tab

**Create** `modules/survey/tabs/SurveyAmuTab.tsx` (new file).  
**Delete** `src/modules/survey/SurveyAmuTab.tsx` after this step compiles cleanly.  
**Update** `modules/survey/SurveyDetailView.tsx`: replace the placeholder `SurveyAmuTab` import with the real one.

Depends on: Step 5 (detail shell + tab wire-up must exist).

---

## Context

The legacy `src/modules/survey/SurveyAmuTab.tsx` implements AMU review but uses:
- Raw `<input>` with Tailwind string constants → must become `<StandardInput>`
- Raw `<textarea>` → must become `<StandardTextarea>`
- Raw `<button>` → must become `<Button>`
- No `<ComplianceBanner>` — legal refs are only plain text

This step rewrites the tab using design-system components. The data model is `survey_amu_reviews` (single row per survey, upserted via `survey.upsertAmuReview`).

---

## File: `modules/survey/tabs/SurveyAmuTab.tsx`

### Imports

```ts
import { useEffect, useState } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import { ModuleSectionCard, ModuleSignatureCard, ModulePreflightChecklist } from '../../../src/components/module'
import { ComplianceBanner, InfoBox, WarningBox, Button } from '../../../src/components/ui'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { Badge } from '../../../src/components/ui/Badge'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { SurveyDetailTab } from './types'
```

### Props

```ts
export function SurveyAmuTab({ survey, s }: SurveyDetailTab) { ... }
```

### State

```ts
const review = survey.amuReview
const [meetingDate, setMeetingDate] = useState(review?.meeting_date ?? '')
const [agendaItem, setAgendaItem] = useState(review?.agenda_item ?? '')
const [protocol, setProtocol] = useState(review?.protocol_text ?? '')
const [chairName, setChairName] = useState('')
const [voName, setVoName] = useState('')
const [saving, setSaving] = useState(false)
const [signingChair, setSigningChair] = useState(false)
const [signingVo, setSigningVo] = useState(false)

// Sync state when review loads
useEffect(() => {
  setMeetingDate(review?.meeting_date ?? '')
  setAgendaItem(review?.agenda_item ?? '')
  setProtocol(review?.protocol_text ?? '')
}, [review?.id, review?.meeting_date, review?.agenda_item, review?.protocol_text])
```

### Layout

```
<div className="space-y-6">
  <ComplianceBanner refs={['AML § 7-2', 'IK-forskriften § 5']}>
    Resultater fra organisasjonsundersøkelser skal presenteres for Arbeidsmiljøutvalget (AMU) og vernombud.
    Protokoll fra gjennomgangen undertegnes av AMU-leder og vernombud og arkiveres (IK-forskriften § 5).
  </ComplianceBanner>

  {survey.error && <WarningBox>{survey.error}</WarningBox>}

  {/* Status banner */}
  {bothSigned ? (
    <InfoBox variant="success" icon={<CheckCircle />}>
      AMU-gjennomgang fullført og signert av begge parter.
    </InfoBox>
  ) : (
    <InfoBox variant="warning" icon={<Clock />}>
      Venter på signering fra {…}.
    </InfoBox>
  )}

  {/* Protocol form */}
  <ModuleSectionCard title="Møtedetaljer">
    <div className={WPSTD_FORM_ROW_GRID}>
      <div>
        <p className="text-sm font-medium text-neutral-800">Protokolldata</p>
        <p className="mt-1 text-sm text-neutral-600">
          Fyll inn møtedato, agendapunkt og referat fra AMU-gjennomgangen. Lagre før signering.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-meeting-date">Møtedato</label>
          <StandardInput
            id="amu-meeting-date"
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            disabled={bothSigned}
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agenda-item">Agendapunkt</label>
          <StandardInput
            id="amu-agenda-item"
            value={agendaItem}
            onChange={(e) => setAgendaItem(e.target.value)}
            placeholder="F.eks. Sak 3 – Arbeidsmiljøundersøkelse 2026"
            disabled={bothSigned}
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-protocol">Protokolltekst / referat</label>
          <StandardTextarea
            id="amu-protocol"
            rows={5}
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            placeholder="Oppsummering av gjennomgang, vedtak og tiltak…"
            disabled={bothSigned}
          />
        </div>
        {!bothSigned && survey.canManage && (
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Lagrer…' : review ? 'Oppdater protokoll' : 'Opprett protokoll'}
          </Button>
        )}
      </div>
    </div>
  </ModuleSectionCard>

  {/* Pre-flight checklist before signatures */}
  {review && !bothSigned && (
    <ModulePreflightChecklist
      items={[
        { label: 'Protokolltekst er skrevet', ok: !!(review.protocol_text?.trim()) },
        { label: 'Møtedato er registrert', ok: !!review.meeting_date },
        { label: 'Agendapunkt er angitt', ok: !!(review.agenda_item?.trim()) },
        { label: 'Undersøkelsen er lukket', ok: s.status === 'closed' },
      ]}
    />
  )}

  {/* Signature cards */}
  {review && (
    <div className="grid gap-4 sm:grid-cols-2">
      <ModuleSignatureCard
        role="AMU-leder"
        signedAt={review.amu_chair_signed_at}
        signedBy={review.amu_chair_name}
        onSign={(name) => void handleSignChair(name)}
        signing={signingChair}
        disabled={!survey.canManage || !!review.amu_chair_signed_at}
        nameLabel="Ditt fulle navn"
        buttonLabel="Signer som AMU-leder"
      />
      <ModuleSignatureCard
        role="Vernombud"
        signedAt={review.vo_signed_at}
        signedBy={review.vo_name}
        onSign={(name) => void handleSignVo(name)}
        signing={signingVo}
        disabled={!survey.canManage || !!review.vo_signed_at}
        nameLabel="Ditt fulle navn"
        buttonLabel="Signer som vernombud"
      />
    </div>
  )}

  {!review && (
    <p className="text-center text-xs text-neutral-400">
      Opprett protokollen ovenfor for å aktivere signering.
    </p>
  )}
</div>
```

### Handlers

```ts
const bothSigned = !!(review?.amu_chair_signed_at && review?.vo_signed_at)

const handleSave = async () => {
  setSaving(true)
  await survey.upsertAmuReview(s.id, {
    meeting_date: meetingDate || null,
    agenda_item: agendaItem || null,
    protocol_text: protocol || null,
  })
  setSaving(false)
}

const handleSignChair = async (name: string) => {
  if (!review) return
  setSigningChair(true)
  await survey.signAmuChair(review.id, name)
  setSigningChair(false)
}

const handleSignVo = async (name: string) => {
  if (!review) return
  setSigningVo(true)
  await survey.signVo(review.id, name)
  setSigningVo(false)
}
```

---

## Note on `ModuleSignatureCard`

Read `src/components/module/ModuleSignatureCard.tsx` before implementing. The props interface may differ from the usage shown above. Match the actual prop names from that file — do not guess.

If `ModuleSignatureCard` does not accept an `onSign` callback and instead only displays a completed signature, implement the signature input inline using `<StandardInput>` + `<Button>` within a `<ModuleSectionCard>`, and call `survey.signAmuChair` / `survey.signVo` directly. Pattern:

```tsx
{!review.amu_chair_signed_at ? (
  <div className="space-y-3">
    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="chair-name">Ditt fulle navn</label>
    <StandardInput id="chair-name" value={chairName} onChange={(e) => setChairName(e.target.value)} placeholder="Navn Navnesen" />
    <Button
      type="button"
      variant="primary"
      disabled={signingChair || !chairName.trim()}
      onClick={() => void handleSignChair(chairName)}
    >
      {signingChair ? 'Signerer…' : 'Signer som AMU-leder'}
    </Button>
  </div>
) : (
  <div className="space-y-1">
    <p className="font-medium text-neutral-800">{review.amu_chair_name}</p>
    <p className="text-xs text-emerald-700">
      Signert {new Date(review.amu_chair_signed_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
    </p>
    <Badge variant="success">Signert</Badge>
  </div>
)}
```

---

## Validation checklist

- [ ] No `<button className=…>` anywhere
- [ ] No `<input className=…>` or `<textarea className=…>` anywhere
- [ ] `<ComplianceBanner refs={['AML § 7-2', 'IK-forskriften § 5']}>` present
- [ ] `bothSigned` blocks all form fields and save button when true
- [ ] `canManage` gates both sign buttons
- [ ] `ModulePreflightChecklist` shows 4 items before signatures
- [ ] `src/modules/survey/SurveyAmuTab.tsx` deleted
- [ ] Placeholder in `SurveyDetailView.tsx` replaced with real import

## Commit

```
feat(survey): AMU-gjennomgang tab — protocol, dual sign-off
```
