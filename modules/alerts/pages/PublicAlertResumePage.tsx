// PublicAlertResumePage — at /alerts/public/resume. Accepts an access_key
// (from ?key= or pasted), fetches the encrypted draft, decrypts client-side,
// and hands the restored form state to PublicAlertSubmitPage.
//
// This is a thin orchestration page; the actual form lives in
// PublicAlertSubmitPage which we navigate to with the restored state in
// router state.

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

export default function PublicAlertResumePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { supabase } = useOrgSetupContext()
  const [keyInput, setKeyInput] = useState(searchParams.get('key') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (searchParams.get('key')) {
      void doResume(searchParams.get('key')!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doResume(key: string) {
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('public_resume_alert_draft', { p_access_key: key })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      setError('Vi finner ingen kladd med denne nøkkelen. Sjekk for skrivefeil eller om kladden er utløpt.')
      return
    }
    const row = data[0] as {
      organization_id: string
      system_template_id: string | null
      org_template_id: string | null
      intake_form_version_id: string | null
      payload_encrypted: string
      key_version: number
      submission_locale: string | null
    }
    // Look up org slug from id.
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('alerts_public_slug')
      .eq('id', row.organization_id)
      .maybeSingle()
    const orgSlug = (orgRow as { alerts_public_slug?: string } | null)?.alerts_public_slug
    if (!orgSlug || !row.system_template_id) {
      setError('Kladden kan ikke gjenopprettes — organisasjonen eller malen er ikke tilgjengelig lenger.')
      return
    }
    navigate(`/alerts/public/${orgSlug}`, {
      state: {
        resumed: true,
        accessKey: key,
        systemTemplateId: row.system_template_id,
        intakeFormVersionId: row.intake_form_version_id,
        payloadEncrypted: row.payload_encrypted,
        keyVersion: row.key_version,
        locale: row.submission_locale ?? 'nb',
      },
    })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (keyInput.trim()) void doResume(keyInput.trim())
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Fortsett der du var</h1>
      <p className="mt-2 text-sm text-neutral-700">
        Lim inn tilgangsnøkkelen vi ga deg da du lagret kladden. Vi har ingen annen måte å gjenfinne den på.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="font-semibold">Tilgangsnøkkel</span>
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
            required
          />
        </label>
        {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Henter kladd…' : 'Fortsett'}
        </button>
      </form>
    </main>
  )
}
