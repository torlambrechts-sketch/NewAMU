// NACE code → sector risk preset.
// Maps Norwegian NACE 2007 codes to sector-specific HMS risk profiles.
// Used by the DocumentCreationWizard to pre-select relevant risk factors
// and suggest default HMS-mål values based on the organisation's industry.

export type SectorRiskItem = {
  id: string
  label: string
  description: string
  defaultSelected: boolean
}

export type SectorPreset = {
  sectorLabel: string
  risks: SectorRiskItem[]
  /** Default sykefravær target (%) */
  sykefraværDefault: string
  /** Default avvik response time (days) */
  avvikFristDefault: string
  /** Whether BHT is mandatory for this sector (Arbeidstilsynet BHT-forskriften) */
  bhtPliktig: boolean
  /** Additional sector-specific law references beyond the standard set */
  extraLawRefs: string[]
}

// ─── Generic fallback ─────────────────────────────────────────────────────────

const DEFAULT_PRESET: SectorPreset = {
  sectorLabel: 'Generell næringsvirksomhet',
  risks: [
    {
      id: 'ergo',
      label: 'Ergonomi og belastningslidelser',
      description: 'Feil arbeidsstilling, statisk belastning, løft og repetitivt arbeid',
      defaultSelected: true,
    },
    {
      id: 'psycho',
      label: 'Psykososialt arbeidsmiljø',
      description: 'Stress, høyt tidspress, emosjonelle krav og mellommenneskelige konflikter',
      defaultSelected: true,
    },
    {
      id: 'fire',
      label: 'Brann og evakuering',
      description: 'Risikovurdering av brannfarer, rømningsveier og evakueringsrutiner',
      defaultSelected: true,
    },
    {
      id: 'alone',
      label: 'Alenearbeid',
      description: 'Arbeid uten mulighet for umiddelbar kollegahjelp',
      defaultSelected: false,
    },
  ],
  sykefraværDefault: '4',
  avvikFristDefault: '14',
  bhtPliktig: false,
  extraLawRefs: [],
}

// ─── Sector-specific presets ──────────────────────────────────────────────────

type NaceEntry = { pattern: RegExp; preset: SectorPreset }

