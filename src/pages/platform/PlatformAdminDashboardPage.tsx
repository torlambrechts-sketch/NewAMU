import { useMemo, useState } from 'react'
import { Building2, Users } from 'lucide-react'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'

function formatMoney(cents: number, currency: string) {
  const v = cents / 100
  try {
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: currency === 'NOK' ? 'NOK' : currency }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency}`
  }
}

export function PlatformAdminDashboardPage() {
  const { dashboard, error, setError, upsertBilling, refreshSession } = usePlatformAdmin()
  const [editOrgId, setEditOrgId] = useState<string | null>(null)
  const [monthlyKr, setMonthlyKr] = useState('')
  const [plan, setPlan] = useState('standard')
  const [currency, setCurrency] = useState('NOK')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const totals = dashboard?.totals

  const selectedOrg = useMemo(
    () => dashboard?.organizations.find((o) => o.id === editOrgId) ?? null,
    [dashboard?.organizations, editOrgId],
  )

  function openEdit(orgId: string) {
    setEditOrgId(orgId)
    const o = dashboard?.organizations.find((x) => x.id === orgId)
    if (o) {
      setMonthlyKr((o.monthly_amount_cents / 100).toFixed(0))
      setPlan(o.plan)
      setCurrency(o.currency)
      setNotes('')
    }
    setError(null)
  }

  async function saveBilling() {
    if (!editOrgId) return
    const kr = Number(monthlyKr.replace(',', '.'))
    if (Number.isNaN(kr) || kr < 0) {
      setError('Skriv inn et gyldig beløp (kr).')
      return
    }
    setSaving(true)
    setError(null)
    const cents = Math.round(kr * 100)
    const r = await upsertBilling({
      organizationId: editOrgId,
      monthlyAmountCents: cents,
      plan,
      currency,
      notes: notes || undefined,
    })
    setSaving(false)
    if (r.ok) {
      setEditOrgId(null)
      await refreshSession()
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Tenants</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Organisasjoner registrert i databasen. Månedlig beløp er manuelt (kan kobles til Stripe senere).
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {totals && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <Building2 className="size-4" /> Organisasjoner
            </div>
            <p className="mt-2 text-3xl font-semibold text-white">{totals.organization_count}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <Users className="size-4" /> Profiler (med org)
            </div>
            <p className="mt-2 text-3xl font-semibold text-white">{totals.profile_count}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Sum fakturagrunnlag / mnd</div>
            <p className="mt-2 text-3xl font-semibold text-amber-400">
              {formatMoney(totals.monthly_billing_cents, 'NOK')}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Summert fra organization_billing</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3">Navn</th>
              <th className="px-4 py-3">Org.nr</th>
              <th className="px-4 py-3">Medlemmer</th>
              <th className="px-4 py-3">Onboarding</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Mnd (eks. MVA)</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(dashboard?.organizations ?? []).map((o) => (
              <tr key={o.id} className="border-b border-white/5 text-neutral-200">
                <td className="px-4 py-3 font-medium text-white">{o.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{o.organization_number}</td>
                <td className="px-4 py-3">{o.member_count}</td>
                <td className="px-4 py-3 text-xs">
                  {o.onboarding_completed_at
                    ? new Date(o.onboarding_completed_at).toLocaleDateString('nb-NO')
                    : '—'}
                </td>
                <td className="px-4 py-3">{o.plan}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(o.monthly_amount_cents, o.currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(o.id)}
                    className="text-amber-400/90 hover:underline"
                  >
                    Fakturering
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrg && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="text-lg font-semibold text-white">Rediger fakturering — {selectedOrg.name}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs text-neutral-400">
              Beløp per måned (kr)
              <input
                type="text"
                value={monthlyKr}
                onChange={(e) => setMonthlyKr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-xs text-neutral-400">
              Plan
              <input
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-xs text-neutral-400">
              Valuta
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-xs text-neutral-400 sm:col-span-2 lg:col-span-1">
              Notat (valgfritt)
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveBilling()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
            >
              Lagre
            </button>
            <button
              type="button"
              onClick={() => setEditOrgId(null)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
