// /registers/:typeId/:recordId — drill-in to a single record.
//
// Mirrors the Klarert EntryDetail design: an article column with the
// record's primary heading, status badge row, and a 2-column field
// list of every value; plus a sidebar with register meta, sensitive-
// content callouts, and a per-record audit log.
//
// Special callouts:
//   - On `chemicals`: if the displayMetadata.cmrField is set and the
//     record flags it true, show the CMR / Eksponeringsregister card.
//   - On any record: if the register's display_metadata flags the
//     register as sensitive / gdpr, surface the access-banner.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  GitBranch,
  Lock,
  Pencil,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisters, useRegisterRecords } from '../../hooks/useRegisters'
import { useRegisterUiPreference } from '../../hooks/useUserUiPreferences'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { RegisterRecordForm } from '../../components/registers/RegisterRecordForm'
import { RegisterFrameworkPill } from '../../components/registers/RegisterFrameworkPill'
import { RegisterModeToggle } from '../../components/registers/RegisterModeToggle'
import { RegisterInitials } from '../../components/registers/RegisterInitials'
import {
  RegisterEntryCell,
  RegisterPersonCell,
} from '../../components/registers/RegisterEntryCell'
import {
  downloadRegisterCsv,
  exportRecordsToCsv,
} from '../../lib/registers/registerCsv'
import type { RegisterField } from '../../types/registers'

type RevisionRow = {
  id: string
  who: string
  what: string
  whenIso: string
}

const PERSON_FIELD_HINTS = new Set([
  'employee',
  'name',
  'navn',
  'owner',
  'eier',
  'responsible',
  'ansvarlig',
  'reportedBy',
  'reported_by',
  'meldt_av',
  'reporter',
])

