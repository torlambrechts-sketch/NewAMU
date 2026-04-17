import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'

type Props = {
  storagePath: string
  caption?: string
  width: 'full' | 'wide' | 'medium'
}

const widthClass: Record<Props['width'], string> = {
  full: 'w-full max-w-none',
  wide: 'max-w-4xl mx-auto',
  medium: 'max-w-2xl mx-auto',
}

export function WikiImageBlock({ storagePath, caption, width }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const sb = getSupabaseBrowserClient()
      if (!sb || !storagePath) {
        if (!cancelled) setSrc(null)
        return
      }
      const { data, error } = await sb.storage.from('wiki_space_files').createSignedUrl(storagePath, 3600)
      if (cancelled) return
      if (error || !data?.signedUrl) {
        setErr('Kunne ikke laste bilde')
        setSrc(null)
        return
      }
      setErr(null)
      setSrc(data.signedUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [storagePath])

  if (err || !src) {
    return (
      <figure className={`rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500 ${widthClass[width]}`}>
        {err ?? 'Laster bilde…'}
      </figure>
    )
  }

  return (
    <figure className={`${widthClass[width]}`}>
      <img src={src} alt={caption ?? ''} className="h-auto w-full rounded-lg border border-neutral-200 object-contain" />
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-neutral-600">{caption}</figcaption>
      ) : null}
    </figure>
  )
}
