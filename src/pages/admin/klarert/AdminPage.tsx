// Klarert Admin — sentralt kontrollpanel for organisasjon, brukere,
// roller, mal-pakker, arbeidsflyt, integrasjoner og audit-logg.
//
// URL-form:
//   /admin/settings                  → organisasjon (default)
//   /admin/settings/<seksjon>         → seksjonen
//   /admin/settings/<seksjon>/<rute>  → spesialrute innen seksjonen
//
// Layout: ModulePageShell (full-width) + horisontal seksjons-tab-strip på
// toppen. Organisasjon / Brukere / Roller er samlet under en parent-
// tab «Brukere & roller»; den åpner en sekundær sub-tab-rad under den
// primære stripen. De øvrige (Mal-pakker, Arbeidsflyt, Integrasjoner,
// Audit-logg) er egne top-level-tabs.

import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Building2,
  Download,
  GitFork,
  History,
  KeyRound,
  Package,
  Plug,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { ModulePageShell } from '../../../components/module'
import { AdminModeToggle } from './AdminModeToggle'
import { SecOrg } from './SecOrg'
import { SecUsers } from './SecUsers'
import { SecRoles } from './SecRoles'
import { SecPacks } from './SecPacks'
import { SecWorkflows } from './SecWorkflows'
import { SecWorkflowEditor } from './SecWorkflowEditor'
import { SecIntegrations } from './SecIntegrations'
import { SecAudit } from './SecAudit'
import type {
  AdminMode,
  AdminSectionId,
  RouteName,
} from './types'

// ─── Nav structure ───────────────────────────────────────────────────────
//
// Top-level horizontal strip with 5 items. Organisasjon / Brukere / Roller
// are grouped under «Brukere & roller»; clicking the parent lands on
// /admin/settings/org (the first sub-tab). When the user is on any of
// the three sub-sections, the parent stays highlighted AND a smaller
// sub-tab row renders below the main strip so the user can flip between
// the three.

type AdminTopNavItem =
  | {
      kind: 'leaf'
      id: AdminSectionId
      label: string
      icon: LucideIcon
    }
  | {
      kind: 'grouped'
      parentId: 'personer' // virtuell — ikke en AdminSectionId
      label: string
      icon: LucideIcon
      /** Sub-tab id som skal aktiveres når man klikker parent. */
      defaultChild: AdminSectionId
      childIds: readonly AdminSectionId[]
      subTabs: readonly { id: AdminSectionId; label: string; icon: LucideIcon }[]
    }

const ADMIN_TOP_NAV: AdminTopNavItem[] = [
  {
    kind: 'grouped',
    parentId: 'personer',
    label: 'Brukere & roller',
    icon: Users,
    defaultChild: 'org',
    childIds: ['org', 'users', 'roles'],
    subTabs: [
      { id: 'org', label: 'Organisasjon', icon: Building2 },
      { id: 'users', label: 'Brukere', icon: Users },
      { id: 'roles', label: 'Roller', icon: KeyRound },
    ],
  },
  { kind: 'leaf', id: 'packs', label: 'Mal-pakker', icon: Package },
  { kind: 'leaf', id: 'workflows', label: 'Arbeidsflyt', icon: GitFork },
  { kind: 'leaf', id: 'integrations', label: 'Integrasjoner', icon: Plug },
  { kind: 'leaf', id: 'audit', label: 'Audit-logg', icon: History },
]

const SECTION_IDS = new Set<AdminSectionId>([
  'org', 'users', 'roles', 'packs', 'workflows', 'integrations', 'audit',
])

function isSectionId(value: string | undefined): value is AdminSectionId {
  return !!value && SECTION_IDS.has(value as AdminSectionId)
}

const SECTION_LABEL: Record<AdminSectionId, string> = {
  org: 'Organisasjon',
  users: 'Brukere',
  roles: 'Roller',
  packs: 'Mal-pakker',
  workflows: 'Arbeidsflyt',
  integrations: 'Integrasjoner',
  audit: 'Audit-logg',
}

