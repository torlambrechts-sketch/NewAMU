// Sikkerhet — revisjonslogg-lenke og veikart.
//
// No org-wide security tables exist yet (password policy, 2FA
// enforcement, session length all live at the Supabase Auth layer).
// This panel surfaces what's available today — the cross-module audit
// log — and lists what's planned, so admins know where to find each
// surface without hunting through old docs.

import { History, Lock, ScrollText, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../../module'
import { Button } from '../../../ui/Button'

const ROADMAP: { icon: typeof Shield; label: string; body: string }[] = [
  {
    icon: Lock,
    label: 'Passord­policy',
    body: 'Minstelengde, kompleksitet og utløp. Foreløpig styrt på Auth-laget.',
  },
  {
    icon: Shield,
    label: 'To-faktor (2FA) på org-nivå',
    body: 'Tving på for hele org eller spesifikke roller. Krever ny RPC + auth-hook.',
  },
  {
    icon: ScrollText,
    label: 'Sesjonslengde og IP-allowlist',
    body: 'Konfigurerbar timeout og IP-filter for admin-konti.',
  },
]

export default function SecurityAdminPanel() {
  return (
    <div className="space-y-4">
      <ModuleSectionCard className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <History className="size-5 text-[#1a3d32]" />
          Revisjonslogg
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Hvem gjorde hva, når, på tvers av modulene. Loggen er sammensatt fra hendelser i
          sjekklister, internkontroll, HMS, organisasjonshelse, møter og representanter.
        </p>
        <div className="mt-4">
          <Link to="/workspace/revisjonslogg">
            <Button variant="primary" size="sm">
              Åpne revisjonslogg
            </Button>
          </Link>
        </div>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Kommende sikkerhets­kontroller</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Følgende kontroller er identifisert men ikke implementert ennå. Inntil videre styres
          autentisering på Supabase Auth-nivå (per bruker).
        </p>
        <ul className="mt-4 space-y-3">
          {ROADMAP.map((r) => (
            <li key={r.label} className="flex items-start gap-3">
              <r.icon className="mt-0.5 size-4 text-neutral-400" />
              <div>
                <p className="text-sm font-medium text-neutral-900">{r.label}</p>
                <p className="text-xs text-neutral-600">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </ModuleSectionCard>
    </div>
  )
}
