// AlertsBulkOpsPage — bulk reassign / recategorise. The page expects a
// case-ids list passed via router state from AlertsAllePage's multi-select.

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

type BulkState = {
  caseIds?: string[]
}

export default function AlertsBulkOpsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { supabase } = useOrgSetupContext()
  const state = (location.state ?? {}) as BulkState
  const caseIds = state.caseIds ?? []
  const [mode, setMode] = useState<'reassign' | 'recategorise'>('reassign')
  const [newHandler, setNewHandler] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!supabase) return
    void supabase
      .from('alert_template_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('position')
      .then((res) => {
        setCategories((res.data ?? []) as Array<{ id: string; name: string }>)
      })
  }, [supabase])

  async function execute() {
    if (!supabase || caseIds.length === 0) return
    setBusy(true)
    setError(null)
    if (mode === 'reassign') {
      const { data, error: rpcError } = await supabase.rpc('alerts_bulk_reassign', {
        p_case_ids: caseIds,
        p_new_handler_id: newHandler,
        p_reason: reason || null,
      })
      setBusy(false)
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setResult(typeof data === 'number' ? data : null)
    } else {
      const { data, error: rpcError } = await supabase.rpc('alerts_bulk_recategorise', {
        p_case_ids: caseIds,
        p_category_id: newCategory,
        p_reason: reason || null,
      })
      setBusy(false)
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setResult(typeof data === 'number' ? data : null)
    }
  }

  if (caseIds.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Bulk-handlinger</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Ingen saker valgt. Gå tilbake til{' '}
          <Link to="/alerts/alle" className="underline">
            saksliste
          </Link>{' '}
          og velg flere saker med avkryssingsboksene.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Bulk-handlinger</h1>
      <p className="mt-2 text-sm text-neutral-600">{caseIds.length} saker valgt.</p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('reassign')}
          className={`rounded px-3 py-1.5 text-sm ${mode === 'reassign' ? 'bg-neutral-900 text-white' : 'border border-neutral-300'}`}
        >
          Tildel på nytt
        </button>
        <button
          type="button"
          onClick={() => setMode('recategorise')}
          className={`rounded px-3 py-1.5 text-sm ${mode === 'recategorise' ? 'bg-neutral-900 text-white' : 'border border-neutral-300'}`}
        >
          Endre kategori
        </button>
      </div>

      <div className="mt-6 max-w-md space-y-3 rounded border border-neutral-200 bg-white p-4">
        {mode === 'reassign' ? (
          <label className="block text-sm">
            <span className="font-semibold">Ny saksbehandler (user id)</span>
            <input
              type="text"
              value={newHandler}
              onChange={(e) => setNewHandler(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
            />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="font-semibold">Ny kategori</span>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
            >
              <option value="">— velg —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="font-semibold">Begrunnelse</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        {error && <p className="text-xs text-red-700">{error}</p>}
        {result !== null && (
          <p className="text-xs text-emerald-700">{result} saker oppdatert.</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void execute()}
            disabled={
              busy ||
              (mode === 'reassign' && !newHandler) ||
              (mode === 'recategorise' && !newCategory)
            }
            className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Utfører…' : 'Utfør'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/alerts/alle')}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            Tilbake
          </button>
        </div>
      </div>
    </div>
  )
}
