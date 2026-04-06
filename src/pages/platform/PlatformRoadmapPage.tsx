import { Globe, ListTree, Shield } from 'lucide-react'
import { ProductRoadmapList } from '../../components/ProductRoadmapList'

export function PlatformRoadmapPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Produktveikart</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Samme innhold som tidligere under organisasjonshelse-innstillinger — samlet her for plattformteam.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <ListTree className="size-7" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Prioriterte leveranser</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Intern oversikt — prioriteringer kan endres. Teknisk implementasjonsforslag ligger under listen.
            </p>
          </div>
        </div>

        <div className="text-neutral-200 [&_h2]:text-amber-100/95 [&_li]:border-white/10 [&_li]:bg-slate-900/40">
          <ProductRoadmapList />
        </div>

        <div className="mt-8 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
          <h3 className="text-sm font-semibold text-sky-200">Forslag til implementasjon og hvordan vi starter</h3>
          <p className="mt-2 text-sm text-sky-100/85">
            Felles mønster: nye tabeller org-scoped + RLS, tillatelsesnøkler, tynn UI. Start med én vertikal spike (DB →
            policy → én skjerm).
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-sky-100/85">
            <li>
              <strong>Fase 1:</strong> migrasjon med tabeller og revisjonsspor; manuell test uten integrasjon.
            </li>
            <li>
              <strong>Fase 2:</strong> arbeidsflyt + Kanban; pg_cron der det trengs.
            </li>
            <li>
              <strong>Fase 3:</strong> webhooks og eksterne portaler.
            </li>
          </ol>
        </div>

        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <Globe className="size-5 shrink-0" />
            Bedriftsomtale — kort mål
          </div>
          <p className="mt-2 text-sm text-emerald-100/90">
            Én offentlig side for anonym rapportering og informasjon uten full admin-tilgang.
          </p>
        </div>

        <p className="mt-6 flex items-start gap-2 text-xs text-neutral-500">
          <Shield className="size-4 shrink-0 mt-0.5" />
          Ikke juridisk rådgivning — tilpass mot egen DPA og internkontroll.
        </p>
      </div>
    </div>
  )
}
