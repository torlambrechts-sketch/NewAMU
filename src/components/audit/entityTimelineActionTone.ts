// Rail-dot tone palette — extracted from EntityTimelineActionChip.tsx so
// the chip module can keep react-refresh purity (only-export-components).

import type { AuditAction } from '../../lib/audit/diffShape'

const RAIL_TONE: Record<
  AuditAction,
  'green' | 'amber' | 'red' | 'grey' | 'blue' | 'indigo' | 'cyan'
> = {
  opprettet: 'green',
  endret: 'amber',
  lukket: 'green',
  gjenapnet: 'red',
  tildelt: 'blue',
  omfordelt: 'amber',
  kommentert: 'grey',
  signert: 'indigo',
  attestert: 'indigo',
  godkjent: 'green',
  avvist: 'red',
  lastet_opp_vedlegg: 'grey',
  slettet_vedlegg: 'red',
  versjon_bumpet: 'cyan',
  eskalert: 'red',
  eksportert: 'grey',
  delt: 'grey',
  arkivert: 'grey',
  // W0 additions
  besvart: 'blue',
  publisert: 'green',
  protokollert: 'indigo',
  votert: 'cyan',
  innkalt: 'blue',
  mottatt: 'amber',
  fullfort: 'green',
  slettet_kommentar: 'red',
}

const RAIL_BG: Record<(typeof RAIL_TONE)[keyof typeof RAIL_TONE], string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  grey: 'bg-neutral-400',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  cyan: 'bg-cyan-500',
}

export function railDotClass(action: AuditAction): string {
  return RAIL_BG[RAIL_TONE[action]]
}