export function RegisterEntryPage() {
  const { typeId, recordId } = useParams<{ typeId: string; recordId: string }>()
  const orgSetup = useOrgSetupContext()
  const navigate = useNavigate()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const recordsHook = useRegisterRecords({
    supabase: orgSetup.supabase,
    typeId: typeId ?? null,
  })
  const ui = useRegisterUiPreference()
  const easy = ui.mode === 'easy'
  const [editing, setEditing] = useState(false)
  const [revisions, setRevisions] = useState<RevisionRow[]>([])

  const type = useMemo(
    () => registers.types.find((t) => t.id === typeId) ?? null,
    [registers.types, typeId],
  )
  const record = useMemo(
    () => recordsHook.records.find((r) => r.id === recordId) ?? null,
    [recordsHook.records, recordId],
  )

  useEffect(() => {
    const supabase = orgSetup.supabase
    if (!supabase || !record) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('register_record_revisions')
        .select('id, changed_at, changed_by, values_before')
        .eq('record_id', record.id)
        .order('changed_at', { ascending: false })
        .limit(8)
      if (error || cancelled) return
      const actorIds = Array.from(
        new Set(
          (data ?? [])
            .map((r) => (r as { changed_by: string | null }).changed_by)
            .filter((x): x is string => typeof x === 'string'),
        ),
      )
      let actorById = new Map<string, string>()
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', actorIds)
        for (const p of (profiles ?? []) as { id: string; display_name: string }[]) {
          actorById.set(p.id, p.display_name)
        }
      }
      // Add an initial "opprettet" entry derived from record.created_at
      const created: RevisionRow[] = []
      if (record.createdAt) {
        const ownerName = record.ownerUserId
          ? actorById.get(record.ownerUserId) ?? 'Eier'
          : 'System'
        created.push({
          id: `${record.id}-create`,
          who: ownerName,
          what: 'opprettet raden',
          whenIso: record.createdAt,
        })
      }
      const edits: RevisionRow[] = (data ?? []).map((row) => {
        const r = row as { id: string; changed_at: string; changed_by: string | null; values_before: Record<string, unknown> }
        const isCreate = !r.values_before || Object.keys(r.values_before).length === 0
        const who = r.changed_by ? actorById.get(r.changed_by) ?? 'Bruker' : 'System'
        const what = isCreate ? 'opprettet' : 'oppdaterte feltene'
        return { id: r.id, who, what, whenIso: r.changed_at }
      })
      if (cancelled) return
      const merged = [...edits, ...created].sort((a, b) => b.whenIso.localeCompare(a.whenIso))
      setRevisions(merged.slice(0, 8))
    })()
    return () => {
      cancelled = true
    }
  }, [orgSetup, record])

  if (registers.loading && !type) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
        ]}
        title="Laster oppføring …"
        loading
      >
        <p />
      </ModulePageShell>
    )
  }

  if (!type) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
        ]}
        title="Register ikke funnet"
      >
        <WarningBox>
          Fant ikke registeret «{typeId}».{' '}
          <Link to="/registers" className="font-semibold underline">
            Tilbake til registre
          </Link>
        </WarningBox>
      </ModulePageShell>
    )
  }

  if (recordsHook.loading && !record) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
          { label: type.resolvedName, to: `/registers/${encodeURIComponent(type.id)}` },
        ]}
        title="Laster oppføring …"
        loading
      >
        <p />
      </ModulePageShell>
    )
  }

  if (!record) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
          { label: type.resolvedName, to: `/registers/${encodeURIComponent(type.id)}` },
        ]}
        title="Oppføring ikke funnet"
        headerActions={
          <Link
            to={`/registers/${encodeURIComponent(type.id)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
        }
      >
        <WarningBox>
          Fant ikke oppføring «{recordId}» i {type.resolvedName}.
        </WarningBox>
      </ModulePageShell>
    )
  }

  const display = type.displayMetadata
  const primaryField = pickPrimaryField(type.metadataSchema.fields)
  const primaryValue =
    (primaryField ? record.values[primaryField.key] : null) ?? record.id.slice(0, 8)
  const title = String(primaryValue)
  const cmrFlagged =
    display.cmrField &&
    record.values[display.cmrField] === true

  const handleExport = () => {
    downloadRegisterCsv(exportRecordsToCsv(type, [record]))
  }

  const handleDelete = async () => {
    if (!window.confirm('Slette denne oppføringen?')) return
    await recordsHook.softDeleteRecord(record.id)
    navigate(`/registers/${encodeURIComponent(type.id)}`)
  }

  return (
    <>
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
          { label: type.resolvedName, to: `/registers/${encodeURIComponent(type.id)}` },
          { label: truncate(title, 36) },
        ]}
        title={title}
        description={
          easy
            ? `${type.resolvedName} · #${record.id.slice(0, 8)}`
            : `Oppføring i ${type.resolvedName}. Vises i AMU-rapporter og inngår i lovpålagt dokumentasjon.`
        }
        headerActions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <RegisterModeToggle mode={ui.mode} onChange={(v) => void ui.setMode(v)} />
            <Button
              type="button"
              variant="secondary"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => setEditing(true)}
            >
              Rediger
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExport}
            >
              Eksporter
            </Button>
            <Button
              type="button"
              variant="ghost"
              icon={<Trash2 className="h-4 w-4" />}
              className="!text-red-700 hover:!bg-red-50"
              onClick={() => void handleDelete()}
            >
              Slett
            </Button>
            <Link
              to={`/registers/${encodeURIComponent(type.id)}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
          </div>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* MAIN — field list */}
          <article
            className="mx-auto w-full max-w-[760px] rounded-xl bg-white px-6 py-7 ring-1 ring-neutral-200/70 md:px-10 md:py-8"
            style={{
              fontFamily: "'Inter', sans-serif",
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div className="border-b border-neutral-100 pb-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">
                {type.resolvedName} · #{record.id.slice(0, 8)}
              </div>
              <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-neutral-900">
                {title}
              </h1>
            </div>

            {/* Status badges row */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <RegisterFrameworkPill regulationIds={type.regulationIds} />
              {type.metadataSchema.fields
                .filter((c) => c.kind === 'select' && record.values[c.key])
                .map((c) => (
                  <RegisterEntryCell key={c.key} field={c} record={record} detailMode />
                ))}
            </div>

            {/* All fields */}
            <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {type.metadataSchema.fields.map((c) => (
                <div
                  key={c.key}
                  className={[
                    'border-b border-neutral-100 pb-3',
                    c.kind === 'select_multi' || c.kind === 'text' ? 'sm:col-span-2' : '',
                  ].join(' ')}
                >
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    {c.label}
                    {c.hint ? (
                      <span className="ml-1 font-normal lowercase text-neutral-400">
                        — {c.hint}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="mt-1 text-sm text-neutral-900">
                    {isPersonField(c) ? (
                      <RegisterPersonCell value={record.values[c.key]} />
                    ) : (
                      <RegisterEntryCell field={c} record={record} detailMode />
                    )}
                  </dd>
                </div>
              ))}
              {/* Engine-level fields */}
              <div className="border-b border-neutral-100 pb-3">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Status
                </dt>
                <dd className="mt-1 text-sm text-neutral-900">
                  {labelStatus(record.status)}
                </dd>
              </div>
              <div className="border-b border-neutral-100 pb-3">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Neste gjennomgang
                </dt>
                <dd className="mt-1 text-sm text-neutral-900">
                  {record.reviewDueAt ? formatDate(record.reviewDueAt) : 'Ikke satt'}
                </dd>
              </div>
            </dl>

            {/* CMR callout for chemicals */}
            {cmrFlagged ? (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50/60 p-4">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-900">
                      CMR-stoff — krever Eksponeringsregister
                    </h3>
                    <p className="mt-0.5 text-[12px] text-red-800">
                      Dette stoffet er klassifisert som CMR (kreftfremkallende,
                      mutagent og/eller reproduksjonsskadelig). Alle eksponerte
                      arbeidstakere må registreres i et eksponeringsregister
                      (forskrift om utførelse av arbeid kap. 31).
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ArrowRight className="h-3 w-3" />}
                      className="mt-2 !text-red-900 hover:!bg-red-100"
                      type="button"
                      onClick={() => navigate('/registers')}
                    >
                      Gå til Registre
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Evidence-docs preview */}
            {record.evidenceDocRefs.length > 0 ? (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-[12px] text-amber-900">
                <div className="flex items-start gap-2">
                  <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <h3 className="font-semibold">Koblede dokumenter</h3>
                    <p className="mt-0.5">
                      Denne raden refererer til {record.evidenceDocRefs.length} dokument
                      {record.evidenceDocRefs.length === 1 ? '' : 'er'}.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </article>

          {/* SIDEBAR */}
          <aside className="space-y-3">
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-900">Register</h3>
              <ul className="mt-2 space-y-2 text-[12px]">
                <li className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Register</dt>
                  <dd className="text-right text-neutral-900">{type.resolvedName}</dd>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">Rammeverk</dt>
                  <dd>
                    <RegisterFrameworkPill regulationIds={type.regulationIds} />
                  </dd>
                </li>
                <li className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Eier</dt>
                  <dd className="text-right text-neutral-900">
                    {display.ownerRole ?? '—'}
                  </dd>
                </li>
                <li className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Lagringstid</dt>
                  <dd className="text-right text-neutral-900">
                    {display.retentionLabel ?? '—'}
                  </dd>
                </li>
              </ul>
            </div>

            {display.sensitive || display.gdpr ? (
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 text-[11px] text-purple-900">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-700" />
                  <div>
                    <div className="font-semibold">
                      {display.gdpr
                        ? 'GDPR — særlig kategori personopplysninger'
                        : 'Sensitiv informasjon'}
                    </div>
                    <div className="mt-0.5">
                      Tilgang loggføres. Alle visninger og endringer blir
                      liggende i revisjonsloggen.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {!easy ? (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Endringer på denne oppføringen
                </h3>
                <ol className="mt-2 space-y-2">
                  {revisions.length === 0 ? (
                    <li className="rounded border border-dashed border-neutral-200 px-3 py-3 text-center text-[11px] text-neutral-500">
                      Ingen endringer registrert.
                    </li>
                  ) : (
                    revisions.map((e) => (
                      <li key={e.id} className="flex items-start gap-2 text-[11px]">
                        <RegisterInitials name={e.who} size={18} />
                        <div className="min-w-0 flex-1">
                          <div>
                            <span className="font-semibold text-neutral-900">{e.who}</span>{' '}
                            <span className="text-neutral-500">{e.what}</span>
                          </div>
                          <div className="text-[10px] tabular-nums text-neutral-400">
                            {formatDateTime(e.whenIso)}
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ol>
              </div>
            ) : null}
          </aside>
        </div>
      </ModulePageShell>

      {editing ? (
        <RegisterRecordForm
          open
          type={type}
          record={record}
          onClose={() => setEditing(false)}
          onSubmit={async ({ values, status, reviewDueAt }) => {
            await recordsHook.updateRecord(record.id, {
              values,
              status,
              reviewDueAt,
            })
            return true
          }}
          onDelete={async () => {
            await recordsHook.softDeleteRecord(record.id)
            setEditing(false)
            navigate(`/registers/${encodeURIComponent(type.id)}`)
          }}
        />
      ) : null}
    </>
  )
}

function pickPrimaryField(fields: RegisterField[]): RegisterField | null {
  // First required text/select/date field wins; falls back to first field.
  for (const f of fields) {
    if (f.required && (f.kind === 'text' || f.kind === 'select' || f.kind === 'date')) {
      return f
    }
  }
  return fields[0] ?? null
}

function isPersonField(field: RegisterField): boolean {
  if (field.kind !== 'text') return false
  return PERSON_FIELD_HINTS.has(field.key.toLowerCase())
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

function formatDate(s: string): string {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`
}

function labelStatus(s: 'draft' | 'active' | 'archived'): string {
  if (s === 'active') return 'Aktiv'
  if (s === 'draft') return 'Utkast'
  return 'Arkivert'
}
