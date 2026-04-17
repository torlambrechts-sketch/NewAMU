/** GDPR art. 6(1) and art. 9(2) — for datalist autocomplete in wiki PII settings */
export const GDPR_ART6_SUGGESTIONS = [
  'GDPR art. 6 nr. 1 bokstav a — samtykke',
  'GDPR art. 6 nr. 1 bokstav b — kontrakt',
  'GDPR art. 6 nr. 1 bokstav c — rettslig forpliktelse',
  'GDPR art. 6 nr. 1 bokstav d — vitale interesser',
  'GDPR art. 6 nr. 1 bokstav e — offentlig myndighetsutøvelse',
  'GDPR art. 6 nr. 1 bokstav f — berettiget interesse',
] as const

export const GDPR_ART9_SUGGESTIONS = [
  'GDPR art. 9 nr. 2 bokstav a — uttrykkelig samtykke',
  'GDPR art. 9 nr. 2 bokstav b — arbeidsrett, sosial sikkerhet og sosial beskyttelse',
  'GDPR art. 9 nr. 2 bokstav c — vitale interesser',
  'GDPR art. 9 nr. 2 bokstav d — legitime aktiviteter fra stiftelser/organisasjoner',
  'GDPR art. 9 nr. 2 bokstav e — offentliggjort av den registrerte',
  'GDPR art. 9 nr. 2 bokstav f — rettslige krav',
  'GDPR art. 9 nr. 2 bokstav g — vesentlige allmenne interesser',
  'GDPR art. 9 nr. 2 bokstav h — helse eller yrkesmedisin',
  'GDPR art. 9 nr. 2 bokstav i — allmenne interesser på folkehelseområdet',
  'GDPR art. 9 nr. 2 bokstav j — arkiv, forskning eller statistikk',
] as const

export const PII_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'navn', label: 'Navn / kontakt' },
  { value: 'lonn', label: 'Lønn og økonomi' },
  { value: 'helse', label: 'Helse (særlig kategori, art. 9)' },
  { value: 'fagforeningsmedlemskap', label: 'Fagforeningsmedlemskap (særlig kategori)' },
  { value: 'etnisitet', label: 'Etnisitet / religion (særlig kategori)' },
  { value: 'biometri', label: 'Biometri' },
  { value: 'annet', label: 'Annet' },
]