export function AdminPage() {
  const navigate = useNavigate()
  const params = useParams<{ scope?: string; section?: string }>()

  const sectionFromUrl: AdminSectionId = isSectionId(params.scope) ? params.scope : 'org'

  const [mode, setMode] = useState<AdminMode>('advanced')
  const route = useMemo<RouteName>(
    () => decodeRoute(sectionFromUrl, params.section),
    [sectionFromUrl, params.section],
  )
  const easy = mode === 'easy'

  const setSection = useCallback(
    (next: AdminSectionId) => {
      navigate(`/admin/settings/${next}`)
    },
    [navigate],
  )

  const updateRoute = useCallback(
    (next: RouteName) => {
      navigate(routeToPath(sectionFromUrl, next))
    },
    [navigate, sectionFromUrl],
  )

  // The grouped item (if any) whose child is currently active — used
  // to decide whether to render the secondary sub-tab strip.
  const activeGroup = useMemo(() => {
    for (const item of ADMIN_TOP_NAV) {
      if (item.kind === 'grouped' && item.childIds.includes(sectionFromUrl)) {
        return item
      }
    }
    return null
  }, [sectionFromUrl])

  const breadcrumb = useMemo(
    () => [
      { label: 'Hjem', to: '/app' },
      { label: 'Administrasjon' },
      ...(activeGroup ? [{ label: activeGroup.label }] : []),
      { label: SECTION_LABEL[sectionFromUrl] },
    ],
    [activeGroup, sectionFromUrl],
  )

  return (
    <ModulePageShell
      breadcrumb={breadcrumb}
      width="full"
      title="Administrasjon"
      description={
        easy
          ? 'Organisasjon, brukere, integrasjoner og automatisering.'
          : 'Sentralt kontrollpanel — alle innstillinger som påvirker hele Klarert.'
      }
      headerActions={
        <>
          <AdminModeToggle mode={mode} onChange={setMode} />
          <Button variant="secondary" icon={<Download className="h-4 w-4" />}>
            Eksporter konfig
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Top-level horisontal nav — samme mønster som Internkontroll-
            seksjonsstripen. Parent-tabben aktiverer (highlight) når man
            er på noen av sub-section-IDene. */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <nav
            className="flex flex-wrap items-center gap-1 border-b border-neutral-100 px-3 py-2"
            aria-label="Administrasjon-seksjoner"
          >
            {ADMIN_TOP_NAV.map((item) => {
              const Icon = item.icon
              const active =
                item.kind === 'leaf'
                  ? item.id === sectionFromUrl
                  : item.childIds.includes(sectionFromUrl)
              const handleClick = () => {
                if (item.kind === 'leaf') setSection(item.id)
                else setSection(item.defaultChild)
              }
              return (
                <Button
                  key={item.kind === 'leaf' ? item.id : item.parentId}
                  variant="ghost"
                  onClick={handleClick}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'inline-flex h-auto items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? '!bg-[var(--ui-accent)] !text-white hover:!bg-[var(--ui-accent)] hover:!text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{item.label}</span>
                </Button>
              )
            })}
          </nav>

          {/* Sekundær sub-tab-rad — vises kun når man er inne på en
              gruppert section (Brukere & roller). Mindre piller, samme
              accent-stil men hvit bakgrunn istedenfor solid. */}
          {activeGroup ? (
            <nav
              className="flex flex-wrap items-center gap-1 px-3 py-2"
              aria-label={`${activeGroup.label} sub-seksjoner`}
            >
              {activeGroup.subTabs.map((sub) => {
                const SubIcon = sub.icon
                const subActive = sub.id === sectionFromUrl
                return (
                  <Button
                    key={sub.id}
                    variant="ghost"
                    onClick={() => setSection(sub.id)}
                    aria-current={subActive ? 'page' : undefined}
                    className={[
                      'inline-flex h-auto items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                      subActive
                        ? '!bg-[color-mix(in_srgb,var(--ui-accent)_12%,white)] !text-[var(--ui-accent)] !ring-1 !ring-[color-mix(in_srgb,var(--ui-accent)_30%,transparent)]'
                        : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800',
                    ].join(' ')}
                  >
                    <SubIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{sub.label}</span>
                  </Button>
                )
              })}
            </nav>
          ) : null}
        </div>

        {/* SECTION CONTENT — full-bredde uten sidebar. */}
        <section className="min-w-0">
          {sectionFromUrl === 'org' && <SecOrg easy={easy} />}
          {sectionFromUrl === 'users' && <SecUsers easy={easy} />}
          {sectionFromUrl === 'roles' && <SecRoles easy={easy} />}
          {sectionFromUrl === 'packs' && (
            <SecPacks easy={easy} route={route} setRoute={updateRoute} />
          )}
          {sectionFromUrl === 'workflows' &&
            (route.name === 'wf-edit' ? (
              <SecWorkflowEditor
                ruleId={route.ruleId}
                onBack={() => updateRoute({ name: 'list' })}
              />
            ) : (
              <SecWorkflows easy={easy} route={route} setRoute={updateRoute} />
            ))}
          {sectionFromUrl === 'integrations' && <SecIntegrations easy={easy} />}
          {sectionFromUrl === 'audit' && <SecAudit easy={easy} />}
        </section>
      </div>
    </ModulePageShell>
  )
}

// ── Sub-route URL encoding ─────────────────────────────────────────────
// Sub-routes live under /admin/settings/<section>/<segment>. The segment
// uses a small grammar prefixed by intent verb:
//   pack-<framework>            → pack detail
//   tilpass-<framework>         → tilpass wizard
//   edit-<framework>__<tplId>   → template editor (double-underscore
//                                  separator; component-encoded so IDs
//                                  with hyphens or slashes survive)
//   new                         → workflow editor (new rule)
//   edit-<ruleId>               → workflow editor (existing rule)

const TPL_SEPARATOR = '__'

function decodeRoute(
  section: AdminSectionId,
  routeSegment: string | undefined,
): RouteName {
  if (!routeSegment) return { name: 'list' }
  const decoded = safeDecode(routeSegment)
  if (section === 'packs') {
    if (decoded.startsWith('edit-')) {
      const rest = decoded.slice('edit-'.length)
      const sepAt = rest.indexOf(TPL_SEPARATOR)
      if (sepAt > 0) {
        return {
          name: 'pack-template-edit',
          packId: `pack-${safeDecode(rest.slice(0, sepAt))}`,
          templateId: safeDecode(rest.slice(sepAt + TPL_SEPARATOR.length)),
        }
      }
    }
    if (decoded.startsWith('tilpass-')) {
      return { name: 'pack-tilpass', packId: `pack-${safeDecode(decoded.slice('tilpass-'.length))}` }
    }
    if (decoded.startsWith('pack-')) {
      return { name: 'pack-detail', packId: `pack-${safeDecode(decoded.slice('pack-'.length))}` }
    }
  }
  if (section === 'workflows') {
    if (decoded === 'new') return { name: 'wf-edit', ruleId: 'new' }
    if (decoded.startsWith('edit-')) {
      return { name: 'wf-edit', ruleId: safeDecode(decoded.slice('edit-'.length)) }
    }
  }
  return { name: 'list' }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function routeToPath(section: AdminSectionId, route: RouteName): string {
  const base = `/admin/settings/${section}`
  const enc = (s: string) => encodeURIComponent(s)
  switch (route.name) {
    case 'list':
      return base
    case 'pack-detail':
      return `${base}/pack-${enc(route.packId.replace(/^pack-/, ''))}`
    case 'pack-template-edit':
      return `${base}/edit-${enc(route.packId.replace(/^pack-/, ''))}${TPL_SEPARATOR}${enc(route.templateId)}`
    case 'pack-tilpass':
      return `${base}/tilpass-${enc(route.packId.replace(/^pack-/, ''))}`
    case 'wf-edit':
      return route.ruleId === 'new' ? `${base}/new` : `${base}/edit-${enc(route.ruleId)}`
  }
}
