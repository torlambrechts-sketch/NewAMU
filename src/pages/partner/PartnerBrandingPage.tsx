// Partner Console v0 — White-label branding editor (P3-#9).
//
// Konsulent-firmaer (partner-admins) styrer logo, primær/sekundær-farge,
// tekst-på-primær-kontrast, og fakturaens avsender-blokk. Bevisst SMAL
// overflate: ingen fri CSS, kun design-tokens som faktura-PDF + e-post
// kan lese. Konsulenten ser live forhåndsvisning mens hen redigerer.
//
// Bakgrunn: regnskapsloven § 10 krever at faktura tydelig viser
// avsender (navn + orgnr); P3-review markerte dette som blocker for
// hvit-merkings-suksess.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Paintbrush, ShieldAlert, Upload } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { usePartnerMembership } from '../../hooks/usePartnerMembership'
import { usePartnerBranding, type PartnerBranding } from '../../hooks/usePartnerBranding'
import { normalizeOrgnr, orgnrError } from '../../lib/validation/orgnr'

const PARTNER_ACCENT = '#c2410c'

type DraftBranding = {
  brand_primary_color: string
  brand_secondary_color: string
  brand_text_on_primary: string
  invoice_sender_name: string
  invoice_sender_orgnr: string
  invoice_footer_text: string
}

function brandingToDraft(b: PartnerBranding | null): DraftBranding {
  return {
    brand_primary_color: b?.brand_primary_color ?? '#1a3d32',
    brand_secondary_color: b?.brand_secondary_color ?? '#0b6b5b',
    brand_text_on_primary: b?.brand_text_on_primary ?? '#ffffff',
    invoice_sender_name: b?.invoice_sender_name ?? '',
    invoice_sender_orgnr: b?.invoice_sender_orgnr ?? '',
    invoice_footer_text: b?.invoice_footer_text ?? '',
  }
}

