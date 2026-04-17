import type { CSSProperties } from 'react'

type FontKey = 'normal' | 'large' | 'xlarge'

function fontSizeCss(k: FontKey): string {
  if (k === 'large') return '1.125rem'
  if (k === 'xlarge') return '1.25rem'
  return '1rem'
}

/** CSS variables + optional contrast filter for the documents module shell */
export function documentsModuleShellStyle(profile: {
  doc_font_size?: string | null
  doc_high_contrast?: boolean | null
} | null): CSSProperties {
  const raw = profile?.doc_font_size
  const font: FontKey = raw === 'large' || raw === 'xlarge' ? raw : 'normal'
  return {
    ['--doc-font-size' as string]: fontSizeCss(font),
    filter: profile?.doc_high_contrast ? 'contrast(1.5)' : undefined,
  }
}
