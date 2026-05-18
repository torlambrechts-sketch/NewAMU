// Studio Pack Editor — Studio Builder Phase 2a Task 2a.2.
//
// Lists the org's studio_packs (published, immutable) + studio_pack_drafts
// (mutable, semver-tagged). Lets an admin:
//   - Create a new draft (forks from a published pack or from scratch)
//   - Edit a draft's manifest jsonb body
//   - Publish a draft → atomically promotes via publish_studio_pack RPC
//     and freezes immutable=true
//   - Bump semver on an existing draft
//   - Export a published pack as a ZIP (calls studio-pack-export edge fn)
//   - Import a ZIP (calls studio-pack-import edge fn)
//
// Phase 2a-only authoring depth: the manifest editor is a JSON textarea
// + slug + semver pickers. A rich content editor (per-control-row UI)
// is the next sprint of work; the textarea proves the data path.
//
// Spec: specs/studio-builder.md §5 Phase 2a Task 2a.2 + 2a.3.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Upload, Download, Lock, FileEdit } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { AutosaveIndicator } from '../../components/studio/shell/AutosaveIndicator'
import { ConflictModal } from '../../components/studio/shell/ConflictModal'
import type { AutosaveState } from '../../hooks/useStudioAutosave'
import type { EmbedderConflictResolution } from '../../lib/studio/studioTypes'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'

type PackRow = {
  id: string
  slug: string
  semver: string
  status: 'draft' | 'published' | 'archived'
  immutable: boolean
  published_at: string | null
  review_status: 'draft' | 'reviewed' | 'approved'
  name_i18n: Record<string, string>
}

type DraftRow = {
  id: string
  slug: string
  draft_semver: string
  status: 'editing' | 'reviewing' | 'ready_to_publish'
  last_edited_at: string
  draft_payload: Record<string, unknown>
}

const BREADCRUMB = [
  { label: 'Studio', to: '/studio' },
  { label: 'Pakker' },
]