export function PartnerBrandingPage() {
  const {
    loading: membershipLoading,
    currentPartner,
    isPartnerMember,
    isPartnerManager,
  } = usePartnerMembership()

  const partnerId = currentPartner?.id ?? null
  const {
    loading: brandingLoading,
    branding,
    updateBranding,
    uploadLogo,
    publicLogoUrl,
    error: brandingError,
  } = usePartnerBranding(partnerId)

  const [draft, setDraft] = useState<DraftBranding>(brandingToDraft(null))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Hydrate draft once branding arrives (or when partner switches).
  useEffect(() => {
    setDraft(brandingToDraft(branding))
  }, [branding])

  const orgnrIssue = useMemo(() => orgnrError(draft.invoice_sender_orgnr), [draft.invoice_sender_orgnr])

  const dirty = useMemo(() => {
    const baseline = brandingToDraft(branding)
    return (
      baseline.brand_primary_color !== draft.brand_primary_color ||
      baseline.brand_secondary_color !== draft.brand_secondary_color ||
      baseline.brand_text_on_primary !== draft.brand_text_on_primary ||
      baseline.invoice_sender_name !== draft.invoice_sender_name ||
      baseline.invoice_sender_orgnr !== draft.invoice_sender_orgnr ||
      baseline.invoice_footer_text !== draft.invoice_footer_text
    )
  }, [draft, branding])

  const handleSave = useCallback(async () => {
    if (!isPartnerManager) return
    if (orgnrIssue) return
    setSaving(true)
    const ok = await updateBranding({
      brand_primary_color: draft.brand_primary_color,
      brand_secondary_color: draft.brand_secondary_color,
      brand_text_on_primary: draft.brand_text_on_primary,
      invoice_sender_name: draft.invoice_sender_name.trim() || null,
      invoice_sender_orgnr: draft.invoice_sender_orgnr.trim()
        ? normalizeOrgnr(draft.invoice_sender_orgnr)
        : null,
      invoice_footer_text: draft.invoice_footer_text.trim() || null,
    })
    setSaving(false)
    if (ok) setSavedAt(Date.now())
  }, [isPartnerManager, orgnrIssue, draft, updateBranding])

  const handleLogoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = '' // reset so re-selecting the same file fires onChange
      if (!file) return
      setUploadError(null)
      setUploading(true)
      const path = await uploadLogo(file)
      setUploading(false)
      if (!path) {
        setUploadError('Opplasting feilet — kontroller filformat (PNG/SVG) og størrelse (≤ 200 KB).')
      }
    },
    [uploadLogo],
  )

  // Live-derived preview values use the current draft for colors but
  // the persisted logo URL (logo is uploaded immediately, not in the
  // draft batch).
  const previewSenderName = draft.invoice_sender_name.trim() || currentPartner?.name || 'Ditt konsulentfirma AS'
  const previewOrgnr = draft.invoice_sender_orgnr.trim() || '—'
  const previewFooter =
    draft.invoice_footer_text.trim() ||
    'Betal innen forfallsdato. Forsinkelsesrente etter forsinkelsesrenteloven.'

  if (!membershipLoading && !isPartnerMember) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Partner-konsoll', to: '/partner' }, { label: 'Branding' }]}
        title="Branding"
        description="White-label brand-tokens for faktura og e-post."
      >
        <ModuleSectionCard>
          <div className="px-6 py-10 text-center">
            <ShieldAlert className="mx-auto size-10 text-neutral-400" aria-hidden />
            <p className="mt-4 text-base font-semibold text-neutral-900">Krever partner-medlemskap</p>
            <p className="mt-2 text-sm text-neutral-600">
              Branding-editoren er forbeholdt brukere med aktiv tilknytning til et partnerfirma.
            </p>
          </div>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Partner-konsoll', to: '/partner' }, { label: 'Branding' }]}
      title="Branding"
      description={
        currentPartner
          ? `White-label brand-tokens for ${currentPartner.name}`
          : 'White-label brand-tokens'
      }
      loading={membershipLoading || brandingLoading}
      headerActions={
        <Button
          onClick={handleSave}
          disabled={!isPartnerManager || !dirty || saving || !!orgnrIssue}
          icon={savedAt && !dirty ? <Check className="size-3.5" aria-hidden /> : undefined}
        >
          {saving ? 'Lagrer…' : savedAt && !dirty ? 'Lagret' : 'Lagre endringer'}
        </Button>
      }
    >
      {!isPartnerManager ? (
        <ModuleSectionCard>
          <div className="flex items-start gap-3 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Du kan se branding-innstillingene, men kun partner-manager eller -admin kan lagre
              endringer.
            </p>
          </div>
        </ModuleSectionCard>
      ) : null}

      {brandingError ? (
        <ModuleSectionCard>
          <div className="flex items-start gap-3 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Klarte ikke laste branding: {brandingError}</p>
          </div>
        </ModuleSectionCard>
      ) : null}

      {/* ── Section A: Forhåndsvis ─────────────────────────────────── */}
      <ModuleSectionCard>
        <div className="border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">Forhåndsvis</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Hvordan en faktura ser ut for kunden med dine brand-tokens.
          </p>
        </div>
        <div className="bg-neutral-100 p-6">
          <div
            className="mx-auto max-w-xl overflow-hidden rounded-md border bg-white shadow-sm"
            style={{ borderColor: draft.brand_primary_color }}
          >
            {/* Header band — primary color */}
            <div
              className="flex items-center justify-between gap-4 px-5 py-4"
              style={{
                backgroundColor: draft.brand_primary_color,
                color: draft.brand_text_on_primary,
              }}
            >
              <div className="min-w-0">
                <p className="text-base font-semibold leading-tight">{previewSenderName}</p>
                <p className="text-xs opacity-80">Faktura · forhåndsvisning</p>
              </div>
              {publicLogoUrl ? (
                <img
                  src={publicLogoUrl}
                  alt="Logo"
                  className="h-10 w-auto rounded-sm bg-white/10 object-contain px-2 py-1"
                />
              ) : (
                <div className="rounded-sm border border-current/40 px-2 py-1 text-[10px] uppercase tracking-wide opacity-80">
                  LOGO
                </div>
              )}
            </div>
            {/* Body */}
            <div className="space-y-2 px-5 py-4 text-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <span className="font-semibold" style={{ color: draft.brand_secondary_color }}>
                  Avsender
                </span>
                <span className="text-xs text-neutral-500">Orgnr. {previewOrgnr}</span>
              </div>
              <p className="text-neutral-700">{previewSenderName}</p>
              <p className="text-xs text-neutral-500">Faktura # 2026-0042 · Forfall 14 dager</p>
              <div className="mt-3 rounded-sm bg-neutral-50 p-3 text-xs text-neutral-600">
                Konsulent-timer mars 2026 — 12 t × 1 350 NOK = 16 200 NOK eks. MVA
              </div>
              <p className="mt-4 border-t border-neutral-100 pt-2 text-[11px] leading-snug text-neutral-500">
                {previewFooter}
              </p>
            </div>
          </div>
        </div>
      </ModuleSectionCard>

      {/* ── Section B: Logo ────────────────────────────────────────── */}
      <ModuleSectionCard>
        <div className="border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">Logo</p>
          <p className="mt-0.5 text-xs text-neutral-500">PNG eller SVG, maks 200 KB.</p>
        </div>
        <div className="flex flex-wrap items-center gap-6 px-4 py-4">
          <div className="flex h-24 w-40 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3">
            {publicLogoUrl ? (
              <img
                src={publicLogoUrl}
                alt="Nåværende logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-neutral-500">Ingen logo</span>
            )}
          </div>
          <div className="space-y-2">
            <label className="inline-flex">
              <input
                type="file"
                accept="image/png,image/svg+xml"
                className="sr-only"
                onChange={handleLogoChange}
                disabled={!isPartnerManager || uploading}
              />
              <span
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 ${
                  !isPartnerManager || uploading ? 'cursor-not-allowed opacity-50' : ''
                }`}
              >
                <Upload className="size-3.5" aria-hidden />
                {uploading ? 'Laster opp…' : publicLogoUrl ? 'Erstatt' : 'Last opp'}
              </span>
            </label>
            <p className="text-xs text-neutral-500">
              Lagres som <code className="rounded-sm bg-neutral-100 px-1 py-0.5">partner-branding/{partnerId ?? '<partner_id>'}/logo.&lt;ext&gt;</code>{' '}
              og kan refereres direkte i e-post + PDF.
            </p>
            {uploadError ? (
              <p className="text-xs text-red-700">{uploadError}</p>
            ) : null}
          </div>
        </div>
      </ModuleSectionCard>

      {/* ── Section C: Farger ──────────────────────────────────────── */}
      <ModuleSectionCard>
        <div className="border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">Farger</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Hex-verdier — brukes i PDF-header, e-post-aksent og kunde-portalens overskrifter.
          </p>
        </div>
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-3">
          <ColorField
            label="Primær"
            description="Hovedfargen (PDF-bånd, knapper)."
            value={draft.brand_primary_color}
            onChange={(v) =>
              setDraft((d) => ({ ...d, brand_primary_color: v }))
            }
            disabled={!isPartnerManager}
          />
          <ColorField
            label="Sekundær"
            description="Akssent (seksjonstitler, lenker)."
            value={draft.brand_secondary_color}
            onChange={(v) =>
              setDraft((d) => ({ ...d, brand_secondary_color: v }))
            }
            disabled={!isPartnerManager}
          />
          <ColorField
            label="Tekst på primær"
            description="Kontrast-tekst over primær-fargen."
            value={draft.brand_text_on_primary}
            onChange={(v) =>
              setDraft((d) => ({ ...d, brand_text_on_primary: v }))
            }
            disabled={!isPartnerManager}
          />
        </div>
      </ModuleSectionCard>

      {/* ── Section D: Faktura-info ────────────────────────────────── */}
      <ModuleSectionCard>
        <div className="border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">Faktura-info</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Selger-blokk på faktura (regnskapsloven § 10 — orgnr er obligatorisk).
          </p>
        </div>
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Avsender-navn
            </span>
            <StandardInput
              className="mt-1.5"
              value={draft.invoice_sender_name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, invoice_sender_name: e.target.value }))
              }
              placeholder={currentPartner?.name ?? 'Ditt konsulentfirma AS'}
              disabled={!isPartnerManager}
            />
            <span className="mt-1 block text-[11px] text-neutral-500">
              Tom = bruk firmanavnet ({currentPartner?.name ?? '—'}).
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Avsender orgnr
            </span>
            <StandardInput
              className="mt-1.5"
              inputMode="numeric"
              maxLength={11}
              value={draft.invoice_sender_orgnr}
              onChange={(e) =>
                setDraft((d) => ({ ...d, invoice_sender_orgnr: e.target.value }))
              }
              placeholder="9 siffer"
              aria-invalid={orgnrIssue ? 'true' : undefined}
              disabled={!isPartnerManager}
            />
            {orgnrIssue ? (
              <span className="mt-1 block text-[11px] text-red-700">{orgnrIssue}</span>
            ) : (
              <span className="mt-1 block text-[11px] text-neutral-500">
                Verifiseres mot mod-11 sjekksum.
              </span>
            )}
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Faktura-bunntekst
            </span>
            <StandardTextarea
              className="mt-1.5"
              rows={2}
              value={draft.invoice_footer_text}
              onChange={(e) =>
                setDraft((d) => ({ ...d, invoice_footer_text: e.target.value }))
              }
              placeholder="1-2 linjer juridisk tekst nederst på fakturaen."
              disabled={!isPartnerManager}
            />
          </label>
        </div>
      </ModuleSectionCard>

      <div className="flex items-center justify-end gap-3 text-xs text-neutral-500">
        <Paintbrush className="size-3.5" aria-hidden style={{ color: PARTNER_ACCENT }} />
        <span>Endringer trer i kraft umiddelbart for nye faktura-PDFer og e-post.</span>
      </div>
    </ModulePageShell>
  )
}

function ColorField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string
  description: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-2 py-1.5">
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-8 w-10 cursor-pointer rounded-sm border border-neutral-200 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${label} fargevelger`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={7}
          className="w-24 border-0 bg-transparent font-mono text-xs uppercase text-neutral-700 outline-none disabled:opacity-50"
          aria-label={`${label} hex-verdi`}
        />
      </div>
      <p className="text-[11px] text-neutral-500">{description}</p>
    </div>
  )
}
