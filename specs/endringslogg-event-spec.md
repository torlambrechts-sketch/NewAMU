# Endringslogg — spesifikasjon per event

Visual + data spec for a single event row in the `<EntityTimeline>`
side panel. Standalone — paste alongside the surface mockup.

User-facing copy is **Norwegian bokmål**. The panel-level chrome
(header, filters, day-grouping headers, mobile bottom sheet) lives in
the parent brief; this file is **only** about one event.

---

## 1. Data shape per event

Every event reads from a single row in `audit_events`. Six canonical
fields (the 5W + diff). Nothing else is needed to render the card.

```ts
type AuditEvent = {
  id: string                       // event UUID (used as key + for permalink)
  occurred_at: string              // ISO 8601 timestamp
  actor: {
    id: string | null              // null = system / external token
    name: string                   // "Kari Nordmann" or "Arbeidstilsynet (token)"
    initials: string               // "KN" — derived, never trust input
    role: 'verneombud' | 'amu_medlem' | 'leder' | 'hms_radgiver'
        | 'ansatt' | 'system' | 'ekstern'
    is_external: boolean           // true → render with eksternt-badge
  }
  action: AuditAction              // see §3 — drives the chip + verb
  entity_kind: string              // 'compliance_finding', 'document', ...
  entity_id: string                // FK to the parent record
  location: string | null          // 'Avdeling Oslo / Lager 2' — optional context
  summary_nb: string               // pre-rendered Norwegian sentence (see §2)
  diff: Diff | null                // null for actions without a value change
}

type Diff =
  | { kind: 'single_field'
      field_label_nb: string       // "Status", "Tildelt", "Frist"
      before: DiffValue
      after: DiffValue }
  | { kind: 'multi_field'
      changes: Array<{
        field_label_nb: string
        before: DiffValue
        after: DiffValue
      }> }
  | { kind: 'list_change'
      field_label_nb: string       // "Tagger", "Verneombud", "Vedlegg"
      added: DiffValue[]
      removed: DiffValue[] }
  | { kind: 'text_block'
      field_label_nb: string       // "Beskrivelse", "Tiltak"
      before: string               // long-form, render as side-by-side
      after: string }

type DiffValue = {
  display: string                  // human-readable value
  raw?: string                     // optional machine value if different
  semantic?: 'status' | 'severity' | 'date' | 'user' | 'plain'
}

type AuditAction =
  | 'opprettet' | 'endret' | 'lukket' | 'gjenåpnet'
  | 'tildelt' | 'omfordelt' | 'kommentert'
  | 'signert' | 'attestert' | 'avvist' | 'godkjent'
  | 'lastet_opp_vedlegg' | 'slettet_vedlegg'
  | 'versjon_bumpet' | 'eskalert'
  | 'eksportert' | 'delt' | 'arkivert'
```

`summary_nb` is **always pre-rendered server-side** so the client
never composes Norwegian sentences from fragments. This avoids
case/preposition mistakes when fields contain Norwegian content.

---

## 2. Anatomy — collapsed row

Default state. ~64–80px tall depending on summary length.

```
┌─────────────────────────────────────────────────────────────────┐
│ ●  ┃ [KN]  Kari Nordmann  endret status fra Åpen til Lukket  ⌄ │
│ │  ┃       [endret]  for 3 timer siden · Avdeling Oslo           │
│ │  ┃                                                              │
```

- **Rail dot** (left edge, 8px circle): coloured by action category —
  green `#16a34a` for create/close/approve, amber `#d97706` for
  edit/reassign, red `#dc2626` for reject/escalate, grey `#6b7280`
  for comments/uploads/exports. **6px** when collapsed, grows to
  **10px** when the row is hovered or expanded.
- **Vertical rail**: 1px line `#e5e7eb` (light) / `#334155` (dark)
  connecting events within the same day-group. Dot sits on the rail,
  centred.
