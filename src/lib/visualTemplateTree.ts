import { newBlockId, type VisualBlock } from '../types/visualTemplate'

export function getBlockAtPath(root: VisualBlock, path: number[]): VisualBlock | null {
  let cur: VisualBlock | null = root
  for (const i of path) {
    if (!cur?.children || cur.children[i] == null) return null
    cur = cur.children[i]!
  }
  return cur
}

export function updateBlockAtPath(root: VisualBlock, path: number[], patch: Partial<VisualBlock>): VisualBlock {
  if (path.length === 0) {
    return { ...root, ...patch, children: patch.children !== undefined ? patch.children : root.children }
  }
  const [h, ...rest] = path
  const children = [...(root.children ?? [])]
  const target = children[h]
  if (!target) return root
  children[h] = updateBlockAtPath(target, rest, patch)
  return { ...root, children }
}

export function insertChildAt(root: VisualBlock, parentPath: number[], index: number, block: VisualBlock): VisualBlock {
  if (parentPath.length === 0) {
    const ch = [...(root.children ?? [])]
    ch.splice(index, 0, block)
    return { ...root, children: ch }
  }
  const [h, ...rest] = parentPath
  const children = [...(root.children ?? [])]
  children[h] = insertChildAt(children[h]!, rest, index, block)
  return { ...root, children }
}

export function removeAtPath(root: VisualBlock, path: number[]): VisualBlock {
  if (path.length === 0) return root
  const [h, ...rest] = path
  if (rest.length === 0) {
    const ch = [...(root.children ?? [])]
    ch.splice(h, 1)
    return { ...root, children: ch }
  }
  const children = [...(root.children ?? [])]
  children[h] = removeAtPath(children[h]!, rest)
  return { ...root, children }
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** Move child at `fromParent[fromIndex]` to `toParent` at `toInsertIndex`. */
export function moveBlock(
  root: VisualBlock,
  fromParent: number[],
  fromIndex: number,
  toParent: number[],
  toInsertIndex: number,
): VisualBlock {
  const fromFull = [...fromParent, fromIndex]
  const moving = getBlockAtPath(root, fromFull)
  if (!moving) return root
  const next = removeAtPath(root, fromFull)
  let insertAt = toInsertIndex
  if (pathsEqual(fromParent, toParent) && fromIndex < insertAt) insertAt -= 1
  const parentAfter = toParent.length === 0 ? next : getBlockAtPath(next, toParent)
  const len = parentAfter?.children?.length ?? 0
  insertAt = Math.max(0, Math.min(insertAt, len))
  return insertChildAt(next, toParent, insertAt, moving)
}

export function defaultChildBlock(type: VisualBlock['type']): VisualBlock {
  switch (type) {
    case 'text':
      return { id: newBlockId(), type: 'text', text: 'Tekst' }
    case 'heading':
      return { id: newBlockId(), type: 'heading', text: 'Overskrift', headingLevel: 2 }
    case 'button':
      return { id: newBlockId(), type: 'button', text: 'Knapp' }
    case 'link':
      return { id: newBlockId(), type: 'link', text: 'Lenke', href: '#' }
    case 'input':
      return { id: newBlockId(), type: 'input', inputType: 'text', placeholder: 'Søk…' }
    case 'image':
      return { id: newBlockId(), type: 'image', src: 'https://picsum.photos/seed/vt/400/200', alt: '' }
    case 'divider':
      return { id: newBlockId(), type: 'divider' }
    case 'row':
      return { id: newBlockId(), type: 'row', flexDirection: 'row', flexGap: '12px', flexWrap: true, children: [] }
    case 'column':
      return { id: newBlockId(), type: 'column', flexDirection: 'column', flexGap: '12px', children: [] }
    case 'grid':
      return {
        id: newBlockId(),
        type: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
        gridGap: '12px',
        children: [],
      }
    case 'container':
    default:
      return { id: newBlockId(), type: 'container', className: 'rounded-lg border border-neutral-200 bg-white p-4', children: [] }
  }
}

export function duplicateSubtree(block: VisualBlock): VisualBlock {
  return {
    ...block,
    id: newBlockId(),
    style: block.style ? { ...block.style } : undefined,
    children: block.children?.map(duplicateSubtree),
  }
}
