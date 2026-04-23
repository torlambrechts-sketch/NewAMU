/**
 * Platform-admin layout kit — delte elementer for layout-komponer og arbeidsflate-sider.
 * Holdes utenfor .tsx for react-refresh/only-export-components.
 */

/** Bakgrunn for «scorecard»-KPI-bokser (layout-referanse). */
export const LAYOUT_SCORE_STAT_CREAM = '#f2eee6'

export type LayoutScoreStatItem = {
  /** Stort tall øverst */
  big: string
  /** Primærtekst under tallet */
  title: string
  /** Sekundærtekst (grå) */
  sub: string
  /** Valgfritt ikon til venstre i cellen (f.eks. dokumentmapper). */
  icon?: 'folder'
}
