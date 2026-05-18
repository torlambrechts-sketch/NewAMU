// Partner org switcher — Studio Builder Phase 3 Task 3.2.
//
// Renders a dropdown listing every customer org the active
// partner_membership covers. Selection persists to localStorage via
// useStudioOrgContext (single source of truth for "which org are we
// writing to"). The studio's preset mutators read the same hook (or
// the matching resolveActiveOrgId() helper) so writes land in the
// right tenant.
//
// Visible only when the caller has at least one active
// partner_membership. Customer admins (single-org users) don't see
// the switcher.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../ui/Button'
import { usePartnerMembership } from '../../../hooks/usePartnerMembership'
import { useStudioOrgContext } from '../../../hooks/useStudioOrgContext'

export type PartnerOrgSwitcherProps = {
  /** Called after a successful switch. */
  onChange?: (customerOrgId: string | null) => void
}

export function PartnerOrgSwitcher({ onChange }: PartnerOrgSwitcherProps) {
  const { isPartnerMember, customers, loading, currentPartner } = usePartnerMembership()
  const { activeCustomerOrgId, setActiveCustomerOrgId } = useStudioOrgContext()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Click-outside / escape to close.
  useEffect(() => {
    if (!open) return
    function handlePointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointer)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('pointerdown', handlePointer)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const activeCustomer = useMemo(
    () => customers.find((c) => c.organization_id === activeCustomerOrgId) ?? null,
    [customers, activeCustomerOrgId],
  )

  const handleSelect = useCallback(
    async (orgId: string | null) => {
      const ok = await setActiveCustomerOrgId(orgId)
      if (!ok) return
      setOpen(false)
      onChange?.(orgId)
    },
    [onChange, setActiveCustomerOrgId],
  )

  if (!isPartnerMember || loading || customers.length === 0) return null

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {activeCustomer ? (
          <>
            <span className="text-neutral-500">Klient:</span>{' '}
            <span className="font-semibold">{activeCustomer.organization_name}</span>
          </>
        ) : (
          <span className="text-neutral-500">Velg klient</span>
        )}
        <span aria-hidden className="ml-1">▾</span>
      </Button>
      {open ? (
        <div
          role="listbox"
          aria-label="Velg klient-organisasjon"
          className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
        >
          {currentPartner ? (
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
              {currentPartner.name}
            </div>
          ) : null}
          <ul className="max-h-72 overflow-auto">
            <li role="option" aria-selected={activeCustomerOrgId === null}>
              <Button
                variant={activeCustomerOrgId === null ? 'primary' : 'ghost'}
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => handleSelect(null)}
              >
                Ingen klient (egen org)
              </Button>
            </li>
            {customers.map((c) => (
              <li key={c.organization_id} role="option" aria-selected={c.organization_id === activeCustomerOrgId}>
                <Button
                  variant={c.organization_id === activeCustomerOrgId ? 'primary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start font-normal"
                  onClick={() => handleSelect(c.organization_id)}
                >
                  <span className="truncate">{c.organization_name}</span>
                  {c.organization_number ? (
                    <span className="ml-2 text-[10px] text-neutral-500">{c.organization_number}</span>
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
