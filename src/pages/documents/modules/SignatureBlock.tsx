// SignatureBlock — to-parts signering for dokumenter.
//
// Renderer per part en signatur-rad med navn/dato/signatur-felt. Hvis
// BankID-integrasjon er aktivert i org_integrations, vises i tillegg en
// «Signer med BankID»-knapp som triggrer OIDC-flow (edge function ansvarlig
// for selve flowen — denne komponenten kaller bare init-endepunktet).
//
// Lagring av faktiske signaturer skjer i bankid_signatures-tabellen.
// Eksisterende signaturer hentes via bankid_signatures_by_page-viewet.

import { useEffect, useState } from 'react'
import { FileSignature, Loader2, ShieldCheck } from 'lucide-react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { Button } from '../../../components/ui/Button'

type Props = {
  pageId: string
  pageVersion: number
  parties?: string[]
  requireDate?: boolean
  notes?: string
}

type SignatureRow = {
  signer_role: string | null
  signer_display_name: string
  signed_at: string | null
  status: string
  signature_note: string | null
}

export function SignatureBlock({
  pageId,
  pageVersion,
  parties = ['Arbeidstaker', 'Leder'],
  requireDate = true,
  notes,
}: Props) {
  const { supabase, organization, user } = useOrgSetupContext()
  const [bankidEnabled, setBankidEnabled] = useState(false)
  const [signatures, setSignatures] = useState<SignatureRow[]>([])
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    void Promise.all([
      supabase
        .from('org_integrations')
        .select('enabled')
        .eq('organization_id', organization.id)
        .eq('kind', 'bankid')
        .maybeSingle(),
      supabase
        .from('bankid_signatures')
        .select('signer_role, signer_display_name, signed_at, status, signature_note')
        .eq('organization_id', organization.id)
        .eq('page_id', pageId)
        .eq('page_version', pageVersion)
        .order('signed_at', { ascending: true }),
    ]).then(([intRes, sigRes]) => {
      if (intRes.data?.enabled) setBankidEnabled(true)
      if (sigRes.data) setSignatures(sigRes.data as SignatureRow[])
    })
  }, [supabase, organization?.id, pageId, pageVersion])

  async function recordManualSignature(role: string) {
    if (!supabase || !organization?.id || !user) return
    setSubmitting(role)
    setError(null)
    try {
      const { error: insErr } = await supabase.from('bankid_signatures').insert({
        organization_id: organization.id,
        page_id: pageId,
        page_version: pageVersion,
        signer_user_id: user.id,
        signer_role: role,
        signer_display_name: user.user_metadata?.display_name ?? user.email ?? 'Ukjent',
        status: 'completed',
        signed_at: new Date().toISOString(),
        signature_note: 'Manuell signering (BankID ikke konfigurert)',
      })
      if (insErr) throw insErr
      const { data } = await supabase
        .from('bankid_signatures')
        .select('signer_role, signer_display_name, signed_at, status, signature_note')
        .eq('organization_id', organization.id)
        .eq('page_id', pageId)
        .eq('page_version', pageVersion)
        .order('signed_at', { ascending: true })
      setSignatures((data ?? []) as SignatureRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre signatur')
    } finally {
      setSubmitting(null)
    }
  }

  async function signWithBankID(role: string) {
    if (!supabase || !organization?.id) return
    setSubmitting(role)
    setError(null)
    try {
      // Init BankID OIDC flow via edge function. Edge function konstruerer
      // OIDC-redirect-URL med vår orgs BankID client_id og statlig
      // signatur-callback. Returnerer URL som klient redirecter til.
      const { data, error: fnErr } = await supabase.functions.invoke('bankid-init', {
        body: {
          page_id: pageId,
          page_version: pageVersion,
          signer_role: role,
          organization_id: organization.id,
        },
      })
      if (fnErr) throw fnErr
      if (data?.redirect_url) {
        window.location.href = data.redirect_url
      } else {
        throw new Error('BankID-init returnerte ingen redirect-URL')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BankID-init feilet')
      setSubmitting(null)
    }
  }

  function findSignature(role: string): SignatureRow | undefined {
    return signatures.find((s) => s.signer_role === role && s.status === 'completed')
  }

  return (
    <div className="not-prose my-6 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-800">
        <FileSignature className="h-4 w-4" />
        Signatur
      </div>
      {notes ? <p className="mb-3 text-xs text-neutral-600">{notes}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {parties.map((party) => {
          const sig = findSignature(party)
          const submittingThis = submitting === party
          return (
            <div key={party} className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-600">
                {party}
              </div>
              {sig ? (
                <div className="mt-2 text-sm">
                  <div className="flex items-center gap-1 text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="font-medium">{sig.signer_display_name}</span>
                  </div>
                  {requireDate && sig.signed_at ? (
                    <div className="mt-0.5 text-xs text-neutral-500">
                      Signert {new Date(sig.signed_at).toLocaleString('nb-NO')}
                    </div>
                  ) : null}
                  {sig.signature_note ? (
                    <div className="mt-1 text-xs italic text-neutral-500">{sig.signature_note}</div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="text-xs text-neutral-500">Ikke signert</div>
                  {bankidEnabled ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => signWithBankID(party)}
                      disabled={submittingThis}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#1a3d32] px-3 py-1 text-xs font-medium text-white hover:bg-[#142e26] disabled:opacity-50"
                    >
                      {submittingThis ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                      Signer med BankID
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => recordManualSignature(party)}
                      disabled={submittingThis}
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {submittingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Bekreft signering
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {error ? <div className="mt-3 text-xs text-red-700">{error}</div> : null}
      {!bankidEnabled ? (
        <div className="mt-3 text-xs text-neutral-500">
          💡 BankID-signering kan aktiveres under <strong>Admin → Integrasjoner</strong>.
        </div>
      ) : null}
    </div>
  )
}
