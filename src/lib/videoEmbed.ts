/** Best-effort embed URL for common video hosts. */

export type VideoEmbedKind = 'youtube' | 'vimeo' | 'direct' | 'unknown'

export function classifyVideoUrl(url: string): VideoEmbedKind {
  const u = url.trim().toLowerCase()
  if (!u) return 'unknown'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('vimeo.com')) return 'vimeo'
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return 'direct'
  return 'unknown'
}

/** YouTube watch or short URL → embed path */
export function youtubeEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url.trim())
    let id: string | null = null
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.replace(/^\//, '').split('/')[0] ?? null
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        return url.trim()
      }
      id = u.searchParams.get('v')
      if (!id && u.pathname.startsWith('/shorts/')) {
        id = u.pathname.split('/')[2] ?? null
      }
    }
    if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null
    return `https://www.youtube.com/embed/${id}?rel=0`
  } catch {
    return null
  }
}

export function vimeoEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (!u.hostname.includes('vimeo.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    const id = parts[parts.length - 1]
    if (!id || !/^\d+$/.test(id)) return null
    return `https://player.vimeo.com/video/${id}`
  } catch {
    return null
  }
}
