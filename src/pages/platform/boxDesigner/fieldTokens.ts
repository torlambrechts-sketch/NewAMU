export const PANEL =
  'mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white'
export const PANEL_INLINE =
  'w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white'
export const SECTION = 'rounded-xl border border-white/10 bg-slate-900/40 p-4'
export const LABEL = 'block text-xs font-medium text-neutral-400'

export function hexForPicker(value: string): string {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value
  return '#ffffff'
}
