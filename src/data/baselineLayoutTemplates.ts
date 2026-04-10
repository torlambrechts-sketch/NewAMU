/**
 * Ferdige layout-maler som speiler «Styre og valg» (råd) og «Ansatte» (organisasjon).
 * Lastes inn i Layout-designer som utgangspunkt — lagre som egen referansenøkkel etter tilpasning.
 */
import { mergeLayoutComposition, type LayoutCompositionPayload } from '../types/layoutComposition'

const FLAT = {
  borderRadius: '0',
  borderWidth: '1px',
  borderStyle: 'solid' as const,
  borderColor: 'rgba(0,0,0,0.12)',
}

const MAIN_BOX = {
  backgroundColor: '#ffffff',
  padding: '20px',
  ...FLAT,
}

const SIDE_BOX = {
  backgroundColor: 'rgba(250, 248, 244, 0.92)',
  padding: '16px',
  ...FLAT,
}

const PAGE_CANVAS = {
  maxWidth: '1400px',
  padding: '0',
  gap: '24px',
  backgroundColor: 'transparent',
  backgroundGradient: '',
  minHeight: '200px',
  borderRadius: '0',
  borderWidth: '0',
  borderStyle: 'solid' as const,
  borderColor: 'transparent',
}

const PAGE_TYPO = {
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  headingFontFamily: "'Libre Baskerville', Georgia, ui-serif, serif",
  baseFontSize: '16px',
  textColor: '#525252',
  headingColor: '#171717',
}

/** Samme proporsjon som app: ca. 60/40 (3:2). */
export function baselineStyreOgValgLayout(): LayoutCompositionPayload {
  return mergeLayoutComposition({
    metadata: {
      name: 'Baselinje: Styre og valg',
      description:
        'Sideoverskrift over rutenett, deretter hovedboks (AMU / styre) og valg-sidekolonne med egen toppstripe. Tilpass innhold i cellene eller bytt til lagrede komponenter.',
    },
    typography: PAGE_TYPO,
    canvas: PAGE_CANVAS,
    rows: [
      {
        id: 'row-styre-page-title',
        gap: '12px',
        alignItems: 'stretch',
        cells: [
          {
            id: 'cell-styre-h1',
            label: 'Sidetittel',
            mode: 'widget',
            componentReferenceKey: null,
            widget: {
              kind: 'heading',
              text: 'AMU og sammensetting',
              level: 1,
              style: {
                fontSize: '1.5rem',
                fontWeight: '600',
                lineHeight: '1.25',
              },
            },
            span: 'full',
            align: 'stretch',
            slotStyle: { ...defaultSlotFlat() },
          },
          {
            id: 'cell-styre-lead',
            label: 'Ingress / status',
            mode: 'widget',
            componentReferenceKey: null,
            widget: {
              kind: 'text',
              text: 'Valideringschip og kort beskrivelse plasseres her (som under Arbeidsmiljøråd). Hovedinnhold og valg følger i rutenettet under.',
              style: { fontSize: '0.875rem', color: '#525252' },
            },
            span: 'full',
            align: 'stretch',
            slotStyle: { ...defaultSlotFlat() },
          },
        ],
      },
      {
        id: 'row-styre-main-side',
        gap: '24px',
        alignItems: 'stretch',
        cells: [
          {
            id: 'cell-styre-main',
            label: 'Hoved · Sammensetting og styre',
            mode: 'widget',
            componentReferenceKey: null,
            widget: {
              kind: 'text',
              text: 'TOPPSTRIPE (COUNCIL_OVERLINE-stil): «Sammensetting og styre»\n\n• Innstillinger for sammensetting\n• Varsler (verneombud, utløpende verv)\n• Styre: to kolonner AT / AG med medlemskort\n• Kun-i-styre-register\n• Oppgavelenke\n\nBytt celle til «Lagret komponent» når du har pakket dette i Komponentdesigner.',
              style: { fontSize: '0.8125rem', lineHeight: '1.6' },
            },
            span: 'half',
            align: 'stretch',
            slotStyle: { ...MAIN_BOX },
          },
          {
            id: 'cell-styre-side',
            label: 'Side · Valg',
            mode: 'widget',
            componentReferenceKey: null,
            widget: {
              kind: 'text',
              text: 'TOPPSTRIPE: «Valg arbeidstakerrepresentanter og AMU-valg»\n\n• Kollapserbare seksjoner (Nytt valg, 2026, 2027, 2024, perioder, AMU-valg)\n• Erstatt med komponent når klar.',
              style: { fontSize: '0.8125rem', lineHeight: '1.6' },
            },
            span: 'half',
            align: 'stretch',
            slotStyle: { ...SIDE_BOX },
          },
        ],
      },
    ],
  })
}

