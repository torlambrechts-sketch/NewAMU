import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Briefcase,
  ClipboardList,
  FileText,
  GraduationCap,
  HardHat,
  HeartPulse,
  LayoutGrid,
  Megaphone,
  Search,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { HubMenu1Bar } from '../components/layout/HubMenu1Bar'
import { LayoutTable1PostingsShell } from '../components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../components/layout/layoutTable1PostingsKit'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'

// ── Known modules (static registry) ─────────────────────────────────────────

type KnownModule = {
  slug: string
  label: string
  description: string
  icon: LucideIcon
}

const KNOWN_MODULES: KnownModule[] = [
  { slug: 'hse', label: 'HMS & Vernerunder', description: 'Helse, miljø og sikkerhet etter AML og IK-forskriften', icon: HardHat },
  { slug: 'inspection', label: 'Inspeksjonsrunder', description: 'Systematiske vernerunder med digitale sjekklister', icon: ClipboardList },
  { slug: 'internal-control', label: 'Internkontroll', description: 'Risikostyring og IK-dokumentasjon', icon: ShieldCheck },
  { slug: 'council', label: 'AMU / Arbeidsmiljøutvalg', description: 'Møtereferat, vedtak og representanter', icon: UsersRound },
  { slug: 'members', label: 'Medlemmer', description: 'Ansatte og organisasjonsmedlemmer', icon: Users },
  { slug: 'org-health', label: 'Org Health', description: 'Medarbeidertilfredshet og pulsundersøkelser', icon: HeartPulse },
  { slug: 'tasks', label: 'Oppgaver', description: 'Oppgavebehandling og avvikshåndtering', icon: LayoutGrid },
  { slug: 'workflow', label: 'Arbeidsflyt', description: 'Automatiserte prosessflyter og godkjenninger', icon: Workflow },
  { slug: 'learning', label: 'E-læring', description: 'Kurs, opplæring og sertifikater', icon: GraduationCap },
  { slug: 'documents', label: 'Dokumenter', description: 'Dokumentbibliotek og wiki', icon: FileText },
  { slug: 'hr', label: 'HR & Jus', description: 'HR-compliance og rettslig dokumentasjon', icon: Briefcase },
  { slug: 'workplace_reporting', label: 'Varsling', description: 'Varsler og intern rapportering', icon: Megaphone },
]

// ── Types ────────────────────────────────────────────────────────────────────

type ModuleRow = {
  id: string
  slug: string
  display_name: string
  is_active: boolean
}

type AccessLevel = 'inherit' | 'none' | 'read' | 'write'

type UserAccessRow = {
  id: string
  user_id: string
  module_slug: string
  access_level: AccessLevel
}

type UserProfile = {
  id: string
  display_name: string | null
  email: string | null
}

const ACCESS_LABEL: Record<AccessLevel, string> = {
  inherit: 'Standard',
  none: 'Ingen tilgang',
  read: 'Lesetilgang',
  write: 'Skrivetilgang',
}

