// Partner Console v0 — white-label branding hook (P3-#9).
//
// Reads the brand_* + invoice_* columns from partner_organizations for
// the active partner firm, and exposes a thin `updateBranding(patch)`
// that proxies to the `partner_update_branding` security-definer RPC.
// Direct UPDATE on partner_organizations is admin-only via RLS — the
// RPC gates on partner manager/admin which is the same level the
// editor UI is reserved for.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type PartnerBranding = {
  brand_logo_url: string | null
  brand_primary_color: string
  brand_secondary_color: string
  brand_text_on_primary: string
  invoice_sender_name: string | null
  invoice_sender_orgnr: string | null
  invoice_footer_text: string | null
}

const DEFAULT_BRANDING: PartnerBranding = {
  brand_logo_url: null,
  brand_primary_color: '#1a3d32',
  brand_secondary_color: '#0b6b5b',
  brand_text_on_primary: '#ffffff',
  invoice_sender_name: null,
  invoice_sender_orgnr: null,
  invoice_footer_text: null,
}

export type UsePartnerBrandingReturn = {
  loading: boolean
  branding: PartnerBranding | null
  /** Patch the partner's branding. Returns true on success. */
  updateBranding: (patch: Partial<PartnerBranding>) => Promise<boolean>
  /** Upload a logo file. Returns the storage path on success, or null. */
  uploadLogo: (file: File) => Promise<string | null>
  /** Build a public URL for a stored logo (or null when no logo set). */
  publicLogoUrl: string | null
  /** Force a refetch (e.g. after a sibling tab updates the row). */
  refresh: () => void
  error: string | null
}

export function usePartnerBranding(partnerId: string | null): UsePartnerBrandingReturn {
  const { supabase } = useOrgSetupContext()
  const [loading, setLoading] = useState(false)
  const [branding, setBranding] = useState<PartnerBranding | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!supabase || !partnerId) {
      setBranding(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: selErr } = await supabase
        .from('partner_organizations')
        .select(
          'brand_logo_url, brand_primary_color, brand_secondary_color, brand_text_on_primary, invoice_sender_name, invoice_sender_orgnr, invoice_footer_text',
        )
        .eq('id', partnerId)
        .maybeSingle()
      if (cancelled) return
      if (selErr) {
        setError(selErr.message)
        setBranding(null)
        setLoading(false)
        return
      }
      const row = (data ?? {}) as Partial<PartnerBranding>
      setBranding({
        ...DEFAULT_BRANDING,
        ...row,
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, partnerId, version])

  const updateBranding = useCallback(
    async (patch: Partial<PartnerBranding>): Promise<boolean> => {
      if (!supabase || !partnerId) return false
      setError(null)
      const { error: rpcErr } = await supabase.rpc('partner_update_branding', {
        p_partner_id: partnerId,
        p_brand_primary_color: patch.brand_primary_color ?? null,
        p_brand_secondary_color: patch.brand_secondary_color ?? null,
        p_brand_text_on_primary: patch.brand_text_on_primary ?? null,
        p_brand_logo_url: patch.brand_logo_url ?? null,
        p_invoice_sender_name: patch.invoice_sender_name ?? null,
        p_invoice_sender_orgnr: patch.invoice_sender_orgnr ?? null,
        p_invoice_footer_text: patch.invoice_footer_text ?? null,
      })
      if (rpcErr) {
        setError(rpcErr.message)
        return false
      }
      // Optimistically merge — next refetch will reconcile.
      setBranding((prev) => (prev ? { ...prev, ...patch } : prev))
      refresh()
      return true
    },
    [supabase, partnerId, refresh],
  )

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
      if (!supabase || !partnerId) return null
      setError(null)
      // Cap file size client-side too — bucket policy enforces the
      // 200 KB limit, but failing fast in JS gives a better message.
      if (file.size > 200 * 1024) {
        setError('Filen er større enn 200 KB.')
        return null
      }
      const ext = file.type === 'image/svg+xml' ? 'svg' : 'png'
      if (file.type !== 'image/png' && file.type !== 'image/svg+xml') {
        setError('Kun PNG eller SVG støttes.')
        return null
      }
      const path = `${partnerId}/logo.${ext}`
      const { error: upErr } = await supabase.storage
        .from('partner-branding')
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
          cacheControl: '60',
        })
      if (upErr) {
        setError(upErr.message)
        return null
      }
      const ok = await updateBranding({ brand_logo_url: path })
      return ok ? path : null
    },
    [supabase, partnerId, updateBranding],
  )

  const publicLogoUrl = (() => {
    if (!supabase || !branding?.brand_logo_url) return null
    const { data } = supabase.storage.from('partner-branding').getPublicUrl(branding.brand_logo_url)
    return data?.publicUrl ?? null
  })()

  return {
    loading,
    branding,
    updateBranding,
    uploadLogo,
    publicLogoUrl,
    refresh,
    error,
  }
}
