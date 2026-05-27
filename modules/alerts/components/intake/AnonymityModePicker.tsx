// AnonymityModePicker — radio-card selector for the 4 anonymity modes
// defined by the v1.1 spec. Choice is irrevocable post-submit per the
// lock trigger; the helper text on each option makes that explicit.

import type { AlertAnonymityMode } from '../../types'

type Props = {
  value: AlertAnonymityMode
  onChange: (v: AlertAnonymityMode) => void
  lang: 'nb' | 'en'
  /** Templates with allows_anonymous = false hide the three anonymous modes. */
  allowsAnonymous: boolean
}

type Option = {
  mode: AlertAnonymityMode
  title: { nb: string; en: string }
  body: { nb: string; en: string }
  contactHint: { nb: string; en: string }
}

const OPTIONS: Option[] = [
  {
    mode: 'fully_anonymous',
    title: { nb: 'Fullt anonym', en: 'Fully anonymous' },
    body: {
      nb: 'Vi vet ikke hvem du er. Du kan kun følge saken via tilgangsnøkkelen vi gir deg.',
      en: 'We will not know who you are. Track the case via the access key we give you.',
    },
    contactHint: { nb: 'Ingen kontakt mulig.', en: 'No contact possible.' },
  },
  {
    mode: 'pseudonymous',
    title: { nb: 'Pseudonym med kontakt', en: 'Pseudonymous with contact' },
    body: {
      nb: 'Du gir en kontaktkanal (e-post) men ikke navn. Utvalget kan stille spørsmål uten å vite hvem du er.',
      en: 'You provide a contact channel (email) but no name. The committee can ask questions without knowing who you are.',
    },
    contactHint: { nb: 'Krever e-post.', en: 'Requires email.' },
  },
  {
    mode: 'confidential',
    title: { nb: 'Konfidensielt', en: 'Confidential' },
    body: {
      nb: 'Identiteten din lagres kryptert. Bare utvalget for konfidensielle saker (alerts.committee_confidential) får tilgang.',
      en: 'Your identity is stored encrypted. Only the confidential-case committee gets access.',
    },
    contactHint: { nb: 'Krever e-post.', en: 'Requires email.' },
  },
  {
    mode: 'open',
    title: { nb: 'Åpent (med navn)', en: 'Open (with name)' },
    body: {
      nb: 'Du er åpen om hvem du er. Saksbehandlere ser identiteten din. Vanligvis valgt av interne ansatte.',
      en: 'You are open about who you are. Handlers see your identity. Typically chosen by employees.',
    },
    contactHint: { nb: 'Krever navn + e-post.', en: 'Requires name + email.' },
  },
]

export function AnonymityModePicker({ value, onChange, lang, allowsAnonymous }: Props) {
  const visibleOptions = allowsAnonymous ? OPTIONS : OPTIONS.filter((o) => o.mode === 'open')
  return (
    <fieldset className="mb-6">
      <legend className="text-sm font-semibold text-neutral-900 mb-2">
        {lang === 'nb' ? 'Hvor anonym vil du være?' : 'How anonymous would you like to be?'}
      </legend>
      <p className="text-xs text-neutral-600 mb-3">
        {lang === 'nb'
          ? 'Valget kan ikke endres etter at varselet er sendt.'
          : 'This choice cannot be changed after the report is submitted.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleOptions.map((o) => {
          const checked = value === o.mode
          return (
            <label
              key={o.mode}
              className={`flex cursor-pointer rounded-lg border-2 p-3 transition ${
                checked ? 'border-red-700 bg-red-50' : 'border-neutral-200 bg-white hover:border-neutral-400'
              }`}
            >
              <input
                type="radio"
                name="anonymity_mode"
                value={o.mode}
                checked={checked}
                onChange={() => onChange(o.mode)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-4 w-4 rounded-full border-2 ${
                      checked ? 'border-red-700 bg-red-700' : 'border-neutral-400'
                    }`}
                  />
                  <span className="text-sm font-semibold">{o.title[lang]}</span>
                </div>
                <p className="mt-1.5 text-xs text-neutral-700">{o.body[lang]}</p>
                <p className="mt-1 text-xs italic text-neutral-500">{o.contactHint[lang]}</p>
              </div>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