const NACE_PRESETS: NaceEntry[] = [
  // ── A: Jordbruk, skogbruk og fiske ──────────────────────────────────────────
  {
    pattern: /^0[1-3]/,
    preset: {
      sectorLabel: 'Jordbruk, skogbruk og fiske',
      risks: [
        { id: 'machine_agri', label: 'Maskin- og utstyrfare (landbruksmaskiner)', description: 'Traktorer, høstere og redskaper med roterende deler', defaultSelected: true },
        { id: 'fall_agri', label: 'Fall og snubbing', description: 'Ulendt terreng, stiger og kornuttak', defaultSelected: true },
        { id: 'chemical_agri', label: 'Kjemisk eksponering (plantevernmidler)', description: 'Sprøytemidler, gjødsel og desinfeksjonsmidler', defaultSelected: true },
        { id: 'noise_agri', label: 'Støy og vibrasjoner', description: 'Traktor og maskinelt utstyr over lang tid', defaultSelected: false },
      ],
      sykefraværDefault: '5',
      avvikFristDefault: '7',
      bhtPliktig: true,
      extraLawRefs: ['Plantevernmiddelforskriften § 20'],
    },
  },

  // ── C: Industri og produksjon ────────────────────────────────────────────────
  {
    pattern: /^(1[0-9]|2[0-9]|3[0-3])/,
    preset: {
      sectorLabel: 'Industri og produksjon',
      risks: [
        { id: 'machine_prod', label: 'Maskinsikkerhet og verneutstyr', description: 'Roterende deler, press, klemfarer og automatiserte systemer', defaultSelected: true },
        { id: 'chemical_prod', label: 'Kjemisk eksponering', description: 'Løsemidler, støv, røyk, gasser og biologiske faktorer', defaultSelected: true },
        { id: 'noise_prod', label: 'Støy og mekaniske vibrasjoner', description: 'Produksjonslinje, kompressorer og metallarbeid', defaultSelected: true },
        { id: 'ergo_prod', label: 'Ergonomi og tunge løft', description: 'Repetitivt arbeid og vedvarende stående stilling', defaultSelected: true },
        { id: 'fire_prod', label: 'Brann og eksplosjon', description: 'Brennbare stoffer, varmt arbeid og elektrisitet', defaultSelected: false },
        { id: 'fall_prod', label: 'Fall fra høyde', description: 'Vedlikehold på maskiner og i høye lagerhaller', defaultSelected: false },
      ],
      sykefraværDefault: '5',
      avvikFristDefault: '7',
      bhtPliktig: true,
      extraLawRefs: ['AML § 4-5', 'Kjemikalieforskriften § 3'],
    },
  },

  // ── F: Bygg og anlegg ────────────────────────────────────────────────────────
  {
    pattern: /^(41|42|43)/,
    preset: {
      sectorLabel: 'Bygg og anlegg',
      risks: [
        { id: 'fall', label: 'Fall fra høyde', description: 'Stillas, tak, groper og åpninger i dekke', defaultSelected: true },
        { id: 'machine_bygg', label: 'Maskin- og kjøretøyfare', description: 'Anleggsmaskiner, kran, heis og gravemaskin', defaultSelected: true },
        { id: 'chemical_bygg', label: 'Kjemisk eksponering (støv, asbest, løsemidler)', description: 'Kvartsstøv, isocyanater, asbest og malingsløsemidler', defaultSelected: true },
        { id: 'noise_bygg', label: 'Støy og vibrasjoner', description: 'Bor, hammer, sag og kompressor over full skift', defaultSelected: true },
        { id: 'electro', label: 'Elektrisk fare', description: 'Uisolerte ledninger, grave nær kabler og strømverktøy', defaultSelected: false },
        { id: 'psycho_bygg', label: 'Psykososialt — tidspress og sesongarbeid', description: 'Knapp frister, akkordarbeid og midlertidighet', defaultSelected: false },
      ],
      sykefraværDefault: '5',
      avvikFristDefault: '7',
      bhtPliktig: true,
      extraLawRefs: ['Byggherreforskriften § 15', 'FOR-2011-12-06-1357 (Stillasforskriften)'],
    },
  },

  // ── G: Handel ────────────────────────────────────────────────────────────────
  {
    pattern: /^(4[5-7])/,
    preset: {
      sectorLabel: 'Handel og detaljhandel',
      risks: [
        { id: 'ergo_handel', label: 'Ergonomi og kassepunkt', description: 'Ensformig bevegelse og vedvarende stående stilling', defaultSelected: true },
        { id: 'violence_handel', label: 'Tyveri, ran og truende atferd', description: 'Konfliktsituasjoner med kunder og alenearbeid', defaultSelected: true },
        { id: 'alone_handel', label: 'Alenearbeid kveld og helg', description: 'Arbeid uten kollegastøtte i åpningstiden', defaultSelected: false },
        { id: 'psycho_handel', label: 'Psykososialt — kundepress', description: 'Krevende kunder, klager og tidspress', defaultSelected: false },
      ],
      sykefraværDefault: '5',
      avvikFristDefault: '14',
      bhtPliktig: false,
      extraLawRefs: [],
    },
  },

  // ── H: Transport og lagring ──────────────────────────────────────────────────
  {
    pattern: /^(49|5[0-3])/,
    preset: {
      sectorLabel: 'Transport og lagring',
      risks: [
        { id: 'driving', label: 'Kjøretretthet og kjøre-/hviletidsregler', description: 'Yrkessjåfører — søvnmangel og overholdelse av EU-forordning 561/2006', defaultSelected: true },
        { id: 'alone_transport', label: 'Alenearbeid og isolasjon', description: 'Nattestid, avsidesliggende steder og manglende nødvarsling', defaultSelected: true },
        { id: 'ergo_transport', label: 'Ergonomi — lasting, lossing og vibrasjon', description: 'Tunge løft, helkroppsvibrasjoner fra kjøretøy', defaultSelected: true },
        { id: 'violence_transport', label: 'Ran og trusler', description: 'Verdilasting, nattkjøring og kontanthåndtering', defaultSelected: false },
      ],
      sykefraværDefault: '5',
      avvikFristDefault: '14',
      bhtPliktig: true,
      extraLawRefs: ['AML § 4-1', 'Yrkestransportlova'],
    },
  },

  // ── I: Overnatting og servering ──────────────────────────────────────────────
  {
    pattern: /^(5[5-6])/,
    preset: {
      sectorLabel: 'Overnatting og servering',
      risks: [
        { id: 'ergo_service', label: 'Ergonomi og stående arbeid', description: 'Tunge løft, bæring og vedvarende stående stilling', defaultSelected: true },
        { id: 'psycho_service', label: 'Psykososialt — kundepress', description: 'Krevende gjester, kjøkkenstress og uforutsigbarhet', defaultSelected: true },
        { id: 'chemical_service', label: 'Kjemisk eksponering (rengjøringsmidler)', description: 'Hud- og luftveisplager fra desinfeksjon og blekmidler', defaultSelected: true },
        { id: 'shift_service', label: 'Natt- og helgearbeid', description: 'Uregelmessige arbeidstider og korte hviletider', defaultSelected: false },
      ],
      sykefraværDefault: '5',
      avvikFristDefault: '14',
      bhtPliktig: false,
      extraLawRefs: [],
    },
  },

  // ── J: IKT og informasjon ────────────────────────────────────────────────────
  {
    pattern: /^(5[8-9]|6[0-3])/,
    preset: {
      sectorLabel: 'IKT og kunnskapsvirksomhet',
      risks: [
        { id: 'ergo_it', label: 'Skjermarbeid og ergonomi', description: 'Øye-, nakke- og skulderplager fra statisk skjermarbeid', defaultSelected: true },
        { id: 'psycho_it', label: 'Psykososialt — tilgjengelighetspress', description: 'Hybridarbeid, uklar grense mellom jobb og fritid, leveransepress', defaultSelected: true },
        { id: 'alone_it', label: 'Isolasjon ved fjernarbeid', description: 'Hjemmekontor, redusert sosial kontakt og manglende tilhørighet', defaultSelected: false },
      ],
      sykefraværDefault: '3',
      avvikFristDefault: '14',
      bhtPliktig: false,
      extraLawRefs: [],
    },
  },

  // ── P: Undervisning ──────────────────────────────────────────────────────────
  {
    pattern: /^(85)/,
    preset: {
      sectorLabel: 'Undervisning og opplæring',
      risks: [
        { id: 'psycho_edu', label: 'Psykososialt — elevatferd og konflikter', description: 'Krevende atferd, trusler og emosjonell belastning', defaultSelected: true },
        { id: 'noise_edu', label: 'Støy (klasserom og skolegård)', description: 'Vedvarende lydbakgrunn og stemmebelastning', defaultSelected: true },
        { id: 'ergo_edu', label: 'Ergonomi — stå/gå og stemme', description: 'Stemmebelastning og lite variasjon i arbeidsstilling', defaultSelected: false },
        { id: 'workload_edu', label: 'Arbeidsbelastning og grense arbeid/fritid', description: 'Retting og forberedelser utover normal arbeidstid', defaultSelected: false },
      ],
      sykefraværDefault: '6',
      avvikFristDefault: '14',
      bhtPliktig: false,
      extraLawRefs: ['Opplæringslova § 9-4', 'AML § 4-3'],
    },
  },

  // ── Q: Helse og sosialtjenester ──────────────────────────────────────────────
  {
    pattern: /^(8[6-8])/,
    preset: {
      sectorLabel: 'Helse- og sosialtjenester',
      risks: [
        { id: 'violence', label: 'Vold og trusler fra pasienter/brukere', description: 'Fysiske og verbale angrep fra klienter, beboere og pårørende', defaultSelected: true },
        { id: 'infection', label: 'Smitte og biologisk fare', description: 'Blod, kroppsvæsker, luftsmitte og resistente bakterier', defaultSelected: true },
        { id: 'shift', label: 'Skift- og nattarbeid', description: 'Søvnforstyrrelser, sosiale konsekvenser og helsepåvirkning', defaultSelected: true },
        { id: 'ergo_helse', label: 'Ergonomi og forflytning av pasienter', description: 'Løft, bæring og statisk belastning i pleiesituasjoner', defaultSelected: true },
        { id: 'psycho_helse', label: 'Psykisk belastning og utbrenthet', description: 'Sekundærtraumatisering, krevende relasjoner og emosjonell tapping', defaultSelected: true },
      ],
      sykefraværDefault: '7',
      avvikFristDefault: '7',
      bhtPliktig: true,
      extraLawRefs: ['AML § 4-3', 'Smittevernloven § 5-2'],
    },
  },

  // ── O: Offentlig administrasjon ──────────────────────────────────────────────
  {
    pattern: /^(84)/,
    preset: {
      sectorLabel: 'Offentlig administrasjon',
      risks: [
        { id: 'ergo_offentlig', label: 'Ergonomi og kontorarbeid', description: 'Skjermarbeid, statisk sittestilling og inneklima', defaultSelected: true },
        { id: 'psycho_offentlig', label: 'Psykososialt — krevende brukerkontakt', description: 'Konflikter med innbyggere og emosjonelle krav', defaultSelected: true },
        { id: 'violence_offentlig', label: 'Vold og trusler (publikumsmottak)', description: 'Truende atferd i front-of-house og alenearbeid', defaultSelected: false },
      ],
      sykefraværDefault: '5',
      avvikFristDefault: '14',
      bhtPliktig: false,
      extraLawRefs: [],
    },
  },
]

// ─── Lookup function ─────────────────────────────────────────────────────────

export function naceToSectorPreset(naceKode: string | undefined): SectorPreset {
  if (!naceKode) return DEFAULT_PRESET
  // Normalise: remove dots and spaces, e.g. "62.010" → "62010"
  const clean = naceKode.replace(/[.\s]/g, '')
  const match = NACE_PRESETS.find(({ pattern }) => pattern.test(clean))
  return match?.preset ?? DEFAULT_PRESET
}
