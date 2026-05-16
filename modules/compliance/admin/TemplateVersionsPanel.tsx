// TemplateVersionsPanel — list every published version of a compliance
// walkthrough template, publish a new version from the current
// definition, and view diff between any two versions.
//
// Opened from MalerTab via a per-template "Versjoner" button. Backed
// by useTemplateVersions which wraps the Phase 13 DB RPCs.
//
// Permissions: publishing requires platform_is_admin (enforced
// server-side in the RPC); the form is shown but disabled with an
// explanatory tooltip when the user lacks the permission. Reads are
// open to any authenticated user (the versions table is platform
// metadata, not org-private).

import { useMemo, useState } from 'react'
import { ChevronRight, GitBranch, Plus } from 'lucide-react'
import { FormModal } from '../../../src/template'
import { Button } from '../../../src/components/ui/Button'
import { Badge } from '../../../src/components/ui/Badge'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { WarningBox, InfoBox } from '../../../src/components/ui/AlertBox'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useTemplateVersions, type TemplateVersionRow } from '../useTemplateVersions'
import { TemplateVersionDiffModal } from './TemplateVersionDiffModal'
import type { CompliancePackSlug } from '../types'

export function TemplateVersionsPanel({
  slug,
  pack,
  templateName,
  currentVersionMajor,
  currentVersionMinor,
  onClose,
  onPublished,
}: {
  slug: string
  pack: CompliancePackSlug
  templateName: string
  currentVersionMajor: number
  currentVersionMinor: number
  onClose: () => void
  /** Called after a successful publish so the parent can refetch
   *  compliance_checklist_templates and re-render current_version. */
  onPublished?: () => void | Promise<void>
}) {
  const { isAdmin } = useOrgSetupContext()
  const { versions, loading, error, publish, diff } = useTemplateVersions(slug, pack)

  const [showPublishForm, setShowPublishForm] = useState(false)
  const [publishVersion, setPublishVersion] = useState('')
  const [publishChangelog, setPublishChangelog] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const [diffPair, setDiffPair] = useState<{ from: TemplateVersionRow; to: TemplateVersionRow } | null>(null)

  // Suggested next version is current + 0.1 (minor bump). User can override.
  const suggestedNextVersion = useMemo(
    () => `${currentVersionMajor}.${currentVersionMinor + 1}`,
    [currentVersionMajor, currentVersionMinor],
  )

  async function handlePublish() {
    setPublishError(null)
    const m = publishVersion.match(/^(\d+)\.(\d+)$/)
    if (!m) {
      setPublishError('Versjonsformat: <major>.<minor> (eks. 1.1)')
      return
    }
    const major = parseInt(m[1], 10)
    const minor = parseInt(m[2], 10)
    if (
      major < currentVersionMajor ||
      (major === currentVersionMajor && minor <= currentVersionMinor)
    ) {
      setPublishError(
        `Ny versjon må være høyere enn nåværende v${currentVersionMajor}.${currentVersionMinor}.`,
      )
      return
    }
    if (!publishChangelog.trim()) {
      setPublishError('Changelog er påkrevd — beskriv kort hva som er endret.')
      return
    }
    setPublishing(true)
    const id = await publish(major, minor, publishChangelog.trim())
    setPublishing(false)
    if (id) {
      setShowPublishForm(false)
      setPublishVersion('')
      setPublishChangelog('')
      // Tell the parent so it can refetch templates → version badge
      // on the MalerTab row updates without a page reload.
      if (onPublished) await onPublished()
    } else {
      // useTemplateVersions stores the RPC error; surface the local copy too
      // so the user sees a clear message even if the hook hasn't re-rendered.
      setPublishError('Publisering feilet — sjekk konsollen for serverfeil (typisk permissions).')
    }
  }

  return (
    <>
      <FormModal
        open
        onClose={onClose}
        titleId="template-versions-panel"
        title={
          <span className="inline-flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Versjoner — {templateName}
          </span>
        }
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-xs text-neutral-500">
              Nåværende versjon: v{currentVersionMajor}.{currentVersionMinor}
            </span>
            <Button variant="secondary" onClick={onClose}>
              Lukk
            </Button>
          </div>
        }
      >
        <div className="space-y-4 px-1 py-2">
          {error && <WarningBox>{error}</WarningBox>}

          {/* Publish form */}
          {showPublishForm ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="mb-2 text-sm font-semibold text-emerald-900">
                Publiser ny versjon
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
                <label className="block text-xs font-medium text-emerald-900">
                  Versjon
                  <StandardInput
                    value={publishVersion}
                    onChange={(e) => setPublishVersion(e.target.value)}
                    placeholder={suggestedNextVersion}
                    className="mt-1 font-mono"
                  />
                </label>
                <label className="block text-xs font-medium text-emerald-900">
                  Changelog
                  <StandardTextarea
                    value={publishChangelog}
                    onChange={(e) => setPublishChangelog(e.target.value)}
                    placeholder="Hva er endret? Eks: «Punktet om kontrolltiltak oppdatert per lovendring 2024»"
                    rows={2}
                    className="mt-1"
                  />
                </label>
              </div>
              {publishError && (
                <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                  {publishError}
                </div>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowPublishForm(false)
                    setPublishError(null)
                  }}
                  disabled={publishing}
                >
                  Avbryt
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishing || !publishVersion || !publishChangelog.trim()}
                >
                  {publishing ? 'Publiserer…' : 'Publiser'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600">
                Publisering snapshotter gjeldende mal-definisjon og oppdaterer
                <code className="mx-1 font-mono text-xs">current_version</code>
                på alle organisasjoner samtidig.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowPublishForm(true)}
                disabled={!isAdmin}
                title={isAdmin ? undefined : 'Krever platform-admin'}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Publiser ny versjon
              </Button>
            </div>
          )}

          {!isAdmin && !showPublishForm && (
            <InfoBox>
              Publisering er forbeholdt platform-admin. Du kan lese versjons­historikken
              og se forskjeller, men ikke publisere nye versjoner.
            </InfoBox>
          )}

          {/* Versions list */}
          {loading ? (
            <p className="text-sm text-neutral-600">Henter versjoner…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-neutral-600">Ingen versjoner publisert ennå.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
              {versions.map((v, idx) => {
                const isCurrent =
                  v.version_major === currentVersionMajor &&
                  v.version_minor === currentVersionMinor
                const previous = versions[idx + 1] // versions are desc-ordered
                return (
                  <li key={v.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-sm font-semibold">
                          v{v.version_major}.{v.version_minor}
                        </span>
                        {isCurrent && <Badge variant="success">Aktiv</Badge>}
                        <span className="text-xs text-neutral-500">
                          {new Date(v.published_at).toLocaleDateString('nb-NO')}
                        </span>
                      </div>
                      {v.changelog && (
                        <p className="mt-1 text-xs text-neutral-700">{v.changelog}</p>
                      )}
                    </div>
                    {previous && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDiffPair({ from: previous, to: v })}
                      >
                        vs v{previous.version_major}.{previous.version_minor}
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </FormModal>

      {diffPair && (
        <TemplateVersionDiffModal
          fromVersion={diffPair.from}
          toVersion={diffPair.to}
          fetchDiff={diff}
          onClose={() => setDiffPair(null)}
        />
      )}
    </>
  )
}