/** Liste-side med tittelrad + plass til tabell/verktøylinje (som Ansatte). */
export function baselineAnsatteLayout(): LayoutCompositionPayload {
  return mergeLayoutComposition({
    metadata: {
      name: 'Baselinje: Ansatte',
      description:
        'Tittel og beskrivelse på én rad, deretter sone for søk/segment/liste-boks og Table1Shell. Koble inn faktisk tabell som lagret komponent når klar.',
    },
    typography: {
      ...PAGE_TYPO,
      headingFontFamily: 'ui-sans-serif, system-ui, sans-serif',
    },
    canvas: PAGE_CANVAS,
    rows: [
      {
        id: 'row-emp-header',
        gap: '16px',
        alignItems: 'end',
        cells: [
          {
            id: 'cell-emp-title',
            label: 'Tittel + beskrivelse',
            mode: 'widget',
            componentReferenceKey: null,
            widget: {
              kind: 'heading',
              text: 'Ansatte',
              level: 2,
              style: { fontSize: '1.125rem', fontWeight: '600' },
            },
            span: 'half',
            align: 'start',
            slotStyle: { ...defaultSlotFlat() },
          },
          {
            id: 'cell-emp-meta',
            label: 'Meta (telling)',
            mode: 'widget',
            componentReferenceKey: null,
            widget: {
              kind: 'text',
              text: '0 vist',
              style: { fontSize: '0.75rem', color: '#a3a3a3', textAlign: 'right' },
            },
            span: 'half',
            align: 'end',
            slotStyle: { ...defaultSlotFlat() },
          },
        ],
      },
      {
        id: 'row-emp-sub',
        gap: '8px',
        alignItems: 'stretch',
        cells: [
          {
            id: 'cell-emp-lead',
            label: 'Undertekst',
            mode: 'widget',
            componentReferenceKey: null,
            widget: {
              kind: 'text',
              text: 'Oversikt med romslige kolonner — samme uttrykk som forsiden. Under: søk, enhetsfilter, segment (Alle/Aktive/Inaktive), Liste/Bokser.',
              style: { fontSize: '0.875rem', color: '#737373' },
            },
            span: 'full',
            align: 'stretch',
            slotStyle: { ...defaultSlotFlat() },
          },
        ],
      },
      {
        id: 'row-emp-table',
        gap: '16px',
        alignItems: 'stretch',
        cells: [
          {
            id: 'cell-emp-content',
            label: 'Tabell / innholdssone',
            mode: 'widget',
            componentReferenceKey: null,
            widget: {
              kind: 'text',
              text: 'Sett inn Table1Shell + Table1Toolbar her (lagret komponent), eller lim inn modulinnhold. Tom tilstand: dashed border med «Legg til første ansatt» kan etterlignes i egen komponent.',
              style: { fontSize: '0.8125rem', lineHeight: '1.6' },
            },
            span: 'full',
            align: 'stretch',
            slotStyle: {
              backgroundColor: '#ffffff',
              padding: '0',
              borderRadius: '0',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'rgba(0,0,0,0.08)',
            },
          },
        ],
      },
    ],
  })
}

function defaultSlotFlat() {
  return {
    backgroundColor: 'transparent',
    padding: '0',
    borderRadius: '0',
    borderWidth: '0',
    borderStyle: 'solid' as const,
    borderColor: 'transparent',
  }
}
