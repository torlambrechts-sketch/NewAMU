// Static law-reference catalog used by ParagrafReferanse.
// IDs are stable and match the refLawIds arrays on system course modules.
// Extended as new law areas are added to the course catalog.

import type { LawRefEntry } from '../../components/learning/ParagrafReferanse'

export const AML_LAW_REFS_CATALOG: LawRefEntry[] = [
  { id: 'aml-1-1',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§1-1',  title: 'Lovens formål' },
  { id: 'aml-2-1',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§2-1',  title: 'Arbeidsgivers plikter' },
  { id: 'aml-2-2',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§2-2',  title: 'Plikter for andre enn arbeidsgivere' },
  { id: 'aml-3-1',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§3-1',  title: 'Krav til systematisk HMS-arbeid' },
  { id: 'aml-4-1',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§4-1',  title: 'Generelle krav til arbeidsmiljøet' },
  { id: 'aml-4-3',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§4-3',  title: 'Krav til det psykososiale arbeidsmiljøet' },
  { id: 'aml-4-6',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§4-6',  title: 'Tilrettelegging, medvirkning og utvikling' },
  { id: 'aml-6-1',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§6-1',  title: 'Plikt til å ha verneombud' },
  { id: 'aml-6-2',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§6-2',  title: 'Verneombudets oppgaver' },
  { id: 'aml-6-3',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§6-3',  title: 'Verneombudets stansingsrett' },
  { id: 'aml-7-1',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§7-1',  title: 'Plikt til å ha arbeidsmiljøutvalg' },
  { id: 'aml-7-2',  lawName: 'Arbeidsmiljøloven',                    paragraph: '§7-2',  title: 'Arbeidsmiljøutvalgets oppgaver' },
  { id: 'aml-10-6', lawName: 'Arbeidsmiljøloven',                    paragraph: '§10-6', title: 'Overtid' },
  { id: 'aml-10-8', lawName: 'Arbeidsmiljøloven',                    paragraph: '§10-8', title: 'Daglig og ukentlig arbeidsfri' },
  { id: 'aml-13-1', lawName: 'Arbeidsmiljøloven',                    paragraph: '§13-1', title: 'Forbud mot diskriminering' },
  { id: 'aml-13-8', lawName: 'Arbeidsmiljøloven',                    paragraph: '§13-8', title: 'Delt bevisbyrde' },
  { id: 'aml-15-1', lawName: 'Arbeidsmiljøloven',                    paragraph: '§15-1', title: 'Drøfting før beslutning om oppsigelse' },
  { id: 'aml-15-3', lawName: 'Arbeidsmiljøloven',                    paragraph: '§15-3', title: 'Oppsigelsesfrister' },
  { id: 'aml-15-7', lawName: 'Arbeidsmiljøloven',                    paragraph: '§15-7', title: 'Vern mot usaklig oppsigelse' },
  { id: 'aml-15-8', lawName: 'Arbeidsmiljøloven',                    paragraph: '§15-8', title: 'Oppsigelsesvern ved sykdom' },
  { id: 'aml-19-1', lawName: 'Arbeidsmiljøloven',                    paragraph: '§19-1', title: 'Straff' },
  { id: 'ikf-5',    lawName: 'Internkontrollforskriften',            paragraph: '§5',    title: 'Krav til dokumentasjon av HMS-systemet' },
  { id: 'ldl-13',   lawName: 'Likestillings- og diskrimineringsloven', paragraph: '§13',  title: 'Forbud mot diskriminering' },
]
