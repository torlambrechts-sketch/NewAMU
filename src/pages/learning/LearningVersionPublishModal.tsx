/**
 * Admin "Publiser ny versjon" modal — replaces the bare window.confirm flow.
 * Captures changelog notes + a major/minor toggle. For system-backed courses
 * the new version writes to learning_system_course_locale_versions via the
 * learning_publish_locale_version RPC; org courses fall back to the existing
 * bumpCourseVersion RPC (no changelog persisted yet — see follow-up).
 */
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { Course } from '../../types/learning'

export type LearningVersionPublishModalProps = {
  course: Course
  onClose: () => void
  onPublish: (input: {
    versionMajor: number
    versionMinor: number
    isMajor: boolean
    changeNotesMd: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function LearningVersionPublishModal({ course, onClose, onPublish }: LearningVersionPublishModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const currentMajor = course.localeVersionMajor ?? course.courseVersion ?? 1
  const currentMinor = course.localeVersionMinor ?? course.courseVersionMinor ?? 0
  const [isMajor, setIsMajor] = useState(false)
  const [notes, setNotes] = useState('### Endringer\n- ')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nextMajor = isMajor ? currentMajor + 1 : currentMajor
  const nextMinor = isMajor ? 0 : currentMinor + 1

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handlePublish() {
    if (publishing) return
    setPublishing(true)
    setError(null)
    const result = await onPublish({
      versionMajor: nextMajor,
      versionMinor: nextMinor,
      isMajor,
      changeNotesMd: notes.trim(),
    })
    setPublishing(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onClose()
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="learning-version-publish-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-4">
          <div>
            <h2 id="learning-version-publish-title" className="text-lg font-semibold text-neutral-900">
              Publiser ny versjon
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Gjeldende: v{currentMajor}.{currentMinor} → <strong>v{nextMajor}.{nextMinor}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Type endring
            </legend>
            <div className="mt-2 space-y-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
                <input
                  type="radio"
                  name="is_major"
                  checked={!isMajor}
                  onChange={() => setIsMajor(false)}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="font-medium text-neutral-900">Liten endring (minor)</span>
                  <span className="block text-xs text-neutral-500">
                    Stille oppdatering — ingen varsel til completere. Brukes for typoer, lenker, små rettelser.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
                <input
                  type="radio"
                  name="is_major"
                  checked={isMajor}
                  onChange={() => setIsMajor(true)}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="font-medium text-neutral-900">Stor endring (major)</span>
                  <span className="block text-xs text-neutral-500">
                    Varsler alle som har fullført, status settes til «Trenger oppdatering». Brukes ved
                    regelverksendringer eller nytt fagstoff.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="change-notes" className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Endringsnotater (Markdown)
            </label>
            <textarea
              id="change-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
              placeholder="### Endringer&#10;- "
            />
            <p className="mt-1 text-xs text-neutral-500">
              Synlig for læreren i diff-modalen. Forklar hva som er endret og hvorfor.
            </p>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={publishing}>
            Avbryt
          </Button>
          <Button type="button" onClick={handlePublish} disabled={publishing}>
            {publishing ? 'Publiserer…' : 'Publiser'}
          </Button>
        </footer>
      </div>
    </div>
  )
}
