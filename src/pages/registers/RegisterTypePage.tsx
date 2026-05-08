// /registers/:typeId — list of records for one register type.
// Displays a flat table where the columns are the type's first ~5
// metadata_schema fields. Click a row → SlidePanel editor.

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisters, useRegisterRecords } from '../../hooks/useRegisters'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { RegisterRecordForm } from '../../components/registers/RegisterRecordForm'
import type { RegisterField, RegisterRecord } from '../../types/registers'

export function RegisterTypePage() {
  const { typeId } = useParams<{ typeId: string }>()
  const orgSetup = useOrgSetupContext()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const recordsHook = useRegisterRecords({
    supabase: orgSetup.supabase,
    typeId: typeId ?? null,
  })

  const type = useMemo(
    () => registers.types.find((t) => t.id === typeId) ?? null,
    [registers.types, typeId],
  )
  const [editing, setEditing] = useState<{ kind: 'new' } | { kind: 'edit'; record: RegisterRecord } | null>(null)

  if (registers.loading && !type) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Register', to: '/registers' }]}
        title="Laster register …"
      >
        <p className="text-sm text-neutral-500">Henter registertype …</p>
      </ModulePageShell>
    )
  }

  if (!type) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Register', to: '/registers' }]}
        title="Register ikke funnet"
        headerActions={
          <Link
            to="/registers"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
        }
      >
        <ModuleSectionCard className="p-6">
          <WarningBox>
            Fant ikke registeret «{typeId}». Det kan være deaktivert for organisasjonen
            din eller slettet.
          </WarningBox>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  // Use the first 5 schema fields as columns; the editor SlidePanel
  // shows the full set.
  const columnFields: RegisterField[] = type.metadataSchema.fields.slice(0, 5)

  return (
    <>
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
          { label: type.resolvedName },
        ]}
        title={type.resolvedName}
        description={type.description ?? undefined}
        headerActions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setEditing({ kind: 'new' })}
            >
              Ny rad
            </Button>
            <Link
              to="/registers"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
          </div>
        }
      >
        {recordsHook.error ? <WarningBox>{recordsHook.error}</WarningBox> : null}

        <ModuleSectionCard className="p-0">
          <div className="border-b border-neutral-200/80 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Rader
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {recordsHook.records.length} {recordsHook.records.length === 1 ? 'rad' : 'rader'}{' '}
              {type.regulationIds.length > 0 ? (
                <>
                  · Hjemler:{' '}
                  {type.regulationIds.map((r) => (
                    <Badge key={r} variant="info" className="mr-1 ml-0.5">
                      {r.toUpperCase()}
                    </Badge>
                  ))}
                </>
              ) : null}
            </p>
          </div>
          {recordsHook.loading && recordsHook.records.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">Laster …</p>
          ) : recordsHook.records.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">
              Ingen rader ennå. Bruk «Ny rad» for å starte.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-neutral-50/60">
                  <tr className="border-b border-neutral-200">
                    {columnFields.map((f) => (
                      <th
                        key={f.key}
                        className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600"
                      >
                        {f.label}
                      </th>
                    ))}
                    <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recordsHook.records.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setEditing({ kind: 'edit', record: r })}
                      className="cursor-pointer border-b border-neutral-100 transition-colors hover:bg-neutral-50"
                    >
                      {columnFields.map((f) => (
                        <td key={f.key} className="px-5 py-2.5 text-sm text-neutral-800">
                          {renderCell(r.values[f.key], f)}
                        </td>
                      ))}
                      <td className="px-5 py-2.5 text-sm">
                        <Badge
                          variant={
                            r.status === 'active'
                              ? 'active'
                              : r.status === 'archived'
                                ? 'neutral'
                                : 'draft'
                          }
                        >
                          {r.status === 'active'
                            ? 'Aktiv'
                            : r.status === 'archived'
                              ? 'Arkivert'
                              : 'Utkast'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModuleSectionCard>
      </ModulePageShell>

      {editing ? (
        <RegisterRecordForm
          open
          type={type}
          record={editing.kind === 'edit' ? editing.record : null}
          onClose={() => setEditing(null)}
          onSubmit={async ({ values, status, reviewDueAt }) => {
            if (editing.kind === 'new') {
              await recordsHook.createRecord(values)
              // status + review_due_at default — upsert via update if needed
              return true
            } else {
              await recordsHook.updateRecord(editing.record.id, {
                values,
                status,
                reviewDueAt,
              })
              return true
            }
          }}
          onDelete={async (record) => {
            await recordsHook.softDeleteRecord(record.id)
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}

function renderCell(value: unknown, field: RegisterField): string {
  if (value == null) return '—'
  if (field.kind === 'boolean') return value ? 'Ja' : 'Nei'
  if (field.kind === 'select' && Array.isArray(field.options)) {
    const opt = field.options.find((o) => o.value === value)
    return opt?.label ?? String(value)
  }
  if (field.kind === 'select_multi' && Array.isArray(value)) {
    const ids = (value as unknown[]).filter((x): x is string => typeof x === 'string')
    if (field.options) {
      const labels = ids.map((id) => field.options?.find((o) => o.value === id)?.label ?? id)
      return labels.length === 0
        ? '—'
        : labels.length <= 2
          ? labels.join(', ')
          : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
    }
    return ids.join(', ')
  }
  return String(value)
}