- **Avatar**: 28px square (not circle — squares disambiguate from
  user avatars elsewhere), rounded 6px, background derived from role:
  - verneombud: `#fef3c7` bg, `#92400e` text
  - amu_medlem: `#dbeafe` bg, `#1e3a8a` text
  - leder: `#e0e7ff` bg, `#3730a3` text
  - hms_radgiver: `#dcfce7` bg, `#166534` text
  - ansatt: `#f1f5f9` bg, `#334155` text
  - system: `#f1f5f9` bg, `#64748b` text, plus a tiny ⚙ glyph
  - ekstern: `#fee2e2` bg, `#991b1b` text, plus a tiny 🔗 glyph (do
    not actually use the emoji — use the link icon from the icon set)
- **Summary line**: 14px regular weight. Actor name **bold**. Field
  values rendered as inline subtle pills (3px padding, 2px radius,
  `#f1f5f9` bg) so they're scannable. Status values use R.A.G.
  colours (see §4) when semantic is `'status'`.
- **Action chip**: 11px uppercase tracking, 6px×10px padding, fully
  rounded. Colour comes from the action category map (§3).
- **Metadata strip**: 12px `#64748b`. Relative timestamp on the left,
  absolute timestamp visible on hover via tooltip ("19. mai 2026,
  14:32"). Location (if present) follows after a thin middle-dot.
- **Expander affordance**: a small chevron at the far right (▾ / ▴),
  rotates 180° when expanded. Whole row is clickable to toggle.

**Row interaction**
- Click anywhere on the row (except a sub-link) → toggle expand.
- Hover → background `#f8fafc` (light) / `#1e293b` (dark).
- Keyboard: `Enter` / `Space` toggles. `Arrow Down/Up` moves focus
  between rows. `Escape` from an expanded row collapses it.
- Long-press / right-click → context menu with **Kopier permalink**,
  **Eksporter denne hendelsen**, **Skjul hendelser fra denne aktøren**.

---

## 3. Action chip variants

Every action carries its own chip with a fixed Norwegian label and
colour. The chip is **always** the action label — never a paraphrase.

| Action key | Chip label | Bg | Text | Category |
|---|---|---|---|---|
| `opprettet` | OPPRETTET | `#dcfce7` | `#166534` | create (green) |
| `endret` | ENDRET | `#fef3c7` | `#854d0e` | edit (amber) |
| `lukket` | LUKKET | `#dcfce7` | `#166534` | close (green) |
| `gjenåpnet` | GJENÅPNET | `#fee2e2` | `#991b1b` | reopen (red) |
| `tildelt` | TILDELT | `#dbeafe` | `#1e40af` | assign (blue) |
| `omfordelt` | OMFORDELT | `#fef3c7` | `#854d0e` | edit (amber) |
| `kommentert` | KOMMENTERT | `#f1f5f9` | `#475569` | passive (grey) |
| `signert` | SIGNERT | `#e0e7ff` | `#3730a3` | sign (indigo) |
| `attestert` | ATTESTERT | `#e0e7ff` | `#3730a3` | sign (indigo) |
| `godkjent` | GODKJENT | `#dcfce7` | `#166534` | create (green) |
| `avvist` | AVVIST | `#fee2e2` | `#991b1b` | reject (red) |
| `lastet_opp_vedlegg` | VEDLEGG | `#f1f5f9` | `#475569` | passive (grey) |
| `slettet_vedlegg` | SLETTET | `#fee2e2` | `#991b1b` | reject (red) |
| `versjon_bumpet` | NY VERSJON | `#cffafe` | `#155e75` | meta (cyan) |
| `eskalert` | ESKALERT | `#fee2e2` | `#991b1b` | reject (red) |
| `eksportert` | EKSPORTERT | `#f1f5f9` | `#475569` | passive (grey) |
| `delt` | DELT | `#f1f5f9` | `#475569` | passive (grey) |
| `arkivert` | ARKIVERT | `#f1f5f9` | `#475569` | passive (grey) |

Chip text never wraps. On viewports under 480px, chip falls back to
icon-only with the label as `aria-label` + tooltip.

---

## 4. Anatomy — expanded row

Clicking the chevron reveals the diff inline. Row grows downward —
adjacent rows shift, panel stays scroll-pinned to the same row.

### 4.1 `single_field` diff

```
┌─────────────────────────────────────────────────────────────────┐
│ ●  ┃ [KN]  Kari Nordmann  endret status fra Åpen til Lukket  ⌃ │
│ │  ┃       [endret]  for 3 timer siden · Avdeling Oslo           │
│ │  ┃                                                              │
│ │  ┃     Status                                                   │
│ │  ┃     ┌───────────────────┐   →   ┌───────────────────┐     │
│ │  ┃     │ Før               │       │ Etter             │     │
│ │  ┃     │ ● Åpen            │       │ ● Lukket          │     │
│ │  ┃     └───────────────────┘       └───────────────────┘     │
│ │  ┃                                                              │
│ │  ┃     [Vis hele endringen →]                                  │
```

- Field label sits above the two cards in 12px uppercase tracking.
- Two cards side by side, equal width, 12px padding, 6px radius,
  1px border `#e2e8f0`.
- Card body uses the **semantic-aware renderer** (see §5).
- Arrow between cards: 16px right-arrow glyph, vertically centred.
- Footer link: deep-link to the full entity history page filtered to
  this field. Optional, only render if the entity has more than 5
  changes total.

### 4.2 `multi_field` diff

Same shape as single-field, but stacked. Each change is its own
field-label + two-card pair. Cap at **3 visible changes** by default
with a "Vis N flere endringer" expander at the bottom.

### 4.3 `list_change` diff

Added/removed lists side-by-side with explicit + / − markers.

```
│ │  ┃     Verneombud                                              │
│ │  ┃     ┌────────────────────────────────────────────────────┐ │
│ │  ┃     │ + Lise Hansen                                        │ │
│ │  ┃     │ + Per Olsen                                          │ │
│ │  ┃     │ − Tor Andersen                                       │ │
│ │  ┃     └────────────────────────────────────────────────────┘ │
```

- `+` lines: `#dcfce7` row bg, `#166534` plus glyph.
- `−` lines: `#fee2e2` row bg, `#991b1b` minus glyph.
- Each line is the `display` value, optionally a sub-line of metadata.
- If &gt; 6 changes, collapse middle with "… og N flere".

### 4.4 `text_block` diff

For free-text fields (Beskrivelse, Tiltak, Vurdering). Render as a
two-column word-level diff using the same colour rules as the full
document diff page:

- Added words: `#dcfce7` bg, `#166534` text, underline
- Removed words: `#fee2e2` bg, `#991b1b` text, strikethrough
- Unchanged: default text colour, no decoration

Body uses comfortable reading typography — 14px, line-height 1.6 —
not the metadata 12px. Constrain max height to 280px with a "Vis
hele" expander; full-screen modal on click for very long blocks.

### 4.5 `null` diff (action without a value change)

Examples: `kommentert`, `lastet_opp_vedlegg`, `signert`, `eksportert`.

Render a single context card instead of two:

```
│ │  ┃     ┌────────────────────────────────────────────────────┐ │
│ │  ┃     │ 💬  "Verneombud bekrefter at vinduet er reparert" │ │
│ │  ┃     │     — kommentar                                     │ │
│ │  ┃     └────────────────────────────────────────────────────┘ │
```

For uploads, show the filename + size + a download icon. For
signatures, show the certificate id and a download link.

---

## 5. Semantic-aware value rendering

The same raw value renders differently based on `semantic`:

| Semantic | Renderer |
|---|---|
| `status` | R.A.G. dot + label. Maps: `Åpen` → grønn, `I arbeid` → gul, `Forfalt` → rød, `Lukket` → grå, `Avvist` → rød, `Godkjent` → grønn. Use the same `<StatusChip variant="rag" />` introduced in the parent brief. |
| `severity` | Coloured pill (Lav grønn / Middels gul / Høy oransje / Kritisk rød). |
| `date` | Norwegian short date "12. mai 2026". If the date is within ±7 days of `occurred_at`, also show relative ("om 3 dager" / "for 2 dager siden") in 11px muted. |
| `user` | Avatar (16px) + name. |
| `plain` (default) | Monospace 13px for short values; default text for long ones. Empty / null renders as italic muted "(ingen verdi)". |

If the renderer fails or `semantic` is missing, fall back to `plain`.

---

## 6. Edge cases

These all need a mockup variant — don't skip them.

- **Long display values** (&gt; 80 chars in a `single_field` before/after):
  truncate with ellipsis, full value on hover, "Vis hele" if even
  the tooltip would overflow.
- **Identical before/after** (system event that emitted a no-op):
  render the card with a muted "(uendret)" label and don't expand by
  default.
- **Deleted referenced entity** (e.g. assigned to a user who was later
  removed): render the name with a strikethrough and a tooltip
  "Brukeren er deaktivert".
- **System actor** (cron, workflow runner): avatar uses the system
  swatch with ⚙ glyph; name renders as e.g. "Årshjul-runner" not
  "system" — use a friendly Norwegian label per actor type.
- **External actor via token** (Arbeidstilsynet, ekstern revisor):
  red avatar swatch with link glyph; name suffixed with "(ekstern)";
  on hover, tooltip shows the token's purpose ("Tilsyn 2026-05-12").
- **Bulk action** (one click closed 14 avvik): render as a single
  event with a multi-field-like expansion listing all 14 affected
  entities; cap at 5 visible with "Vis 9 til".
- **Privileged event** (HR-sensitive change, varsling-related): blur
  the expanded diff content with a "Du har ikke tilgang til å se
  denne endringen" overlay; the chip + actor + action are still
  visible so the audit trail itself is provable.
- **Failed action that was logged** (e.g. attempted state change
  blocked by the CAPA gate): render with a red rail dot and a small
  warning-triangle glyph after the action chip; expanded view shows
  the attempted value crossed out and the validation message.

---

## 7. Sample events — paste-ready

Realistic Norwegian data covering the main variants. Use these in the
mockup.

```ts
const sampleEvents: AuditEvent[] = [
  {
    id: 'evt_01',
    occurred_at: '2026-05-19T14:32:00+02:00',
    actor: {
      id: 'usr_kn', name: 'Kari Nordmann', initials: 'KN',
      role: 'verneombud', is_external: false,
    },
    action: 'lukket',
    entity_kind: 'compliance_finding',
    entity_id: 'vrf_42',
    location: 'Avdeling Oslo / Lager 2',
    summary_nb: 'Kari Nordmann lukket sjekkpunktet',
    diff: {
      kind: 'single_field',
      field_label_nb: 'Status',
      before: { display: 'I arbeid', semantic: 'status' },
      after:  { display: 'Lukket',   semantic: 'status' },
    },
  },
  {
    id: 'evt_02',
    occurred_at: '2026-05-19T11:08:00+02:00',
    actor: {
      id: 'usr_po', name: 'Per Olsen', initials: 'PO',
      role: 'leder', is_external: false,
    },
    action: 'omfordelt',
    entity_kind: 'compliance_finding',
    entity_id: 'vrf_42',
    location: null,
    summary_nb: 'Per Olsen omfordelte oppgaven til Lise Hansen',
    diff: {
      kind: 'multi_field',
      changes: [
        { field_label_nb: 'Tildelt',
          before: { display: 'Tor Andersen', semantic: 'user' },
          after:  { display: 'Lise Hansen',  semantic: 'user' } },
        { field_label_nb: 'Frist',
          before: { display: '15. mai 2026', semantic: 'date' },
          after:  { display: '22. mai 2026', semantic: 'date' } },
      ],
    },
  },
  {
    id: 'evt_03',
    occurred_at: '2026-05-18T16:45:00+02:00',
    actor: {
      id: null, name: 'Årshjul-runner', initials: 'ÅR',
      role: 'system', is_external: false,
    },
    action: 'eskalert',
    entity_kind: 'compliance_finding',
    entity_id: 'vrf_42',
    location: null,
    summary_nb: 'Årshjul-runner eskalerte saken til AMU-leder etter 14 dager uten handling',
    diff: null,
  },
  {
    id: 'evt_04',
    occurred_at: '2026-05-17T09:12:00+02:00',
    actor: {
      id: 'usr_lh', name: 'Lise Hansen', initials: 'LH',
      role: 'hms_radgiver', is_external: false,
    },
    action: 'endret',
    entity_kind: 'compliance_finding',
    entity_id: 'vrf_42',
    location: null,
    summary_nb: 'Lise Hansen oppdaterte beskrivelsen av tiltaket',
    diff: {
      kind: 'text_block',
      field_label_nb: 'Tiltak',
      before:
        'Vindu på lageret må byttes. Verneombud varsler driftsleder.',
      after:
        'Vindu på lageret må byttes innen utgangen av mai. ' +
        'Verneombud varsler driftsleder, og HMS-rådgiver bekrefter ' +
        'utskifting før AMU-møtet 5. juni.',
    },
  },
  {
    id: 'evt_05',
    occurred_at: '2026-05-15T13:20:00+02:00',
    actor: {
      id: 'tkn_at_2026_05_12', name: 'Arbeidstilsynet (ekstern)',
      initials: 'AT', role: 'ekstern', is_external: true,
    },
    action: 'eksportert',
    entity_kind: 'compliance_finding',
    entity_id: 'vrf_42',
    location: null,
    summary_nb: 'Arbeidstilsynet lastet ned bevisbunten via tilsynslenke',
    diff: null,
  },
  {
    id: 'evt_06',
    occurred_at: '2026-05-12T10:00:00+02:00',
    actor: {
      id: 'usr_kn', name: 'Kari Nordmann', initials: 'KN',
      role: 'verneombud', is_external: false,
    },
    action: 'opprettet',
    entity_kind: 'compliance_finding',
    entity_id: 'vrf_42',
    location: 'Avdeling Oslo / Lager 2',
    summary_nb: 'Kari Nordmann registrerte et nytt funn på vernerunden',
    diff: {
      kind: 'multi_field',
      changes: [
        { field_label_nb: 'Alvorlighet',
          before: { display: '(ingen verdi)', semantic: 'plain' },
          after:  { display: 'Middels', semantic: 'severity' } },
        { field_label_nb: 'Status',
          before: { display: '(ingen verdi)', semantic: 'plain' },
          after:  { display: 'Åpen', semantic: 'status' } },
        { field_label_nb: 'Beskrivelse',
          before: { display: '(ingen verdi)', semantic: 'plain' },
          after:  { display: 'Sprukket vindu i lagerets nord-vegg',
                    semantic: 'plain' } },
      ],
    },
  },
]
```

Six events span: a happy-path close, an edit with two field changes,
a system escalation (null diff), a long text-block edit, an external-token
export, and a creation with empty-to-value transitions. Cover all
significant variants in §3–6 with this set.

---

## 8. Accessibility checklist for the event row

- Each event row is a `<li>` inside an `<ol aria-label="Endringslogg">`.
- Action chip carries `aria-label` matching the Norwegian label.
- Colour is never the sole signal: every R.A.G. chip carries an icon,
  every diff card carries `+` / `−` glyphs in addition to colour.
- Expanded state announced via `aria-expanded` on the row.
- Screen-reader text reads in this order: actor name, action verb,
  field name, before value, "endret til", after value, timestamp.
- All interactive affordances reachable by keyboard with visible
  2px focus ring `#4338ca` offset 2px.
- Reduced-motion: chevron rotation respects `prefers-reduced-motion`
  (instant, not animated).
