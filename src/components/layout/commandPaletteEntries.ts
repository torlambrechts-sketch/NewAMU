// Pure helpers for building the command-palette search index. Kept in
// a separate file from the React component so Vite's Fast Refresh
// doesn't reset palette state every time a helper changes.

import type { ComponentType } from 'react'
import type { NavSection } from './aticsNavTypes'

type IconComponent = ComponentType<{
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

export type CommandEntry = {
  id: string
  title: string
  /** Group + section context, e.g. "Daglig drift · Sjekklister". */
  subtitle: string
  icon: IconComponent
  path: string
}

// Flatten the rendered nav into a search index. Modules first, then
// their direct sub-items that have a routable path (headers and
// pseudo-entries like `__cat:foo` are skipped).
export function flattenNavToEntries(sections: NavSection[]): CommandEntry[] {
  const out: CommandEntry[] = []
  for (const section of sections) {
    for (const group of section.groups) {
      for (const mod of group.modules) {
        out.push({
          id: `${section.id}:${group.id}:${mod.to}`,
          title: mod.label,
          subtitle: `${section.label} · ${group.label}`,
          icon: mod.icon,
          path: mod.to,
        })
        for (const sub of mod.subs) {
          if (sub.kind === 'header') continue
          if (sub.path.startsWith('__cat:')) continue
          const subIcon = sub.Icon ?? mod.icon
          out.push({
            id: `${section.id}:${group.id}:${mod.to}:sub:${sub.path}`,
            title: sub.label,
            subtitle: `${section.label} · ${mod.label}`,
            icon: subIcon,
            path: sub.path,
          })
        }
      }
    }
  }
  return out
}

export function scoreEntry(entry: CommandEntry, q: string): number {
  if (!q) return 0
  const t = entry.title.toLowerCase()
  const s = entry.subtitle.toLowerCase()
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.includes(q)) return 60
  if (s.includes(q)) return 40
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi]!, ti)
    if (found < 0) return 0
    ti = found + 1
  }
  return 20
}
