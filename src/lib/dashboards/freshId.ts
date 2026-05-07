// freshId — single source of truth for id minting across dashboard
// chrome (3.5.2). Uses crypto.randomUUID() when the runtime exposes it
// (browsers + Node ≥ 18) and falls back to a Math.random() scheme on
// older runtimes. Pages used to copy-paste this five lines at a time;
// now everyone imports the same helper.

export function freshId(prefix: string = 'id'): string {
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof cryptoLike?.randomUUID === 'function') return cryptoLike.randomUUID()
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}
