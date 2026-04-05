/** Deep link into the learning player (QR, email, Teams). */
export function learningModulePlayUrl(courseId: string, moduleId?: string): string {
  if (typeof window === 'undefined') {
    return `/learning/play/${courseId}${moduleId ? `?module=${encodeURIComponent(moduleId)}` : ''}`
  }
  const base = `${window.location.origin}/learning/play/${courseId}`
  return moduleId ? `${base}?module=${encodeURIComponent(moduleId)}` : base
}

export function learningFlowEntryUrl(courseId: string, moduleId?: string): string {
  if (typeof window === 'undefined') {
    return `/learning/flow?course=${encodeURIComponent(courseId)}${moduleId ? `&module=${encodeURIComponent(moduleId)}` : ''}`
  }
  const q = new URLSearchParams({ course: courseId })
  if (moduleId) q.set('module', moduleId)
  return `${window.location.origin}/learning/flow?${q.toString()}`
}

/** Public QR image URL (no extra npm deps); suitable for print labels. */
export function qrCodeImageUrl(data: string, size = 180): string {
  const enc = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${enc}`
}
