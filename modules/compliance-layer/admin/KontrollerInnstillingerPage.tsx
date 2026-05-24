// KontrollerInnstillingerPage — admin landing for /controls/admin.
//
// Lets admins create new controls and pin existing ones to the sidebar.
// Edit + delete happen on the per-control detail page; this page is the
// catalog of org-defined controls + the "+ Ny kontroll" entry point.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { PageShell } from '../../../template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { ControlEditorPanel } from '../ControlEditorPanel'
import { useInternalControls } from '../useInternalControls'

export function KontrollerInnstillingerPage() {
  const { supabase } = useOrgSetupContext()
  const { controls, togglePinned, refresh, loading, error } =
    useInternalControls({ supabase })

  const [creating, setCreating] = useState(false)

  const ownControls = useMemo(
    () => controls.filter((c) => !c.is_system),
    [controls],
  )
  const systemControls = useMemo(
    () => controls.filter((c) => c.is_system),
    [controls],
  )

  return (
    <PageShell
      title="Kontroller — innstillinger"
      description="Forvalt egne kontroller og pin de viktigste til sidebaren."
      actions={
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          + Ny kontroll
        </Button>
      }
    >
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Laster…
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Egne kontroller ({ownControls.length})
        </h2>
        {ownControls.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
            Ingen egne kontroller ennå.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm">
            {ownControls.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="flex-1">
                  <Link
                    to={`/controls/${c.id}`}
                    className="font-medium text-amber-800 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-neutral-600">{c.purpose}</p>
                </div>
                <label className="flex items-center gap-1 text-xs">
                  <StandardInput
                    type="checkbox"
                    checked={c.nav_pinned}
                    onChange={(e) =>
                      void togglePinned(c.id, e.target.checked)
                    }
                    className="size-4"
                  />
                  Pin
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Systemkontroller ({systemControls.length})
        </h2>
        {systemControls.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
            Ingen systemkontroller — seeden har ikke kjørt.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm">
            {systemControls.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="flex-1">
                  <Link
                    to={`/controls/${c.id}`}
                    className="font-medium text-amber-800 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-neutral-600">{c.purpose}</p>
                </div>
                <label className="flex items-center gap-1 text-xs">
                  <StandardInput
                    type="checkbox"
                    checked={c.nav_pinned}
                    onChange={(e) =>
                      void togglePinned(c.id, e.target.checked)
                    }
                    className="size-4"
                  />
                  Pin
                </label>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                  system
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ControlEditorPanel
        open={creating}
        mode="create"
        onClose={() => setCreating(false)}
        onSaved={async () => {
          setCreating(false)
          await refresh()
        }}
      />
    </PageShell>
  )
}
