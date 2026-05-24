// Klarert Admin — sentralt kontrollpanel for organisasjon, brukere,
// roller, mal-pakker, arbeidsflyt, integrasjoner og audit-logg.
//
// Erstatter den gamle scope-baserte AdminSettingsPage. URL-form:
//   /admin/settings                  → organisasjon (default)
//   /admin/settings/<seksjon>         → seksjonen
//   /admin/settings/<seksjon>/<rute>  → spesialrute innen seksjonen
//
// Layout: ModulePageShell-ramme + 220px sidebar (sticky) + content.

import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  Download,
  GitFork,
  History,
  KeyRound,
  Package,
  Plug,
  Users,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { ModulePageShell } from '../../../components/module'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
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
  AdminNavItem,
  AdminSectionId,
  RouteName,
} from './types'

const ADMIN_NAV: AdminNavItem[] = [
  { id: 'org', label: 'Organisasjon', icon: Building2 },
  { id: 'users', label: 'Brukere', icon: Users },
  { id: 'roles', label: 'Roller & tilganger', icon: KeyRound },
  { id: 'packs', label: 'Mal-pakker', icon: Package },
  { id: 'workflows', label: 'Arbeidsflyt', icon: GitFork },
  { id: 'integrations', label: 'Integrasjoner', icon: Plug },
  { id: 'audit', label: 'Audit-logg', icon: History },
]

const SECTION_IDS = new Set<AdminSectionId>(ADMIN_NAV.map((n) => n.id))

function isSectionId(value: string | undefined): value is AdminSectionId {
  return !!value && SECTION_IDS.has(value as AdminSectionId)
}

export function AdminPage() {
  const navigate = useNavigate()
  const params = useParams<{ scope?: string; section?: string }>()
  const { organization } = useOrgSetupContext()

  const sectionFromUrl: AdminSectionId = isSectionId(params.scope) ? params.scope : 'org'

  const [mode, setMode] = useState<AdminMode>('advanced')
  // Sub-routen er fullt avledet fra URL — ingen lokal state-sync.
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

  const activeNav = ADMIN_NAV.find((n) => n.id === sectionFromUrl) ?? ADMIN_NAV[0]

  const breadcrumb = useMemo(
    () => [
      { label: 'Hjem', to: '/app' },
      { label: 'Admin' },
      { label: activeNav.label },
    ],
    [activeNav.label],
  )

  return (
    <ModulePageShell
      breadcrumb={breadcrumb}
      title="Admin"
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* SIDEBAR */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ul className="py-1.5">
              {ADMIN_NAV.map((n) => {
                const active = n.id === sectionFromUrl
                const Icon = n.icon
                return (
                  <li key={n.id}>
                    <Button
                      variant="ghost"
                      onClick={() => setSection(n.id)}
                      className={
                        'flex w-full items-center justify-start gap-2.5 rounded-none border-transparent px-4 py-2 text-left text-sm transition-colors ' +
                        (active
                          ? 'bg-[#e7efe9] text-neutral-900 hover:bg-[#e7efe9]/80'
                          : 'text-neutral-700 hover:bg-neutral-50')
                      }
                      style={active ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon
                        className={
                          'h-3.5 w-3.5 shrink-0 ' +
                          (active ? 'text-[#1a3d32]' : 'text-neutral-500')
                        }
                        aria-hidden="true"
                      />
                      <span
                        className={
                          'min-w-0 flex-1 ' + (active ? 'font-semibold' : 'font-medium')
                        }
                      >
                        {n.label}
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>

          {!easy && organization ? (
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Compliance
              </h3>
              <ul className="mt-2 space-y-1.5 text-[11px]">
                {[
                  { label: 'AMU opprettet', met: true },
                  { label: 'BHT avtale', met: true },
                  { label: 'IK-rutine', met: true },
                  { label: 'IA-avtale', met: true },
                  { label: 'DPO oppnevnt', met: true },
                ].map((c) => (
                  <li key={c.label} className="flex items-center justify-between">
                    <span className="text-neutral-700">{c.label}</span>
                    <CheckCircle2
                      className={`h-3 w-3 ${
                        c.met ? 'text-green-600' : 'text-amber-600'
                      }`}
                      aria-label={c.met ? 'oppfylt' : 'mangler'}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        {/* CONTENT */}
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
