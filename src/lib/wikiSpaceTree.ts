import type { WikiSpace } from '../types/documents'

export type SpaceTreeNode = WikiSpace & { children: SpaceTreeNode[] }

export function buildSpaceTree(spaces: WikiSpace[]): SpaceTreeNode[] {
  const map = new Map<string, SpaceTreeNode>()
  for (const s of spaces) {
    map.set(s.id, { ...s, children: [] })
  }
  const roots: SpaceTreeNode[] = []
  for (const node of map.values()) {
    const pid = node.parentSpaceId
    if (pid && map.has(pid)) {
      map.get(pid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function getSpacePath(spaceId: string, spaces: WikiSpace[]): WikiSpace[] {
  const path: WikiSpace[] = []
  let current: WikiSpace | undefined = spaces.find((s) => s.id === spaceId)
  const guard = new Set<string>()
  while (current) {
    if (guard.has(current.id)) break
    guard.add(current.id)
    path.unshift(current)
    const pid = current.parentSpaceId
    current = pid ? spaces.find((s) => s.id === pid) : undefined
  }
  return path
}

/** Returns depth from root (1 = root folder). Used for client-side max depth check. */
export function wikiSpaceDepthFromRoot(spaceId: string, spaces: WikiSpace[]): number {
  return getSpacePath(spaceId, spaces).length
}

/** Longest chain of child edges from `spaceId` down to a leaf (0 if no subfolders). */
export function wikiSpaceMaxDescendantEdgeDistance(spaceId: string, spaces: WikiSpace[]): number {
  const byParent = new Map<string, WikiSpace[]>()
  for (const s of spaces) {
    const p = s.parentSpaceId ?? ''
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(s)
  }
  const dfs = (id: string): number => {
    const kids = byParent.get(id) ?? []
    if (kids.length === 0) return 0
    return 1 + Math.max(...kids.map((k) => dfs(k.id)))
  }
  return dfs(spaceId)
}

/** `spaceId` and every descendant folder id (not including unrelated nodes). */
export function wikiSpaceCollectDescendantIds(spaceId: string, spaces: WikiSpace[]): Set<string> {
  const byParent = new Map<string, WikiSpace[]>()
  for (const s of spaces) {
    const p = s.parentSpaceId ?? ''
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(s)
  }
  const out = new Set<string>()
  const stack = [spaceId]
  while (stack.length) {
    const id = stack.pop()!
    const kids = byParent.get(id) ?? []
    for (const c of kids) {
      if (!out.has(c.id)) {
        out.add(c.id)
        stack.push(c.id)
      }
    }
  }
  return out
}
