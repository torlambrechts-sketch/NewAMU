// Versjonshistorikk modal — source-aware. Reads from the per-source
// `<source>_template_versions` table written by the snapshot trigger.
// Each row carries a «Gjenopprett» button that calls the matching
// `restore_<source>_template_version` RPC. The restore itself fires
// the snapshot trigger again, so the restore event is captured in
// the history as a new row attributed to the restoring user.

import { useEffect, useState } from 'react'
import { Clock, Loader2, RotateCcw, X } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { AdminTemplateSource } from '../../hooks/useAdminTemplates'
import { ConfirmDialog } from './ConfirmDialog'

type VersionRow = {
  id: string
  snapshot: Record<string, unknown> | null
  changed_by: string | null
  created_at: string
}

const VERSIONS_TABLE: Record<AdminTemplateSource, string | null> = {
  compliance: 'compliance_template_versions',
  survey: 'survey_template_versions',
  documents: 'document_template_versions',
  learning: 'learning_template_versions',
  registers: 'register_template_versions',
  tasks: 'task_template_versions',
  meetings: 'meeting_template_versions',
  alerts: 'alert_template_versions',
  workflow: null, // catalog-only; no per-org versioning
}

const RESTORE_RPC: Record<AdminTemplateSource, string | null> = {
  compliance: 'restore_compliance_template_version',
  survey: 'restore_survey_template_version',
  documents: 'restore_document_template_version',
  learning: 'restore_learning_template_version',
  registers: 'restore_register_template_version',
  tasks: 'restore_task_template_version',
  meetings: 'restore_meeting_template_version',
  alerts: 'restore_alert_template_version',
  workflow: null,
}

const NAME_FIELD: Record<AdminTemplateSource, string> = {
  compliance: 'name',
  survey: 'name_override',
  documents: 'label',
  learning: 'title',
  registers: 'name',
  tasks: 'catalog_id', // tasks override has no name; catalog provides it
  meetings: 'name',
  alerts: 'name',
  workflow: 'name',
}

const DESC_FIELD: Record<AdminTemplateSource, string> = {
  compliance: 'description',
  survey: 'description_override',
  documents: 'description',
  learning: 'description',
  registers: 'description',
  tasks: 'description',
  meetings: 'description',
  alerts: 'description',
  workflow: 'description',
}

export function TemplateHistoryModal({
  source,
  templateId,
  templateName,
  onClose,
  onRestored,
}: {
  source: AdminTemplateSource
  templateId: string
  templateName: string
  onClose: () => void
  onRestored?: () => void
}) {
  const { supabase } = useOrgSetupContext()
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmVersion, setConfirmVersion] = useState<VersionRow | null>(null)

  const loadVersions = async () => {
    if (!supabase) return
    const table = VERSIONS_TABLE[source]
    if (!table) {
      setVersions([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from(table)
        .select('id, snapshot, changed_by, created_at')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (err) throw err
      setVersions((data ?? []) as VersionRow[])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste historikk.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, source, templateId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleRestore = async (v: VersionRow) => {
    if (!supabase) return
    const rpc = RESTORE_RPC[source]
    if (!rpc) {
      setError('Gjenoppretting er ikke tilgjengelig for denne maltypen.')
      return
    }
    setRestoring(v.id)
    try {
      const { error: err } = await supabase.rpc(rpc, { p_version_id: v.id })
      if (err) throw err
      await loadVersions()
      onRestored?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke gjenopprette versjonen.')
    } finally {
      setRestoring(null)
    }
  }

  const nameField = NAME_FIELD[source]
  const descField = DESC_FIELD[source]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Versjonshistorikk
            </p>
            <h2 className="truncate text-base font-semibold text-neutral-900">{templateName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Loader2 className="size-4 animate-spin" /> Laster …
            </div>
          ) : error ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : versions.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
              Ingen versjoner registrert ennå. Hver gang malen oppdateres lagres en versjon
              automatisk.
            </div>
          ) : (
            <ol className="space-y-2">
              {versions.map((v, idx) => {
                const snap = v.snapshot ?? {}
                const nameVal = snap[nameField] as string | undefined
                const descVal = snap[descField] as string | undefined | null
                const isMostRecent = idx === 0
                const isRestoring = restoring === v.id
                return (
                  <li
                    key={v.id}
                    className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white p-3"
                  >
                    <Clock className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">
                        {new Date(v.created_at).toLocaleString('nb-NO')}
                        {isMostRecent ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-950">
                            Aktiv
                          </span>
                        ) : null}
                      </p>
                      {nameVal ? (
                        <p className="text-xs text-neutral-600">Navn: {nameVal}</p>
                      ) : null}
                      {descVal ? (
                        <p className="line-clamp-2 text-xs text-neutral-500">{descVal}</p>
                      ) : null}
                    </div>
                    {!isMostRecent ? (
                      <button
                        type="button"
                        onClick={() => setConfirmVersion(v)}
                        disabled={isRestoring || restoring !== null}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRestoring ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3" />
                        )}
                        Gjenopprett
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <footer className="border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-500">
          Siste 50 endringer vises. Gjenoppretting blir også loggført som en ny versjon.
        </footer>
      </div>
      {confirmVersion ? (
        <ConfirmDialog
          title="Gjenopprett versjon?"
          body={`Malen blir tilbakestilt til tilstanden fra ${new Date(
            confirmVersion.created_at,
          ).toLocaleString('nb-NO')}. Gjenopprettingen lagres som en ny versjon i historikken.`}
          confirmLabel="Gjenopprett"
          tone="primary"
          onConfirm={() => {
            const v = confirmVersion
            setConfirmVersion(null)
            void handleRestore(v)
          }}
          onCancel={() => setConfirmVersion(null)}
        />
      ) : null}
    </div>
  )
}
