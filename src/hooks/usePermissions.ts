import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import type { PermissionKey } from '../lib/permissionKeys'

export function usePermissions(userId: string | undefined) {
  const supabase = getSupabaseBrowserClient()
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(!!supabase && !!userId)

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setKeys(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('get_my_effective_permissions')
    if (error) {
      console.warn('get_my_effective_permissions', error.message)
      setKeys(new Set())
    } else {
      const rows = (data ?? []) as { permission_key: string }[]
      setKeys(new Set(rows.map((r) => r.permission_key)))
    }
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

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
