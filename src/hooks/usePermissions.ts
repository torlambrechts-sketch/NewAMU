import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { withTimeout } from '../lib/withTimeout'
import type { PermissionKey } from '../lib/permissionKeys'

const PERMISSIONS_RPC_TIMEOUT_MS = 15_000

export function usePermissions(userId: string | undefined) {
  const supabase = getSupabaseBrowserClient()
  const [keys, setKeys] = useState<Set<string>>(new Set())
  /** Only true until first successful fetch for this user — avoids full-route flash on every refresh() */
  const [loading, setLoading] = useState(!!supabase && !!userId)
  const everHadKeys = useRef(false)

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setKeys(new Set())
      everHadKeys.current = false
      setLoading(false)
      return
    }
    if (!everHadKeys.current) {
      setLoading(true)
    }
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_my_effective_permissions'),
        PERMISSIONS_RPC_TIMEOUT_MS,
        'get_my_effective_permissions',
      )
      if (error) {
        console.warn('get_my_effective_permissions', error.message)
        setKeys(new Set())
      } else {
        const rows = (data ?? []) as { permission_key: string }[]
        const next = new Set(rows.map((r) => r.permission_key))
        setKeys(next)
        if (next.size > 0) everHadKeys.current = true
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('get_my_effective_permissions', msg)
      setKeys(new Set())
    } finally {
      setLoading(false)
    }
  }, [supabase, userId])

  useEffect(() => {
    everHadKeys.current = false
    queueMicrotask(() => {
      setLoading(!!supabase && !!userId)
      void refresh()
    })
  }, [supabase, userId, refresh])

  /**
   * Match {@link PermissionGate}: when Supabase is on but RPC returns no rows (migration / seed not run yet),
   * `permissionKeys.size === 0` — routes stay open, so checks must not deny everything (avoids blank hubs).
   */
  const can = useCallback(
    (key: PermissionKey) => {
      if (!supabase) return true
      if (keys.size === 0) return true
      return keys.has(key)
    },
    [supabase, keys],
  )

  const isAdmin = useMemo(() => {
    if (!supabase) return true
    if (keys.size === 0) return true
    return keys.has('module.view.admin') || keys.has('roles.manage')
  }, [supabase, keys])

  return { can, keys, loading, refresh, isAdmin }
}
