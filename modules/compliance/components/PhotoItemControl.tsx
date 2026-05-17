// PhotoItemControl — upload, preview, delete photo attachments for a
// checklist response of type 'photo'. Files live in the Supabase Storage
// bucket compliance_checklist_files; response.value.urls[] holds the
// storage paths. Thumbnails resolve to short-lived signed URLs on render.

import { useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

type Props = {
  paths: string[]
  readOnly: boolean
  onUpload: (file: File) => Promise<unknown>
  onRemove: (path: string) => Promise<unknown>
  signUrl: (path: string) => Promise<string | null>
}

export function PhotoItemControl({
  paths,
  readOnly,
  onUpload,
  onRemove,
  signUrl,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-upload of same filename
    if (!file) return
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Kun bildefiler er tillatt.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Filen er for stor (maks 5 MB).')
      return
    }

    setBusy(true)
    try {
      await onUpload(file)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {paths.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {paths.map((path) => (
            <PhotoThumb
              key={path}
              path={path}
              readOnly={readOnly}
              signUrl={signUrl}
              onRemove={() => onRemove(path)}
            />
          ))}
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden native file picker; triggered by the visible Button below.
              No primitive exists for file input — keeping raw <input> is correct here. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleChange}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Upload className="h-3.5 w-3.5" />}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Laster opp …' : 'Last opp bilde'}
          </Button>
          <span className="text-xs text-neutral-500">JPG/PNG, maks 5 MB</span>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ── Thumbnail with on-demand signed URL ────────────────────────────────────

type PhotoThumbProps = {
  path: string
  readOnly: boolean
  signUrl: (path: string) => Promise<string | null>
  onRemove: () => Promise<unknown>
}

function PhotoThumb({ path, readOnly, signUrl, onRemove }: PhotoThumbProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let cancelled = false
    signUrl(path).then((url) => {
      if (!cancelled) setSignedUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [path, signUrl])

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await onRemove()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="group relative h-24 w-24 overflow-hidden border border-neutral-300 bg-neutral-100">
      {signedUrl ? (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={signedUrl}
            alt="Vedlegg"
            className="h-full w-full object-cover"
          />
        </a>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" aria-hidden />
        </div>
      )}
      {!readOnly ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          disabled={removing}
          aria-label="Slett bilde"
          className="absolute right-1 top-1 h-6 w-6 rounded-none bg-white/90 text-neutral-700 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </Button>
      ) : null}
    </div>
  )
}