const ACCESS_COLOR: Record<AccessLevel, string> = {
  inherit: 'bg-neutral-100 text-neutral-600',
  none: 'bg-red-100 text-red-700',
  read: 'bg-blue-100 text-blue-700',
  write: 'bg-green-100 text-green-700',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ModuleAdminPage() {
  const { supabase } = useOrgSetupContext()
  const [tab, setTab] = useState<'modules' | 'access'>('modules')

  const [moduleRows, setModuleRows] = useState<ModuleRow[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [userAccess, setUserAccess] = useState<UserAccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [toggling, setToggling] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const errors: string[] = []

    const [modsRes, usersRes, accessRes] = await Promise.all([
      supabase.from('modules').select('id, slug, display_name, is_active').order('display_name'),
      supabase.from('profiles').select('id, display_name, email').order('display_name'),
      supabase.from('module_user_access').select('id, user_id, module_slug, access_level'),
    ])

    if (modsRes.error) errors.push(`Moduler: ${modsRes.error.message}`)
    else setModuleRows((modsRes.data ?? []) as ModuleRow[])

    if (usersRes.error) errors.push(`Brukere: ${usersRes.error.message}`)
    else setUsers((usersRes.data ?? []) as UserProfile[])

    // module_user_access may not exist yet if migration hasn't run — silently ignore
    if (!accessRes.error) setUserAccess((accessRes.data ?? []) as UserAccessRow[])

    if (errors.length > 0) setError(errors.join(' · '))
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  // ── Module toggle ─────────────────────────────────────────────────────────

  async function toggleModule(mod: KnownModule) {
    if (!supabase) return
    const existing = moduleRows.find((r) => r.slug === mod.slug)
    const nextActive = existing ? !existing.is_active : false
    setToggling(mod.slug)
    try {
      if (existing) {
        const { error: err } = await supabase
          .from('modules')
          .update({ is_active: nextActive })
          .eq('id', existing.id)
        if (err) throw err
        setModuleRows((prev) =>
          prev.map((r) => (r.id === existing.id ? { ...r, is_active: nextActive } : r)),
        )
      } else {
        // Seed the row then disable it
        const { data, error: err } = await supabase
          .from('modules')
          .insert({ slug: mod.slug, display_name: mod.label, is_active: false })
          .select('id, slug, display_name, is_active')
          .single()
        if (err) throw err
        setModuleRows((prev) => [...prev, data as ModuleRow])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke oppdatere modul.')
    } finally {
      setToggling(null)
    }
  }

  // ── User access ───────────────────────────────────────────────────────────

  async function setAccess(userId: string, moduleSlug: string, level: AccessLevel) {
    if (!supabase) return
    const key = `${userId}:${moduleSlug}`
    setSaving(key)
    try {
      if (level === 'inherit') {
        // Remove override — delete row if exists
        await supabase
          .from('module_user_access')
          .delete()
          .eq('user_id', userId)
          .eq('module_slug', moduleSlug)
        setUserAccess((prev) =>
          prev.filter((r) => !(r.user_id === userId && r.module_slug === moduleSlug)),
        )
      } else {
        const { data, error: err } = await supabase
          .from('module_user_access')
          .upsert(
            { user_id: userId, module_slug: moduleSlug, access_level: level },
            { onConflict: 'organization_id,user_id,module_slug' },
          )
          .select('id, user_id, module_slug, access_level')
          .single()
        if (err) throw err
        setUserAccess((prev) => {
          const exists = prev.some((r) => r.user_id === userId && r.module_slug === moduleSlug)
          if (exists) {
            return prev.map((r) =>
              r.user_id === userId && r.module_slug === moduleSlug
                ? (data as UserAccessRow)
                : r,
            )
          }
          return [...prev, data as UserAccessRow]
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre tilgang.')
    } finally {
      setSaving(null)
    }
  }

  function accessFor(userId: string, moduleSlug: string): AccessLevel {
    return (
      (userAccess.find((r) => r.user_id === userId && r.module_slug === moduleSlug)
        ?.access_level as AccessLevel) ?? 'inherit'
    )
  }

  // ── Active module states ──────────────────────────────────────────────────

  const moduleActiveMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const r of moduleRows) map.set(r.slug, r.is_active)
    return map
  }, [moduleRows])

  function isActive(slug: string): boolean {
    if (!moduleActiveMap.has(slug)) return true // default active if no DB row
    return moduleActiveMap.get(slug) ?? true
  }

  // ── Users with any override ───────────────────────────────────────────────

  const usersWithOverrides = useMemo(() => {
    const ids = new Set(userAccess.map((r) => r.user_id))
    return users.filter((u) => ids.has(u.id))
  }, [users, userAccess])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.display_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    )
  }, [users, userSearch])

  const hubItems = [
    { key: 'modules', label: 'Moduler', icon: Boxes, active: tab === 'modules', onClick: () => setTab('modules') },
    { key: 'access', label: 'Tilganger', icon: Users, active: tab === 'access', onClick: () => setTab('access') },
  ]

  const activeCount = KNOWN_MODULES.filter((m) => isActive(m.slug)).length

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Konfigurasjon' }, { label: 'Moduler' }]}
        title="Moduloversikt"
        description={`${activeCount} av ${KNOWN_MODULES.length} moduler er aktive for denne organisasjonen.`}
        menu={<HubMenu1Bar ariaLabel="Moduloversikt" items={hubItems} />}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Tab: Moduler ─────────────────────────────────────────────────── */}
      {tab === 'modules' && (
        <LayoutTable1PostingsShell
          wrap
          title="Moduler"
          description="Slå moduler av og på for hele organisasjonen. Deaktiverte moduler forsvinner fra menyen."
          toolbar={null}
          footer={
            <span className="text-neutral-500">
              {activeCount} aktive · {KNOWN_MODULES.length - activeCount} deaktiverte
            </span>
          }
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Modul</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Beskrivelse</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                <th className={`w-32 ${LAYOUT_TABLE1_POSTINGS_TH}`}>Handling</th>
              </tr>
            </thead>
            <tbody>
              {KNOWN_MODULES.map((mod) => {
                const Icon = mod.icon
                const active = isActive(mod.slug)
                const busy = toggling === mod.slug
                return (
                  <tr key={mod.slug} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: active ? '#f0f4f2' : '#f5f5f5' }}
                        >
                          <Icon
                            className="size-4"
                            style={{ color: active ? '#1a3d32' : '#a3a3a3' }}
                            aria-hidden
                          />
                        </span>
                        <div>
                          <p className="font-medium text-neutral-900">{mod.label}</p>
                          <p className="text-xs text-neutral-400">{mod.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-neutral-600">{mod.description}</td>
                    <td className="px-5 py-3">
                      {loading ? (
                        <span className="inline-block h-5 w-16 animate-pulse rounded bg-neutral-200" />
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        disabled={busy || loading}
                        onClick={() => void toggleModule(mod)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          active
                            ? 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                            : 'border-transparent text-white hover:opacity-90'
                        }`}
                        style={active ? {} : { backgroundColor: '#1a3d32' }}
                      >
                        {busy ? 'Lagrer…' : active ? 'Deaktiver' : 'Aktiver'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </LayoutTable1PostingsShell>
      )}

      {/* ── Tab: Tilganger ───────────────────────────────────────────────── */}
      {tab === 'access' && (
        <LayoutTable1PostingsShell
          wrap
          title="Brukertilganger"
          description="Angi tilgangsnivå per bruker for hvert modul. Standard arver brukerens rollebaserte rettigheter."
          toolbar={
            <div className="relative min-w-[220px] flex-1">
              <label className="sr-only" htmlFor="user-search">Søk bruker</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                id="user-search"
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Søk etter navn eller e-post…"
                className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
              />
            </div>
          }
          footer={
            <span className="text-neutral-500">
              {filteredUsers.length} brukere · {usersWithOverrides.length} med tilgangsoverrides
            </span>
          }
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Bruker</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Overrides</th>
                <th className={`w-28 ${LAYOUT_TABLE1_POSTINGS_TH}`}>Handling</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const overrides = userAccess.filter((r) => r.user_id === user.id)
                const isExpanded = expandedUser === user.id
                return (
                  <>
                    <tr key={user.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-neutral-900">
                          {user.display_name ?? '(Ukjent)'}
                        </p>
                        <p className="text-xs text-neutral-400">{user.email ?? ''}</p>
                      </td>
                      <td className="px-5 py-3">
                        {overrides.length === 0 ? (
                          <span className="text-xs text-neutral-400">Ingen overrides</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {overrides.map((r) => {
                              const modLabel =
                                KNOWN_MODULES.find((m) => m.slug === r.module_slug)?.label ??
                                r.module_slug
                              return (
                                <span
                                  key={r.module_slug}
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACCESS_COLOR[r.access_level as AccessLevel]}`}
                                >
                                  {modLabel}: {ACCESS_LABEL[r.access_level as AccessLevel]}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedUser(isExpanded ? null : user.id)
                          }
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          {isExpanded ? 'Lukk' : 'Rediger'}
                        </button>
                      </td>
                    </tr>

                    {/* ── Inline access editor ──────────────────────────── */}
                    {isExpanded && (
                      <tr key={`${user.id}-edit`}>
                        <td colSpan={3} className="bg-neutral-50 px-5 py-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Tilganger for {user.display_name ?? 'bruker'}
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {KNOWN_MODULES.map((mod) => {
                              const Icon = mod.icon
                              const level = accessFor(user.id, mod.slug)
                              const busy = saving === `${user.id}:${mod.slug}`
                              return (
                                <label
                                  key={mod.slug}
                                  className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
                                >
                                  <Icon className="size-4 shrink-0 text-neutral-400" aria-hidden />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-neutral-700 truncate">
                                      {mod.label}
                                    </p>
                                    <select
                                      value={level}
                                      disabled={busy}
                                      onChange={(e) =>
                                        void setAccess(
                                          user.id,
                                          mod.slug,
                                          e.target.value as AccessLevel,
                                        )
                                      }
                                      className="mt-0.5 w-full rounded border border-neutral-200 bg-transparent py-0.5 text-xs text-neutral-600 focus:outline-none"
                                    >
                                      {(Object.keys(ACCESS_LABEL) as AccessLevel[]).map(
                                        (lvl) => (
                                          <option key={lvl} value={lvl}>
                                            {ACCESS_LABEL[lvl]}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </div>
                                  {busy && (
                                    <span className="text-xs text-neutral-400">…</span>
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-sm text-neutral-500"
                  >
                    {loading ? 'Laster brukere…' : 'Ingen brukere funnet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </LayoutTable1PostingsShell>
      )}
    </div>
  )
}
