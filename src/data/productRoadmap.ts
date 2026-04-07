/** Product roadmap items — shown on org-health settings and platform admin. */
export type RoadmapStatus = 'Planlagt' | 'Pågår' | 'Utforskning'

export type RoadmapItem = {
  title: string
  body: string
  status: RoadmapStatus
}

export const PRODUCT_ROADMAP: RoadmapItem[] = [
  {
    title: 'Nivå 2 signatur — BankID / kvalifisert e-signatur (QES, eIDAS)',
    body:
      'For høyrisiko HR (kontrakter, formelle advarsler, oppsigelser, AML § 15-1-protokoller): integrasjon mot nordisk tillitsleverandør (f.eks. Signicat, Criipto, Scrive). Arbeidsflyt: generer dokument → ekstern signaturlenke → webhook tilbake → PAdES i Storage og status «QES signert». Dagens «Nivå 1» (SHA-256 + auth.uid + revisjonslogg) dekker ROS, oppgaver, AMU-protokoll m.m.',
    status: 'Planlagt',
  },
  {
    title: 'Arbeidstid og hviletid — bruddvarsling (AML kap. 10)',
    body:
      'Compliance-lag (ikke fullt vaktplan): API/webhook der kunder (f.eks. Tripletex/Visma) pusher timeaggregater til Supabase; nattlig jobb (pg_cron) sjekker bl.a. 11 t sammenhengende hvile og overtidsterskler (f.eks. 200 t/år uten tariffavtale). Ved brudd: automatisk rødt avvik på Kanban til HR.',
    status: 'Planlagt',
  },
  {
    title: 'Beredskapsøvelser og krisehåndtering (IK-f § 5 nr. 6)',
    body:
      'Egen modul for planlagte øvelser (brann, dataangrep, trussel m.m.), evaluering etterpå og låst arkiv som revisjonsbevis. Kritiske funn (f.eks. blokkert rømningsvei) kan trigge arbeidsflyt → oppfølgingsavvik.',
    status: 'Planlagt',
  },
  {
    title: 'Eksterne entreprenører og påseplikt (AML § 2-2 / § 6-3)',
    body:
      'Rolle external_contractor, tidsbegrenset magic link til underleverandørportal: HMS-erklæring, kjemikalieliste, HMS-kort — lagret org-spesifikt. Hovedbedrift ser samsvarsstatus (grønt merke) per leverandør på arbeidsplassen.',
    status: 'Planlagt',
  },
  {
    title: 'Bedriftshelsetjenesten (BHT) — integrasjon (AML § 3-3)',
    body:
      'Konsulent-innlogging med streng RLS: BHT ser kun avdelinger og planer bedriften eksplisitt deler. Årsplan for BHT i dokument-senter, signatur på deltakelse i ROS/vernerunder — dokumentert i internkontroll.',
    status: 'Planlagt',
  },
  {
    title: 'Bedriftsomtale (company site)',
    body:
      'Egen informasjonsside for hele selskapet: åpen tilgang til anonym rapportering, valg og informasjon om arbeidsmiljøråd/HMS — uten innlogging i admin.',
    status: 'Planlagt',
  },
  {
    title: 'Internkontroll (nå: demo)',
    body:
      'Varslingssaker med status, ROS-mal og årsgjennomgang finnes under «Internkontroll» i appen — videreutvikles med roller, eksport og integrasjon mot BHT.',
    status: 'Pågår',
  },
  {
    title: 'E-post / SMS-varsler til HR',
    body: 'Automatiserte varsler ved nye anonyme henvendelser og terskel for oppfølging.',
    status: 'Planlagt',
  },
  {
    title: 'Integrasjon med ekstern varsling',
    body: 'API eller eksport til godkjente varslingskanaler der det kreves.',
    status: 'Utforskning',
  },
  {
    title: 'Roller og tilgangsstyring',
    body: 'Skille mellom medarbeider, verneombud, HR og leder i samme løsning.',
    status: 'Planlagt',
  },
]
