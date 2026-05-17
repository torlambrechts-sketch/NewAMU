// Partner Console v0 — top-bar org switcher.
//
// Why: HMS-konsulenter manage 15–40 customer orgs and need a fast way
// to jump between them without losing session state. The switcher is
// the surface that turns "I am consultant X working for partner firm Y"
// into "I am currently viewing customer org Z" — and triggers the
// consultant-clock side effect (auto_session entry in
// partner_time_entries) so every minute spent in a customer org
// becomes billable evidence.
//
// Implementation: lists every organization the caller is a member of
// — both the org on profiles.organization_id and any customer orgs
// reachable through partner_memberships. Selecting an org writes the
// new id to profiles.organization_id (the existing "current org"
// mechanism — useOrgSetup reads from there on session sync). The page
// reloads to re-run all org-scoped queries; reload is heavy-handed
// but reliable in v0 (a finer-grained refresh would require teaching
// every hook to react to org changes — out of scope).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Search, Briefcase } from 'lucide-react'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { usePartnerMembership } from '../../hooks/usePartnerMembership'

type SwitchTarget = {
  org_id: string
  name: string
  organization_number: string | null
  /** True when the caller reaches this org via a partner_memberships row. */
  isPartnerSource: boolean
  /** Caller's role inside the partner firm (consultant/manager/admin), if any. */
  partnerRole?: string | null
}

export function OrgSwitcher({ variant = 'topbar' }: { variant?: 'topbar' | 'sidebar' }) {
  const { supabase, user, organization } = useOrgSetupContext()
  const { customers, currentPartner, memberships } = usePartnerMembership()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [switching, setSwitching] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Global Cmd+K / Ctrl+K — toggles the switcher and focuses the search field.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (!isCmdK) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      const trg = e.target as Node
      if (triggerRef.current?.contains(trg)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery('')
    }
  }, [open])

  const targets = useMemo<SwitchTarget[]>(() => {
    const byId = new Map<string, SwitchTarget>()

    // Customer orgs reachable via partner_memberships.
    for (const c of customers) {
      byId.set(c.organization_id, {
        org_id: c.organization_id,
        name: c.organization_name,
        organization_number: c.organization_number,
        isPartnerSource: true,
        partnerRole: c.role,
      })
    }

    // Current home org — only added if not already represented through
    // partner memberships. The home org name comes from the organization
    // row we already have in context.
    if (organization && !byId.has(organization.id)) {
      byId.set(organization.id, {
        org_id: organization.id,
        name: organization.name,
        organization_number: organization.organization_number,
        isPartnerSource: memberships.some((m) => m.organization_id === organization.id),
      })
    }

    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'nb'),
    )
  }, [customers, organization, memberships])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return targets
    return targets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.organization_number ?? '').includes(q),
    )
  }, [targets, query])

  const handleSwitch = useCallback(
    async (target: SwitchTarget) => {
      if (!supabase || !user) return
      if (target.org_id === organization?.id) {
        setOpen(false)
        return
      }
      setSwitching(target.org_id)

      // Best-effort: close any open auto_session for the *current* org
      // (the consultant-clock unmount in OrgSetupProvider also runs on
      // hard reload). Done first so the audit trail is clean. Look up
      // the real open entry first — the previous all-zero UUID fallback
      // was a no-op masquerading as a close.
      try {
        if (organization?.id) {
          const { data: openEntry } = await supabase
            .from('partner_time_entries')
            .select('id')
            .eq('user_id', user.id)
            .eq('organization_id', organization.id)
            .eq('source', 'auto_session')
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (openEntry?.id) {
            await supabase.rpc('partner_end_time_entry', {
              p_entry_id: openEntry.id,
            })
          }
        }
      } catch {
        /* best-effort — server-side sweeper will eventually close it */
      }

      const { error } = await supabase
        .from('profiles')
        .update({ organization_id: target.org_id })
        .eq('id', user.id)

      if (error) {
        console.warn('OrgSwitcher: failed to switch org', error.message)
        setSwitching(null)
        return
      }
      // Reload so every org-scoped query re-runs cleanly. The auto-clock
      // hook in the partner module will then start a new auto_session
      // row for the new (customer) org on first render.
      window.location.assign(window.location.pathname + window.location.search)
    },
    [supabase, user, organization?.id],
  )

  const triggerLabel = organization?.name ?? 'Velg organisasjon'
  const triggerIsPartner = useMemo(
    () =>
      organization
        ? memberships.some(
            (m) => m.organization_id === organization.id && m.partner_id === (currentPartner?.id ?? ''),
          )
        : false,
    [organization, memberships, currentPartner],
  )

  return (
    <div className="relative" data-variant={variant}>
      <Button
        ref={triggerRef}
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Bytt organisasjon (Cmd+K)"
        title="Bytt organisasjon (Cmd+K / Ctrl+K)"
        className={
          variant === 'topbar'
            ? 'inline-flex max-w-[18rem] shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-sm font-medium text-white/90 hover:bg-white/15'
            : 'inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50'
        }
      >
        <Building2 className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="min-w-0 truncate">{triggerLabel}</span>
        {triggerIsPartner ? (
          <span
            className={
              variant === 'topbar'
                ? 'ml-1 inline-flex items-center gap-0.5 rounded-sm bg-[#c2410c] px-1 py-px text-[10px] font-bold uppercase tracking-wide text-white'
                : 'ml-1 inline-flex items-center gap-0.5 rounded-sm bg-amber-200 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-amber-900'
            }
          >
            <Briefcase className="size-2.5" aria-hidden />
            Konsulent
          </span>
        ) : null}
        <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
      </Button>

      {open ? (
        <div
          role="listbox"
          aria-label="Organisasjoner"
          className="absolute left-0 z-50 mt-1 w-[min(92vw,22rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
            <Search className="size-4 text-neutral-500" aria-hidden />
            <StandardInput
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk organisasjon…"
              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-neutral-400 focus:ring-0"
            />
            <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-mono text-neutral-500">
              {navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </div>
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-neutral-500">
                Ingen treff.
              </div>
            ) : (
              filtered.map((t) => {
                const isCurrent = organization?.id === t.org_id
                const isSwitching = switching === t.org_id
                return (
                  <Button
                    key={t.org_id}
                    variant="ghost"
                    onClick={() => handleSwitch(t)}
                    disabled={isSwitching}
                    className={`flex h-auto w-full items-center justify-start gap-2 rounded-none px-3 py-2 text-left text-sm font-normal transition-colors ${
                      isCurrent
                        ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-100'
                        : 'hover:bg-neutral-50'
                    } disabled:opacity-60`}
                    role="option"
                    aria-selected={isCurrent}
                  >
                    <Building2 className="size-4 shrink-0 text-neutral-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-neutral-900">{t.name}</span>
                        {t.isPartnerSource ? (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-amber-100 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-amber-900">
                            <Briefcase className="size-2.5" aria-hidden />
                            Konsulent
                          </span>
                        ) : null}
                      </div>
                      {t.organization_number ? (
                        <div className="truncate text-xs text-neutral-500">
                          Orgnr. {t.organization_number}
                          {t.partnerRole ? ` · ${t.partnerRole}` : ''}
                        </div>
                      ) : null}
                    </div>
                    {isCurrent ? (
                      <Check className="size-4 shrink-0 text-[#1a3d32]" aria-hidden />
                    ) : null}
                  </Button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
