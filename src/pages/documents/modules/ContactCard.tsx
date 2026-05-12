// ContactCard — strukturert kontakt­info i dokumenter.
//
// For varslings­rutiner, trakasserings­rutiner, BHT-årsplan o.l. der
// dokumentet må peke til hvem som er kontakt. Hvor mulig hentes data
// dynamisk (verneombud-navn fra representatives-hook); ellers fra params.

import { Mail, Phone, ExternalLink, ShieldQuestion, Users, HardHat, Building2, Lock } from 'lucide-react'

type Role = 'varslings_mottak' | 'bht' | 'verneombud' | 'tilsynet' | 'datatilsynet' | 'custom'

type Props = {
  role?: Role
  name?: string
  phone?: string
  email?: string
  url?: string
}

const ROLE_LABEL: Record<Role, string> = {
  varslings_mottak: 'Varslings­mottak',
  bht: 'Bedriftshelse­tjeneste (BHT)',
  verneombud: 'Verneombud',
  tilsynet: 'Arbeidstilsynet',
  datatilsynet: 'Datatilsynet',
  custom: 'Kontakt',
}

const ROLE_DEFAULTS: Record<Role, { phone?: string; email?: string; url?: string }> = {
  varslings_mottak: {},
  bht: {},
  verneombud: {},
  tilsynet: { phone: '73 19 97 00', url: 'https://www.arbeidstilsynet.no' },
  datatilsynet: { phone: '22 39 69 00', url: 'https://www.datatilsynet.no' },
  custom: {},
}

const ROLE_ICON: Record<Role, typeof Mail> = {
  varslings_mottak: ShieldQuestion,
  bht: HardHat,
  verneombud: Users,
  tilsynet: Building2,
  datatilsynet: Lock,
  custom: Mail,
}

export function ContactCard({ role = 'custom', name, phone, email, url }: Props) {
  const Icon = ROLE_ICON[role]
  const defaults = ROLE_DEFAULTS[role]
  const finalName = name ?? ROLE_LABEL[role]
  const finalPhone = phone ?? defaults.phone
  const finalEmail = email
  const finalUrl = url ?? defaults.url

  return (
    <div className="not-prose my-4 flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a3d32] text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 text-sm">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{ROLE_LABEL[role]}</div>
        <div className="mt-0.5 font-medium text-neutral-900">{finalName}</div>
        <div className="mt-1.5 space-y-0.5 text-xs text-neutral-700">
          {finalPhone ? (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              <a href={`tel:${finalPhone.replace(/\s+/g, '')}`} className="hover:underline">
                {finalPhone}
              </a>
            </div>
          ) : null}
          {finalEmail ? (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              <a href={`mailto:${finalEmail}`} className="hover:underline">
                {finalEmail}
              </a>
            </div>
          ) : null}
          {finalUrl ? (
            <div className="flex items-center gap-1.5">
              <ExternalLink className="h-3 w-3" />
              <a href={finalUrl} target="_blank" rel="noreferrer" className="hover:underline">
                {finalUrl}
              </a>
            </div>
          ) : null}
          {!finalPhone && !finalEmail && !finalUrl ? (
            <div className="italic text-neutral-400">[Fyll inn kontakt­info]</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
