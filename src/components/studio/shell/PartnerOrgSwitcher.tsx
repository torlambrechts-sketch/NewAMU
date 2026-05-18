// Partner org switcher — Studio Builder Phase 3 Task 3.2.
//
// Renders a dropdown listing every customer org the active partner_membership
// covers. Selecting a customer narrows the studio's writes to that
// organization_id via the existing partner_resolve_active_partner GUC
// substrate (no new table — spec §3 reuse of partner_memberships).
//
// Visible only when the caller has at least one active partner_membership.
// Customer admins (single-org users) don't see the switcher.

import { useCallback, useMemo, useState } from 'react'
import { Button } from '../../ui/Button'
import { usePartnerMembership } from '../../../hooks/usePartnerMembership'

const ACTIVE_CUSTOMER_KEY = 'studio-active-customer-org-id'

function readActiveCustomerFromStorage(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CUSTOMER_KEY)
  } catch {
    return null
  }
}

function writeActiveCustomerToStorage(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_CUSTOMER_KEY, id)
    else localStorage.removeItem(ACTIVE_CUSTOMER_KEY)
  } catch {
    /* ignore */
  }
}

export type PartnerOrgSwitcherProps = {
  /** Called when the active customer changes. */
  onChange?: (customerOrgId: string | null) => void
}

export function PartnerOrgSwitcher({ onChange }: PartnerOrgSwitcherProps) {
  const { isPartnerMember, customers, loading, currentPartner } = usePartnerMembership()
  const [open, setOpen] = useState(false)
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(
    readActiveCustomerFromStorage,
  )

  const activeCustomer = useMemo(
    () => customers.find((c) => c.organization_id === activeCustomerId) ?? null,
    [customers, activeCustomerId],
  )

  const handleSelect = useCallback(
    (orgId: string | null) => {
      setActiveCustomerId(orgId)
      writeActiveCustomerToStorage(orgId)
      setOpen(false)
      onChange?.(orgId)
    },
    [onChange],
  )

  if (!isPartnerMember || loading || customers.length === 0) return null

  return (
    <div className="relative inline-block">
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
          className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
        >
          {currentPartner ? (
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
              {currentPartner.name}
            </div>
          ) : null}
          <ul className="max-h-72 overflow-auto">
            <li>
              <Button
                variant={activeCustomerId === null ? 'primary' : 'ghost'}
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => handleSelect(null)}
              >
                Ingen klient (egen org)
              </Button>
            </li>
            {customers.map((c) => (
              <li key={c.organization_id}>
                <Button
                  variant={c.organization_id === activeCustomerId ? 'primary' : 'ghost'}
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
