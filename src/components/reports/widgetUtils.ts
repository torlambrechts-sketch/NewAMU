// Pure utility helpers for widget rendering. Lives separately from
// widgetParts.tsx so React Fast Refresh stays happy (Fast Refresh
// requires component files to only export components).

export function segmentsFromObject(o: Record<string, unknown>, colors: string[]) {
  return Object.entries(o)
    .filter(([, v]) => typeof v === 'number' && !Number.isNaN(v as number))
    .map(([label, value], i) => ({
      label,
      value: value as number,
      color: colors[i % colors.length],
    }))
}
