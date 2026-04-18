/**
 * Race a thenable (e.g. Supabase `PostgrestFilterBuilder` / RPC builder) or `Promise` against a timer.
 * Supabase clients return thenables that are not typed as `Promise<T>`, so we normalize via `Promise.resolve`.
 */
export function withTimeout<T>(source: PromiseLike<T>, ms: number, label: string): Promise<T> {
  const promise = Promise.resolve(source)
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}
