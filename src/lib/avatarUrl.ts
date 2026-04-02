/** Stable demo avatar from pravatar.cc from any string seed. */
export function avatarUrlFromSeed(seed: string, size = 80): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const img = (h % 70) + 1
  return `https://i.pravatar.cc/${size}?img=${img}`
}
