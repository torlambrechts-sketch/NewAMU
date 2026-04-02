import type { DocumentTemplate } from '../types/documents'

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'tpl-hms-policy',
    title: 'HMS-policy og mål',
    description: 'Overordnet mål og organisering av HMS-arbeidet (tilpass internkontrollforskriften).',
    category: 'HMS',
    suggestedTags: ['HMS', 'internkontroll'],
    lawRef: 'Internkontrollforskriften § 5; arbeidsmiljøloven § 3-1',
    html:
      '<h2>HMS-policy for {{virksomhet}}</h2><p><strong>Formål:</strong> …</p><h3>Mål</h3><ul><li>Mål 1</li><li>Mål 2</li></ul><p><em>Tilpass virksomheten. Verifiser mot lovdata.no.</em></p>',
    variableKeys: ['virksomhet', 'dato'],
    prePublishChecklist: [
      'Mål er diskutert med verneombud eller AMU der pliktig',
      'Ansvar og myndighet er beskrevet',
    ],
  },
  {
    id: 'tpl-ros',
    title: 'ROS / risikovurdering',
    description: 'Kartlegging av farer, risiko og planlagte tiltak.',
    category: 'HMS',
    suggestedTags: ['ROS', 'risiko'],
    lawRef: 'Arbeidsmiljøloven § 4-3; internkontrollforskriften § 5',
    html:
      '<h2>Risikovurdering — {{område}}</h2><h3>1. Kartlegging</h3><p>…</p><h3>2. Risiko</h3><p>…</p><h3>3. Tiltak</h3><table><tr><th>Tiltak</th><th>Ansvar</th><th>Frist</th></tr></table>',
    variableKeys: ['område', 'dato'],
    prePublishChecklist: ['Farer er kartlagt', 'Tiltak er satt med frist og ansvarlig'],
  },
  {
    id: 'tpl-amu-protokoll',
    title: 'Møteprotokoll AMU',
    description: 'Innkalling, agenda, beslutninger og oppfølging.',
    category: 'Samarbeid',
    suggestedTags: ['AMU', 'protokoll'],
    lawRef: 'Arbeidsmiljøloven kap. 7',
    html:
      '<h2>AMU-møte [dato]</h2><p><strong>Deltakere:</strong> …</p><h3>Saker</h3><ol><li>…</li></ol><h3>Beslutninger</h3><p>…</p>',
  },
  {
    id: 'tpl-varsling',
    title: 'Rutine for varsling',
    description: 'Mottak, undersøkelse og oppfølging (tilpass varslingsloven og interne regler).',
    category: 'Varsling',
    suggestedTags: ['varsling', 'rutine'],
    lawRef: 'Lov om arbeidslivets varslingssystemer',
    html:
      '<h2>Varslingsrutine</h2><h3>1. Mottak</h3><p>…</p><h3>2. Undersøkelse</h3><p>…</p><h3>3. Oppfølging</h3><p>…</p>',
  },
]