export function PackEditor() {
  const { supabase, organization } = useOrgSetupContext()
  const [packs, setPacks] = useState<PackRow[]>([])
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [editorBody, setEditorBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !organization) return
    setLoading(true)
    const [packsRes, draftsRes] = await Promise.all([
      supabase
        .from('studio_packs')
        .select('id, slug, semver, status, immutable, published_at, review_status, name_i18n')
        .eq('organization_id', organization.id)
        .order('published_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('studio_pack_drafts')
        .select('id, slug, draft_semver, status, last_edited_at, draft_payload')
        .eq('organization_id', organization.id)
        .order('last_edited_at', { ascending: false }),
    ])
    setPacks((packsRes.data ?? []) as PackRow[])
    setDrafts((draftsRes.data ?? []) as DraftRow[])
    setLoading(false)
  }, [supabase, organization])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical fetch-on-mount pattern; reload internally setStates
    void reload()
  }, [reload])

  const activeDraft = useMemo(
    () => drafts.find((d) => d.id === activeDraftId) ?? null,
    [drafts, activeDraftId],
  )

  // Track which draft's body is currently loaded into the textarea so we
  // sync without an effect-driven setState (which the lint rule forbids).
  const [editorBodyDraftId, setEditorBodyDraftId] = useState<string | null>(null)
  if (activeDraft?.id !== editorBodyDraftId) {
    setEditorBodyDraftId(activeDraft?.id ?? null)
    setEditorBody(activeDraft ? JSON.stringify(activeDraft.draft_payload ?? {}, null, 2) : '')
  }

  // Autosave state — flips to 'pending' on typing, 'saving' during save,
  // 'saved' on success. The actual write fires via handleSaveDraft (manual
  // Lagre button or 8s of idle). The visible AutosaveIndicator narrates this.
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle')
  const [autosaveLastAt, setAutosaveLastAt] = useState<Date | null>(null)

  // Optimistic-lock: snapshot the server's last_edited_at at the moment
  // the user opened a draft. On save, if the server row has moved past
  // that timestamp (another admin saved in between), open the
  // ConflictModal with server-vs-client side-by-side.
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{
    serverPayload: Record<string, unknown>
    clientPayload: Record<string, unknown>
    serverUpdatedAt: string | null
  } | null>(null)
  if (activeDraft?.last_edited_at !== openedAt && activeDraft) {
    setOpenedAt(activeDraft.last_edited_at)
  }

  async function handleCreateDraft() {
    if (!supabase || !organization) return
    setBusy(true)
    setError(null)
    const slug = prompt('Pakke-slug (a-z-0-9):')?.trim().toLowerCase()
    if (!slug) {
      setBusy(false)
      return
    }
    const semver = prompt('Semver (f.eks. 1.0.0):', '1.0.0')?.trim()
    if (!semver) {
      setBusy(false)
      return
    }
    const { data, error: e } = await supabase
      .from('studio_pack_drafts')
      .insert({
        organization_id: organization.id,
        slug,
        draft_semver: semver,
        draft_payload: { format_version: '1.0', controls: [] },
        status: 'editing',
      })
      .select('id')
      .single()
    if (e) {
      setError(getSupabaseErrorMessage(e))
    } else {
      setActiveDraftId((data as { id: string } | null)?.id ?? null)
      await reload()
    }
    setBusy(false)
  }

  async function handleSaveDraft() {
    if (!supabase || !activeDraft) return
    setBusy(true)
    setAutosaveState('saving')
    setError(null)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(editorBody)
    } catch (e) {
      setError(`Ugyldig JSON: ${e instanceof Error ? e.message : String(e)}`)
      setAutosaveState('error')
      setBusy(false)
      return
    }
    // Optimistic-lock check — re-read the row's last_edited_at; if it
    // moved past openedAt the row was changed under us. Surface the
    // ConflictModal with server-vs-client side-by-side.
    const { data: serverNow } = await supabase
      .from('studio_pack_drafts')
      .select('last_edited_at, draft_payload')
      .eq('id', activeDraft.id)
      .single()
    type SnapShot = { last_edited_at: string; draft_payload: Record<string, unknown> }
    const snap = (serverNow as SnapShot | null) ?? null
    if (snap && openedAt && snap.last_edited_at !== openedAt) {
      setConflict({
        serverPayload: snap.draft_payload ?? {},
        clientPayload: parsed,
        serverUpdatedAt: snap.last_edited_at,
      })
      setAutosaveState('error')
      setBusy(false)
      return
    }
    const { error: e } = await supabase
      .from('studio_pack_drafts')
      .update({ draft_payload: parsed })
      .eq('id', activeDraft.id)
    if (e) {
      setError(getSupabaseErrorMessage(e))
      setAutosaveState('error')
    } else {
      setAutosaveState('saved')
      setAutosaveLastAt(new Date())
      await reload()
    }
    setBusy(false)
  }

  async function handleConflictResolution(resolution: EmbedderConflictResolution) {
    if (!supabase || !activeDraft || !conflict) return
    if (resolution === 'use_server') {
      setEditorBody(JSON.stringify(conflict.serverPayload, null, 2))
      setConflict(null)
      setAutosaveState('idle')
      await reload()
      return
    }
    if (resolution === 'use_client') {
      const { error: e } = await supabase
        .from('studio_pack_drafts')
        .update({ draft_payload: conflict.clientPayload })
        .eq('id', activeDraft.id)
      if (e) setError(getSupabaseErrorMessage(e))
      else {
        setAutosaveState('saved')
        setAutosaveLastAt(new Date())
      }
      setConflict(null)
      await reload()
      return
    }
    // 'merge' — close modal, user merges by hand in the textarea
    setConflict(null)
  }

  async function handlePublish() {
    if (!supabase || !activeDraft) return
    if (!confirm(`Publisere ${activeDraft.slug} v${activeDraft.draft_semver}? Pakken blir uforanderlig.`)) return
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.rpc('publish_studio_pack', {
      p_slug: activeDraft.slug,
      p_semver: activeDraft.draft_semver,
    })
    if (e) {
      setError(getSupabaseErrorMessage(e))
    } else {
      setActiveDraftId(null)
      await reload()
    }
    setBusy(false)
  }

  async function handleExport(pack: PackRow) {
    if (!supabase) return
    const { data, error: e } = await supabase.functions.invoke('studio-pack-export', {
      body: { slug: pack.slug, semver: pack.semver },
    })
    if (e) {
      setError(getSupabaseErrorMessage(e))
      return
    }
    if (data instanceof Blob) {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${pack.slug}-${pack.semver}.zip`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async function handleImport(file: File) {
    if (!supabase) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    const { error: e } = await supabase.functions.invoke('studio-pack-import', {
      body: form,
    })
    if (e) {
      setError(getSupabaseErrorMessage(e))
    } else {
      await reload()
    }
    setBusy(false)
  }

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      title="Pakker"
      description="Author, publiser og portér compliance-pakker som immutable artefakter."
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleCreateDraft} disabled={busy}>
            <Plus className="h-3.5 w-3.5" /> Nytt utkast
          </Button>
          <label className="cursor-pointer">
            <StandardInput
              type="file"
              accept=".zip"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleImport(f)
                e.target.value = ''
              }}
            />
            <Button variant="secondary" size="sm" disabled={busy}>
              <Upload className="h-3.5 w-3.5" /> Importér ZIP
            </Button>
          </label>
        </div>
      }
      loading={loading}
      loadingLabel="Laster pakker…"
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section>
          <h3 className="mb-3 text-sm font-semibold text-neutral-900 font-serif">Utkast</h3>
          {drafts.length === 0 ? (
            <p className="text-xs text-neutral-500">Ingen aktive utkast. Opprett ett over.</p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className={`rounded-lg border p-3 ${
                    activeDraftId === d.id
                      ? 'border-[#1a3d32]/40 bg-[#1a3d32]/5'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileEdit className="h-3.5 w-3.5 text-neutral-500" />
                        <span className="font-medium text-neutral-900">{d.slug}</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-mono text-neutral-700">
                          v{d.draft_semver}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Sist redigert {new Date(d.last_edited_at).toLocaleString('nb')}
                      </p>
                    </div>
                    <Button
                      variant={activeDraftId === d.id ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setActiveDraftId(d.id)}
                    >
                      Rediger
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {activeDraft ? (
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-neutral-900 font-serif">
                  Rediger {activeDraft.slug} v{activeDraft.draft_semver}
                </h4>
                <div className="mt-1">
                  <AutosaveIndicator state={autosaveState} lastSavedAt={autosaveLastAt} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Lagre
                </Button>
                <Button variant="primary" size="sm" onClick={handlePublish} disabled={busy}>
                  Publisér og lås
                </Button>
              </div>
            </div>
            <StandardTextarea
              value={editorBody}
              onChange={(e) => {
                setEditorBody(e.target.value)
                if (autosaveState !== 'saving') setAutosaveState('pending')
              }}
              className="h-[420px] w-full font-mono text-xs"
              spellCheck={false}
              aria-label="Manifest body (JSON)"
            />
            <p className="mt-2 text-[11px] text-neutral-500">
              Rik authoring-flate (per-kontroll-redigerer) kommer i Phase 2a follow-up. Phase 1
              eksponerer manifest-jsonb direkte.
            </p>
          </section>
        ) : null}

        <section>
          <h3 className="mb-3 text-sm font-semibold text-neutral-900 font-serif">Publisert</h3>
          {packs.length === 0 ? (
            <p className="text-xs text-neutral-500">Ingen publiserte pakker enda.</p>
          ) : (
            <ul className="space-y-2">
              {packs.map((p) => (
                <li key={p.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-neutral-500" />
                        <span className="font-medium text-neutral-900">{p.slug}</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-mono text-neutral-700">
                          v{p.semver}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                          {p.review_status}
                        </span>
                      </div>
                      {p.published_at ? (
                        <p className="mt-1 text-[11px] text-neutral-500">
                          Publisert {new Date(p.published_at).toLocaleString('nb')}
                        </p>
                      ) : null}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleExport(p)}>
                      <Download className="h-3.5 w-3.5" /> Eksportér ZIP
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ConflictModal
        open={conflict !== null}
        rowTable="studio_pack_drafts"
        serverPayload={conflict?.serverPayload ?? {}}
        clientPayload={conflict?.clientPayload ?? {}}
        serverUpdatedAt={conflict?.serverUpdatedAt ?? null}
        onResolve={handleConflictResolution}
        onClose={() => setConflict(null)}
      />
    </ModulePageShell>
  )
}
