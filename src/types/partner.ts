// Partner Console v0 — type definitions shared by usePartnerMembership,
// PartnerConsolePage, and the consultant-clock integration in the org
// switcher. Mirrors the DB schema from
// `supabase/migrations/20260907123300_partner_console_v0.sql`.

export type PartnerOrganizationRow = {
  id: string
  name: string
  default_hourly_rate: number
  billing_email: string | null
  brand_accent: string | null
  /** Norwegian VAT default 0.25 (set by `20260907126000_partner_invoice_pdf_pdf_storage`). */
  vat_rate: number
  bank_account_number: string | null
  payment_terms_days: number
  created_at: string
  updated_at: string
}

export type PartnerMembershipRole = 'consultant' | 'manager' | 'admin'

export type PartnerMembershipRow = {
  partner_id: string
  organization_id: string
  user_id: string
  role: PartnerMembershipRole
  active: boolean
  hourly_rate_override: number | null
  granted_at: string
  revoked_at: string | null
}

export type PartnerTimeEntrySource = 'manual' | 'auto_session' | 'workflow_action'

export type PartnerTimeEntryRow = {
  id: string
  partner_id: string
  organization_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  description: string | null
  source: PartnerTimeEntrySource
  hourly_rate: number
  billable: boolean
  invoice_line_id: string | null
  created_at: string
}

export type PartnerInvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export type PartnerInvoiceRow = {
  id: string
  partner_id: string
  organization_id: string
  period_start: string
  period_end: string
  status: PartnerInvoiceStatus
  total_minutes: number
  total_amount_nok: number
  csv_storage_path: string | null
  /** Set on first PDF render by `partner-invoice-pdf` edge function. */
  pdf_storage_path: string | null
  pdf_generated_at: string | null
  /** Customer-facing sequential number `<year>-<NNNN>`, minted per partner_id. */
  invoice_number: string | null
  generated_at: string
  sent_at: string | null
  paid_at: string | null
  metadata: Record<string, unknown>
}

/**
 * Convenience view: a customer-org row enriched with the membership
 * facts the partner console needs (role + effective rate).
 */
export type PartnerCustomer = {
  partner_id: string
  organization_id: string
  organization_name: string
  organization_number: string | null
  /** NACE code, when present in `organizations.brreg_snapshot.naeringskode1.kode`. */
  nace_code: string | null
  /** Human label for the NACE code, when present. */
  nace_label: string | null
  role: PartnerMembershipRole
  hourly_rate: number
  active: boolean
}
