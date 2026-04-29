/** Parse data URL (browser FileReader.readAsDataURL) into Blob for Storage upload. */
export function parseDataUrlToBlob(dataUrl: string): { blob: Blob; extension: string } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl.trim())
  if (!m) return null
  const mime = (m[1] ?? 'application/octet-stream').split(';')[0]!.trim().toLowerCase()
  const isBase64 = Boolean(m[2])
  const payload = m[3] ?? ''
  const extFromMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  const extension = extFromMime[mime] ?? 'bin'

  try {
    if (isBase64) {
      const binary = atob(payload)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      return { blob: new Blob([bytes], { type: mime }), extension }
    }
    const decoded = decodeURIComponent(payload)
    return { blob: new Blob([decoded], { type: mime }), extension }
  } catch {
    return null
  }
}
