import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import type { PermissionKey } from '../lib/permissionKeys'

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
    const { data, error } = await supabase.rpc('get_my_effective_permissions')
    if (error) {
      console.warn('get_my_effective_permissions', error.message)
      setKeys(new Set())
    } else {
      const rows = (data ?? []) as { permission_key: string }[]
      const next = new Set(rows.map((r) => r.permission_key))
      setKeys(next)
      if (next.size > 0) everHadKeys.current = true
    }
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    everHadKeys.current = false
    queueMicrotask(() => {
      setLoading(!!supabase && !!userId)
      void refresh()
    })
  }, [supabase, userId, refresh])

  const can = useCallback(
    (key: PermissionKey) => {
      if (!supabase) return true
      return keys.has(key)
    },
    [supabase, keys],
  )

  const isAdmin = useMemo(() => {
    if (!supabase) return true
    return keys.has('module.view.admin') || keys.has('roles.manage')
  }, [supabase, keys])

  return { can, keys, loading, refresh, isAdmin }
}
