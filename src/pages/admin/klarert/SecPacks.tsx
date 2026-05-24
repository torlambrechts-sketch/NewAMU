// Mal-pakker-seksjonen.
// Toppliste: kort per framework. Klikk på et kort åpner PackDetail
// med tre faner (Innhold, Tilganger, Versjoner). System-pakker er
// låst — Tilpass-knappen åpner en wizard som lager intern kopi.

import { useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  FileEdit,
  FileStack,
  GitBranch,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Package,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { Tabs } from '../../../components/ui/Tabs'
import { formatShortDate } from './format'
import {
  ADMIN_SERIF,
  AdminCard,
  AdminError,
  AdminInfoBanner,
  AdminLoading,
} from './AdminShared'
import { useAdminPacks, type PackTemplateRow } from './useAdminPacks'
import type { PackSummary, RouteName } from './types'

interface SecPacksProps {
  easy: boolean
  route: RouteName
  setRoute: (route: RouteName) => void
}

export function SecPacks({ easy, route, setRoute }: SecPacksProps) {
  const { packs, templates, loading, error, installPack, uninstallPack, createInternalPackFromTemplates } =
    useAdminPacks()

  if (loading) return <AdminLoading />
  if (error) return <AdminError message={error} />

  if (route.name === 'pack-detail') {
    const pack = packs.find((p) => p.id === route.packId)
    if (!pack) {
      return (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
            onClick={() => setRoute({ name: 'list' })}
          >
            Tilbake til pakker
          </Button>
          <AdminError message="Pakken finnes ikke." />
        </div>
      )
    }
    return (
      <PackDetail
        pack={pack}
        templates={templates.filter((t) => t.packFramework === pack.framework)}
        easy={easy}
        onBack={() => setRoute({ name: 'list' })}
        onOpenTemplate={(t) =>
          setRoute({ name: 'pack-template-edit', packId: pack.id, templateId: t.id })
        }
        onTilpass={() => setRoute({ name: 'pack-tilpass', packId: pack.id })}
        onInstall={() => installPack(pack.framework)}
        onUninstall={() => uninstallPack(pack.framework)}
      />
    )
  }

  if (route.name === 'pack-template-edit') {
    const pack = packs.find((p) => p.id === route.packId)
    const tpl = templates.find((t) => t.id === route.templateId) ?? null
    return (
      <PackTemplateEditor
        pack={pack ?? null}
        template={tpl}
        easy={easy}
        onBack={() =>
          setRoute({
            name: 'pack-detail',
            packId: route.packId,
          })
        }
      />
    )
  }

  if (route.name === 'pack-tilpass') {
    const pack = packs.find((p) => p.id === route.packId)
    if (!pack) {
      return (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
            onClick={() => setRoute({ name: 'list' })}
          >
            Avbryt
          </Button>
          <AdminError message="Pakken finnes ikke." />
        </div>
      )
    }
    return (
      <TilpassWizard
        pack={pack}
        templates={templates.filter((t) => t.packFramework === pack.framework)}
        onBack={() => setRoute({ name: 'pack-detail', packId: pack.id })}
        onCreate={createInternalPackFromTemplates}
      />
    )
  }

  return (
    <div className="space-y-4">
      <AdminInfoBanner
        icon={<Package className="h-4 w-4" aria-hidden="true" />}
        title="Mal-pakker"
        description="Offisielle pakker er låst — men kan kopieres og tilpasses. Egne pakker kan redigeres fritt."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {packs.map((p) => {
          const totalTpls =
            p.contents.checklist +
            p.contents.survey +
            p.contents.document +
            p.contents.meeting +
            p.contents.register +
            p.contents.course
          const Icon = p.icon
          return (
            <article
              key={p.id}
              onClick={() => setRoute({ name: 'pack-detail', packId: p.id })}
              className="cursor-pointer overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-[#1a3d32]/40 hover:shadow-md"
            >
              <div className="h-1.5" style={{ background: p.color }} />
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `${p.color}18`, color: p.color }}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {p.official && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-[#1a3d32] px-1 py-0.5 text-[9px] font-bold text-white">
                          <Lock className="h-2 w-2" aria-hidden="true" /> System
                        </span>
                      )}
                      {p.installed ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-green-100 px-1 py-0.5 text-[9px] font-bold text-green-800">
                          <Check className="h-2 w-2" aria-hidden="true" /> Installert
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-500">
                          Tilgjengelig
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold leading-tight text-neutral-900">
                      {p.name}
                    </h3>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-neutral-600">
                  {p.description}
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-500">
                  <span>
                    v{p.version}
                    {p.lastUpdated ? ` · ${formatShortDate(p.lastUpdated)}` : ''}
                  </span>
                  <span className="font-semibold tabular-nums">{totalTpls} maler</span>
                </div>
              </div>
            </article>
          )
        })}
        <Button
          variant="ghost"
          className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-transparent p-4 text-neutral-500 transition-colors hover:border-[#1a3d32] hover:bg-white hover:text-[#1a3d32]"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
          <span className="text-sm font-semibold">Ny intern pakke</span>
          <span className="text-[11px] text-neutral-400">Bunt opp dine egne maler</span>
        </Button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Pack detail page
// ──────────────────────────────────────────────────────────────────────────

function PackDetail({
  pack,
  templates,
  onBack,
  onOpenTemplate,
  onTilpass,
  onInstall,
  onUninstall,
}: {
  pack: PackSummary
  templates: PackTemplateRow[]
  easy: boolean
  onBack: () => void
  onOpenTemplate: (t: PackTemplateRow) => void
  onTilpass: () => void
  onInstall: () => Promise<string | null>
  onUninstall: () => Promise<string | null>
}) {
  const [tab, setTab] = useState<'contents' | 'permissions' | 'versions'>('contents')
  const [installBusy, setInstallBusy] = useState(false)
  const [installErr, setInstallErr] = useState<string | null>(null)
  const isSystem = pack.official
  const Icon = pack.icon

  async function handleInstall() {
    setInstallBusy(true)
    setInstallErr(null)
    try {
      const err = await onInstall()
      if (err) setInstallErr(err)
    } finally {
      setInstallBusy(false)
    }
  }

  async function handleUninstall() {
    if (!window.confirm(`Avinstaller ${pack.name}? Eksisterende gjennomføringer beholdes — bare malene fjernes fra aktiv katalog.`)) {
      return
    }
    setInstallBusy(true)
    setInstallErr(null)
    try {
      const err = await onUninstall()
      if (err) setInstallErr(err)
    } finally {
      setInstallBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          onClick={onBack}
        >
          Tilbake til pakker
        </Button>
      </div>

      <AdminCard className="p-5">
        <div className="flex items-start gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${pack.color}18`, color: pack.color }}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {isSystem ? (
                <span className="inline-flex items-center gap-1 rounded bg-[#1a3d32] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  <Lock className="h-2.5 w-2.5" aria-hidden="true" /> System — låst for redigering
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                  <Pencil className="h-2.5 w-2.5" aria-hidden="true" /> Intern — redigerbar
                </span>
              )}
              {pack.lawRefs.map((l) => (
                <span
                  key={l}
                  className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
                >
                  {l}
                </span>
              ))}
              <span className="text-[10px] tabular-nums text-neutral-500">
                v{pack.version}
                {pack.lastUpdated ? ` · oppdatert ${formatShortDate(pack.lastUpdated)}` : ''}
              </span>
            </div>
            <h2
              className="mt-1 text-xl font-bold tracking-tight text-neutral-900"
              style={{ fontFamily: ADMIN_SERIF }}
            >
              {pack.name}
            </h2>
            <p className="mt-1 text-sm text-neutral-700">{pack.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy className="h-3 w-3" />}
              onClick={onTilpass}
            >
              Tilpass
            </Button>
            {pack.installed ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={installBusy}
                icon={installBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                onClick={() => void handleUninstall()}
              >
                Avinstaller
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                disabled={installBusy}
                icon={installBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                onClick={() => void handleInstall()}
              >
                Installer pakke
              </Button>
            )}
          </div>
        </div>

        {installErr && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50/60 p-3 text-[12px]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
            <p className="text-red-900">{installErr}</p>
          </div>
        )}

        {isSystem && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-[12px]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
            <p className="text-amber-900">
              Dette er en system-pakke fra Klarert. Maler kan vises og kopieres, men ikke endres
              direkte. Klikk <span className="font-semibold">Tilpass</span> for å lage en intern
              kopi som kan tilpasses fritt.
            </p>
          </div>
        )}
      </AdminCard>

      <AdminCard>
        <div className="border-b border-neutral-100 px-5 py-2.5">
          <Tabs
            items={[
              { id: 'contents', label: 'Innhold', icon: FileStack },
              { id: 'permissions', label: 'Tilganger', icon: KeyRound },
              { id: 'versions', label: 'Versjoner', icon: GitBranch },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as typeof tab)}
          />
        </div>
        <div className="p-5">
          {tab === 'contents' && (
            <PackContents
              pack={pack}
              templates={templates}
              isSystem={isSystem}
              onOpenTemplate={onOpenTemplate}
              onTilpass={onTilpass}
            />
          )}
          {tab === 'permissions' && <PackPermissions />}
          {tab === 'versions' && <PackVersions pack={pack} />}
        </div>
      </AdminCard>
    </div>
  )
}

function PackContents({
  templates,
  isSystem,
  onOpenTemplate,
  onTilpass,
}: {
  pack: PackSummary
  templates: PackTemplateRow[]
  isSystem: boolean
  onOpenTemplate: (t: PackTemplateRow) => void
  onTilpass: () => void
}) {
  const [filter, setFilter] = useState<string>('all')
  const types = Array.from(new Set(templates.map((t) => t.moduleLabel)))
  const filtered = filter === 'all' ? templates : templates.filter((t) => t.moduleLabel === filter)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label={`Alle (${templates.length})`}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          {types.map((t) => (
            <FilterChip
              key={t}
              label={`${t} (${templates.filter((x) => x.moduleLabel === t).length})`}
              active={filter === t}
              onClick={() => setFilter(t)}
            />
          ))}
        </div>
        {isSystem ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy className="h-3 w-3" />}
            onClick={onTilpass}
          >
            Lag intern kopi
          </Button>
        ) : (
          <Button variant="primary" size="sm" icon={<Plus className="h-3 w-3" />}>
            Ny mal
          </Button>
        )}
      </div>

      <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200/80">
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-neutral-500">
            Ingen maler i denne pakken enda.
          </li>
        ) : (
          filtered.map((t) => (
            <li
              key={t.id}
              onClick={() => onOpenTemplate(t)}
              className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-50/60"
            >
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                {t.moduleLabel}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-neutral-900">{t.name}</span>
                  {t.isSystem && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-[#1a3d32] px-1 py-0.5 text-[9px] font-bold text-white">
                      <Lock className="h-2 w-2" aria-hidden="true" /> System
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
                  <span className="tabular-nums">v{t.version}</span>
                  {t.itemCount > 0 ? (
                    <>
                      <span>·</span>
                      <span className="tabular-nums">{t.itemCount} punkter</span>
                    </>
                  ) : null}
                  {t.lawRefs.slice(0, 3).map((l) => (
                    <span
                      key={l}
                      className="rounded bg-[#e7efe9] px-1 py-0 font-semibold text-[#14312a]"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenTemplate(t)
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-[#1a3d32] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#143028]"
                >
                  <FileEdit className="h-3 w-3" aria-hidden="true" />
                  Åpne mal
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

function PackPermissions() {
  const rows = [
    { role: 'Alle ansatte', access: 'Lese' },
    { role: 'HMS-leder', access: 'Bruke + opprette gjennomføringer' },
    { role: 'Verneombud', access: 'Bruke + opprette' },
    { role: 'Administrator', access: 'Full kontroll (installer/avinstaller)' },
  ]
  return (
    <div className="space-y-3 text-sm">
      <p className="text-[12px] text-neutral-600">Hvem kan se og bruke malene i denne pakken.</p>
      <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200/80">
        {rows.map((r) => (
          <li key={r.role} className="flex items-center justify-between px-3 py-2">
            <span className="text-neutral-900">{r.role}</span>
            <span className="text-[11px] text-neutral-600">{r.access}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PackVersions({ pack }: { pack: PackSummary }) {
  const history = [
    {
      v: pack.version,
      when: pack.lastUpdated ? formatShortDate(pack.lastUpdated) : '—',
      who: 'Klarert Compliance',
      notes: 'Oppdatert etter ny rettspraksis. 2 nye agenda-punkter på AMU-mal.',
      current: true,
    },
    {
      v: '2025.4',
      when: '14.11.2025',
      who: 'Klarert Compliance',
      notes: 'Mindre språklige rettelser.',
      current: false,
    },
    {
      v: '2025.3',
      when: '02.08.2025',
      who: 'Klarert Compliance',
      notes: 'Lagt til SJA-mal og oppdatert risikomatrise.',
      current: false,
    },
  ]
  return (
    <ol className="space-y-2">
      {history.map((v) => (
        <li
          key={v.v}
          className={
            'rounded-md border p-3 ' +
            (v.current ? 'border-[#1a3d32]/30 bg-[#e7efe9]/30' : 'border-neutral-200/80 bg-white')
          }
        >
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums text-neutral-900">v{v.v}</span>
              {v.current && (
                <span className="rounded bg-[#1a3d32] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Aktiv
                </span>
              )}
            </div>
            <span className="text-[10px] tabular-nums text-neutral-500">
              {v.when} · {v.who}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-neutral-700">{v.notes}</p>
        </li>
      ))}
    </ol>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Template editor (system templates are read-only)
// ──────────────────────────────────────────────────────────────────────────

function PackTemplateEditor({
  template,
  onBack,
}: {
  pack: PackSummary | null
  template: PackTemplateRow | null
  easy: boolean
  onBack: () => void
}) {
  const [tab, setTab] = useState<
    'innhold' | 'felter' | 'logikk' | 'lov' | 'tilganger' | 'preview'
  >('innhold')
  const [name, setName] = useState(template?.name ?? 'Ny mal')
  const isSystem = template?.isSystem ?? false

  const tabs = [
    { id: 'innhold', label: 'Innhold', icon: FileStack },
    { id: 'felter', label: 'Felter & typer', icon: KeyRound },
    { id: 'logikk', label: 'Logikk', icon: GitBranch },
    { id: 'lov', label: 'Lov & retensjon', icon: Lock },
    { id: 'tilganger', label: 'Tilganger', icon: KeyRound },
    { id: 'preview', label: 'Forhåndsvisning', icon: FileEdit },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          onClick={onBack}
        >
          Tilbake til pakke
        </Button>
      </div>

      {isSystem && (
        <AdminCard className="border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">
                Skrivebeskyttet — system-mal
              </h3>
              <p className="mt-0.5 text-[12px] text-amber-800">
                Du kan vise denne malen og forhåndsvise hvordan den ser ut, men ikke endre den
                direkte. Lag en kopi i en intern pakke for å redigere.
              </p>
            </div>
            <Button variant="primary" size="sm" icon={<Copy className="h-3 w-3" />}>
              Lag intern kopi
            </Button>
          </div>
        </AdminCard>
      )}

      <AdminCard className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]">
            <FileEdit className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                {template?.moduleLabel ?? 'Mal'}
              </span>
              {isSystem && (
                <span className="inline-flex items-center gap-0.5 rounded bg-[#1a3d32] px-1 py-0.5 text-[9px] font-bold text-white">
                  <Lock className="h-2 w-2" aria-hidden="true" /> System · v{template?.version ?? '1.0'}
                </span>
              )}
            </div>
            <StandardInput
              value={name}
              onChange={(e) => {
                if (!isSystem) setName(e.target.value)
              }}
              disabled={isSystem}
              className="mt-1.5 w-full border-none bg-transparent p-0 text-xl font-bold leading-tight tracking-tight text-neutral-900 outline-none focus:bg-amber-50/40 disabled:cursor-not-allowed"
              style={{ fontFamily: ADMIN_SERIF }}
            />
          </div>
          {!isSystem && (
            <Button variant="primary" size="sm" icon={<Check className="h-3 w-3" />}>
              Publiser endringer
            </Button>
          )}
        </div>
      </AdminCard>

      <AdminCard>
        <div className="border-b border-neutral-100 px-5 py-2.5">
          <Tabs
            items={tabs}
            activeId={tab}
            onChange={(id) => setTab(id as typeof tab)}
          />
        </div>
        <div className="p-5">
          {tab === 'innhold' && <EdInnhold isSystem={isSystem} />}
          {tab === 'felter' && <EdFelter isSystem={isSystem} />}
          {tab === 'logikk' && <EdLogikk isSystem={isSystem} />}
          {tab === 'lov' && <EdLov template={template} isSystem={isSystem} />}
          {tab === 'tilganger' && <EdTilganger isSystem={isSystem} />}
          {tab === 'preview' && <EdPreview template={template} />}
        </div>
      </AdminCard>
    </div>
  )
}

function ReadOnlyOverlay({
  isSystem,
  children,
}: {
  isSystem: boolean
  children: React.ReactNode
}) {
  return <div className={isSystem ? 'pointer-events-none opacity-75' : ''}>{children}</div>
}

function EdInnhold({ isSystem }: { isSystem: boolean }) {
  const sections = [
    'Inngang og fellesarealer',
    'Kontorarbeidsplasser',
    'Møterom og kjøkken',
    'Lager og teknisk rom',
  ]
  const items = [
    'Inngangsdør lukker automatisk og uten hinder',
    'Rømningsskilt er synlige og opplyst',
    'Resepsjonsområdet er ryddet',
    'Brannslokker tilgjengelig ved hovedinngang',
    'Førstehjelpsskap er fullt og innen utløpsdato',
    'Belysning fungerer i hele fellesarealet',
  ]
  const counts = [6, 8, 5, 5]

  return (
    <ReadOnlyOverlay isSystem={isSystem}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <aside>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Seksjoner
          </div>
          <ul className="mt-2 space-y-0.5">
            {sections.map((s, i) => (
              <li key={s}>
                <Button
                  variant="ghost"
                  className={
                    'flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs ' +
                    (i === 0
                      ? 'bg-[#e7efe9] font-semibold text-[#1a3d32] hover:bg-[#e7efe9]/80'
                      : 'border-transparent text-neutral-700 hover:bg-neutral-50')
                  }
                >
                  <span className="truncate">
                    {i + 1}. {s}
                  </span>
                  <span className="text-[9px] tabular-nums text-neutral-400">{counts[i]}</span>
                </Button>
              </li>
            ))}
          </ul>
          {!isSystem && (
            <Button
              variant="ghost"
              className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-neutral-300 px-2 py-1 text-[11px] text-neutral-500 hover:border-[#1a3d32]"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Ny seksjon
            </Button>
          )}
        </aside>
        <div>
          <h4 className="text-sm font-semibold text-neutral-900">
            Punkter i 1. Inngang og fellesarealer
          </h4>
          <ol className="mt-2 space-y-1.5">
            {items.map((it, i) => (
              <li
                key={it}
                className="flex items-start gap-2 rounded-md border border-neutral-200/80 bg-white p-2.5"
              >
                <span className="text-[11px] font-bold tabular-nums text-neutral-400">{i + 1}</span>
                <span className="flex-1 text-sm text-neutral-900">{it}</span>
                <span className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                  Ja/Nei
                </span>
              </li>
            ))}
          </ol>
          {!isSystem && (
            <Button
              variant="ghost"
              className="mt-2 inline-flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Nytt punkt
            </Button>
          )}
        </div>
      </div>
    </ReadOnlyOverlay>
  )
}

function EdFelter({ isSystem }: { isSystem: boolean }) {
  const fields = [
    { name: 'Tittel', type: 'Tekst', required: true, primary: true, auto: false },
    { name: 'Lokasjon', type: 'Tekst', required: true, primary: false, auto: false },
    { name: 'Frist', type: 'Dato', required: true, primary: false, auto: false },
    { name: 'Ansvarlig', type: 'Person', required: true, primary: false, auto: false },
    { name: 'Score', type: 'Tall', required: false, primary: false, auto: true },
    { name: 'Funn', type: 'Tall', required: false, primary: false, auto: true },
    { name: 'Lovpålagt', type: 'Boolean', required: false, primary: false, auto: false },
  ]
  return (
    <ReadOnlyOverlay isSystem={isSystem}>
      <p className="text-[12px] text-neutral-600">
        Hvilke felter har hver gjennomføring av denne malen.
      </p>
      <ul className="mt-3 divide-y divide-neutral-100 rounded-md border border-neutral-200/80">
        {fields.map((f) => (
          <li key={f.name} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900">
              {f.name}
              {f.primary && (
                <span className="ml-1.5 rounded bg-[#e7efe9] px-1 py-0 text-[9px] font-bold text-[#14312a]">
                  PRIMÆR
                </span>
              )}
              {f.auto && (
                <span className="ml-1.5 rounded bg-blue-100 px-1 py-0 text-[9px] font-bold text-blue-800">
                  AUTO
                </span>
              )}
            </span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
              {f.type}
            </span>
            <span
              className={
                'rounded px-1.5 py-0.5 text-[10px] font-semibold ' +
                (f.required
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-neutral-100 text-neutral-600')
              }
            >
              {f.required ? 'Påkrevd' : 'Valgfritt'}
            </span>
          </li>
        ))}
      </ul>
      {!isSystem && (
        <Button
          variant="ghost"
          className="mt-3 inline-flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Nytt felt
        </Button>
      )}
    </ReadOnlyOverlay>
  )
}

function EdLogikk({ isSystem }: { isSystem: boolean }) {
  const rules = [
    { when: 'Hvis svar = Nei på § 1.3', then: 'Krev fritekst-kommentar + foto' },
    {
      when: 'Hvis avvik registreres med kritisk alvorlighet',
      then: 'Send varsel til hovedverneombud (system-handling)',
    },
    { when: 'Hvis snittscore < 70', then: 'Opprett oppfølgingsoppgave til HMS-leder' },
  ]
  return (
    <ReadOnlyOverlay isSystem={isSystem}>
      <p className="text-[12px] text-neutral-600">
        Betingede spørsmål, automatiske handlinger og forgreninger.
      </p>
      <ul className="mt-3 space-y-2">
        {rules.map((r) => (
          <li key={r.when} className="rounded-md border border-neutral-200/80 bg-[#fbf9f3]/40 p-3">
            <div className="flex items-start gap-2 text-[12px]">
              <GitBranch className="mt-0.5 h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              <div className="flex-1">
                <div className="text-neutral-900">
                  <span className="font-semibold text-amber-700">NÅR </span>
                  {r.when}
                </div>
                <div className="text-neutral-900">
                  <span className="font-semibold text-[#1a3d32]">SÅ </span>
                  {r.then}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!isSystem && (
        <Button
          variant="ghost"
          className="mt-2 inline-flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Ny regel
        </Button>
      )}
    </ReadOnlyOverlay>
  )
}

function EdLov({
  template,
  isSystem,
}: {
  template: PackTemplateRow | null
  isSystem: boolean
}) {
  return (
    <ReadOnlyOverlay isSystem={isSystem}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <section>
          <h4 className="text-sm font-semibold text-neutral-900">Lovverk-referanser</h4>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Lovgrunnlag som styrer malens innhold.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(template?.lawRefs ?? []).map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]"
              >
                {l}
              </span>
            ))}
            {!isSystem && (
              <Button
                variant="ghost"
                className="rounded border border-dashed border-neutral-300 px-2 py-0.5 text-[10px] text-neutral-500 hover:border-[#1a3d32]"
              >
                <Plus className="inline h-2.5 w-2.5" aria-hidden="true" />
                Legg til
              </Button>
            )}
          </div>
        </section>
        <section>
          <h4 className="text-sm font-semibold text-neutral-900">Retensjon og signering</h4>
          <ul className="mt-2 space-y-2 text-xs">
            <li className="flex justify-between">
              <dt className="text-neutral-500">Lagringstid</dt>
              <dd className="text-neutral-900">5 år (IK § 5)</dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Signaturer påkrevd</dt>
              <dd className="text-neutral-900">2 av 3</dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Behandlingsgrunnlag</dt>
              <dd className="text-neutral-900">GDPR Art. 6 (1) c</dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Eksport</dt>
              <dd className="text-neutral-900">PDF · CSV · API</dd>
            </li>
          </ul>
        </section>
      </div>
    </ReadOnlyOverlay>
  )
}

function EdTilganger({ isSystem }: { isSystem: boolean }) {
  const rows = [
    { role: 'Alle ansatte', can: 'Lese' },
    { role: 'HMS-leder', can: 'Lese + Bruke + Opprette' },
    { role: 'Verneombud', can: 'Lese + Bruke' },
    { role: 'Administrator', can: 'Full' },
  ]
  return (
    <ReadOnlyOverlay isSystem={isSystem}>
      <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200/80">
        {rows.map((r) => (
          <li key={r.role} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-neutral-900">{r.role}</span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
              {r.can}
            </span>
          </li>
        ))}
      </ul>
    </ReadOnlyOverlay>
  )
}

function EdPreview({ template }: { template: PackTemplateRow | null }) {
  return (
    <article className="mx-auto max-w-[640px] rounded-xl bg-white px-8 py-6 ring-1 ring-neutral-200/70">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">
        {template?.moduleLabel ?? 'Mal'} · v{template?.version ?? '1.0'}
      </div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
        {template?.name ?? 'Mal'}
      </h2>
      <div className="mt-3 flex flex-wrap gap-1">
        {(template?.lawRefs ?? []).map((l) => (
          <span
            key={l}
            className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
          >
            {l}
          </span>
        ))}
      </div>
      <div className="mt-5 space-y-3 text-[14px] leading-relaxed text-neutral-700">
        <p>
          Slik vil malen se ut for brukeren. Strukturen følger seksjoner og punkter definert i
          Innhold-fanen.
        </p>
        <p>Felt og logikk vises automatisk basert på det som er konfigurert.</p>
      </div>
    </article>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Tilpass wizard
// ──────────────────────────────────────────────────────────────────────────

function TilpassWizard({
  pack,
  templates,
  onBack,
  onCreate,
}: {
  pack: PackSummary
  templates: PackTemplateRow[]
  onBack: () => void
  onCreate: (
    sourceTemplateIds: string[],
    packName: string,
  ) => Promise<{ copied: number; skipped: number; error: string | null }>
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [packName, setPackName] = useState(`${pack.name} (kopi)`)
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<
    { copied: number; skipped: number; error: string | null } | null
  >(null)
  const selectedIds = Object.keys(selected).filter((k) => selected[k])

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function submit() {
    setCreating(true)
    setCreateResult(null)
    try {
      const result = await onCreate(selectedIds, packName.trim() || `${pack.name} (kopi)`)
      setCreateResult(result)
    } finally {
      setCreating(false)
    }
  }

  const steps = [
    { n: 1 as const, label: 'Velg maler' },
    { n: 2 as const, label: 'Tilpass valg' },
    { n: 3 as const, label: 'Lag pakke' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          onClick={onBack}
        >
          Avbryt
        </Button>
      </div>

      <AdminCard className="p-4">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <span
                  className={
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ' +
                    (step === s.n
                      ? 'bg-[#1a3d32] text-white'
                      : step > s.n
                        ? 'bg-green-600 text-white'
                        : 'bg-neutral-200 text-neutral-500')
                  }
                >
                  {step > s.n ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : s.n}
                </span>
                <span
                  className={
                    'text-sm font-medium ' +
                    (step === s.n ? 'text-neutral-900' : 'text-neutral-500')
                  }
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && <div className="mx-2 h-px flex-1 bg-neutral-200" />}
            </div>
          ))}
        </div>
      </AdminCard>

      {step === 1 && (
        <AdminCard className="p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Hvilke maler vil du tilpasse?</h3>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            Velg én eller flere. Du kan tilpasse dem i neste steg.
          </p>
          <ul className="mt-4 divide-y divide-neutral-100 rounded-md border border-neutral-200/80">
            {templates.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-neutral-500">
                Ingen maler i pakken.
              </li>
            ) : (
              templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50/60"
                >
                  <StandardInput
                    type="checkbox"
                    checked={!!selected[t.id]}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4"
                    aria-label={`Velg ${t.name}`}
                  />
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                    {t.moduleLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-neutral-900">{t.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
                      <span className="tabular-nums">v{t.version}</span>
                      {t.lawRefs.slice(0, 3).map((l) => (
                        <span
                          key={l}
                          className="rounded bg-[#e7efe9] px-1 py-0 font-semibold text-[#14312a]"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">
              <span className="font-semibold tabular-nums text-neutral-900">
                {selectedIds.length}
              </span>{' '}
              av {templates.length} valgt
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setStep(2)}
              icon={<ArrowRight className="h-3 w-3" />}
              disabled={selectedIds.length === 0}
            >
              Neste · Tilpass
            </Button>
          </div>
        </AdminCard>
      )}

      {step === 2 && (
        <AdminCard className="p-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            Hva ønsker du å endre per mal?
          </h3>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            Velg hvilke aspekter du vil tilpasse. Du kan justere detaljer etter pakken er
            opprettet.
          </p>
          <div className="mt-4 space-y-3">
            {templates
              .filter((t) => selected[t.id])
              .map((t) => (
                <div key={t.id} className="rounded-md border border-neutral-200/80 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                      {t.moduleLabel}
                    </span>
                    <span className="text-sm font-semibold text-neutral-900">{t.name}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {[
                      { id: 'name', label: 'Endre navn' },
                      { id: 'sections', label: 'Endre seksjoner' },
                      { id: 'items', label: 'Endre punkter' },
                      { id: 'fields', label: 'Endre felter' },
                      { id: 'logic', label: 'Egne regler' },
                      { id: 'permissions', label: 'Egne tilganger' },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] hover:border-[#1a3d32]"
                      >
                        <StandardInput
                          type="checkbox"
                          defaultChecked={opt.id === 'name' || opt.id === 'items'}
                          className="h-3 w-3"
                        />
                        <span className="text-neutral-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-3 w-3" />}
              onClick={() => setStep(1)}
            >
              Tilbake
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setStep(3)}
              icon={<ArrowRight className="h-3 w-3" />}
            >
              Neste · Bygg pakke
            </Button>
          </div>
        </AdminCard>
      )}

      {step === 3 && (
        <AdminCard className="p-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            Bekreft og opprett intern pakke
          </h3>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            Den interne pakken kan redigeres fritt og oppdateres uavhengig av system-pakken.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Navn på ny pakke
                </div>
                <StandardInput
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-[#1a3d32] focus:bg-white"
                />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Inkluderte maler ({selectedIds.length})
                </div>
                <ul className="mt-1 divide-y divide-neutral-100 rounded-md border border-neutral-200/80">
                  {templates
                    .filter((t) => selected[t.id])
                    .map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-2 px-3 py-2 text-xs"
                      >
                        <Check className="h-3 w-3 text-green-600" aria-hidden="true" />
                        <span className="rounded bg-neutral-100 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-neutral-700">
                          {t.moduleLabel}
                        </span>
                        <span className="font-medium text-neutral-900">{t.name}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
            <aside className="rounded-md border border-neutral-200/80 bg-[#fbf9f3] p-3 text-[11px] text-neutral-700">
              <div className="font-semibold text-neutral-900">Det skjer når du oppretter:</div>
              <ul className="mt-1.5 space-y-1">
                <li className="flex items-start gap-1.5">
                  <Copy className="mt-0.5 h-3 w-3 text-[#1a3d32]" aria-hidden="true" />
                  <span>Hver mal kopieres med originalt innhold</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <GitBranch className="mt-0.5 h-3 w-3 text-[#1a3d32]" aria-hidden="true" />
                  <span>Lovverk-referanser beholdes</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3 w-3 text-[#1a3d32]" aria-hidden="true" />
                  <span>Du varsles ved system-oppdateringer</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <FileStack className="mt-0.5 h-3 w-3 text-[#1a3d32]" aria-hidden="true" />
                  <span>Versjonering starter på 1.0</span>
                </li>
              </ul>
            </aside>
          </div>

          {createResult && (
            <div
              className={
                'mt-4 flex items-start gap-2 rounded-md border p-3 text-[12px] ' +
                (createResult.error
                  ? 'border-red-200 bg-red-50/60'
                  : 'border-green-200 bg-green-50/60')
              }
            >
              {createResult.error ? (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
              ) : (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700" aria-hidden="true" />
              )}
              <div className={createResult.error ? 'text-red-900' : 'text-green-900'}>
                {createResult.error
                  ? createResult.error
                  : `Opprettet ${createResult.copied} mal${createResult.copied === 1 ? '' : 'er'}` +
                    (createResult.skipped > 0
                      ? ` · hoppet over ${createResult.skipped} (kun sjekkliste-maler kopieres i denne wizarden)`
                      : '')}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-3 w-3" />}
              onClick={() => setStep(2)}
            >
              Tilbake
            </Button>
            {createResult && !createResult.error ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Check className="h-3 w-3" />}
                onClick={onBack}
              >
                Ferdig — se pakken
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                disabled={creating || selectedIds.length === 0}
                icon={
                  creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />
                }
                onClick={() => void submit()}
              >
                Opprett intern pakke
              </Button>
            )}
          </div>
        </AdminCard>
      )}
    </div>
  )
}

// Small utility used inside this section only.
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ' +
        (active
          ? 'bg-[#1a3d32] text-white hover:bg-[#143028] hover:text-white'
          : 'border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-700')
      }
    >
      {label}
    </Button>
  )
}

