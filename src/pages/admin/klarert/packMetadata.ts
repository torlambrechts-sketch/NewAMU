// Framework display metadata for the Mal-pakker section.
// Pack rows themselves live in DB (compliance_packs, etc); this only
// supplies icon + accent color + a fallback short name.

import {
  Award,
  BadgeCheck,
  BookOpen,
  Handshake,
  Leaf,
  Lock,
  Scale,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import type { ElementType } from 'react'

export interface FrameworkMeta {
  framework: string
  icon: ElementType
  color: string
  fallbackName: string
  fallbackDescription: string
  lawRefs: string[]
}

export const FRAMEWORK_REGISTRY: Record<string, FrameworkMeta> = {
  'aml-amu': {
    framework: 'aml-amu',
    icon: Scale,
    color: '#1a3d32',
    fallbackName: 'Arbeidsmiljøloven — grunnpakke',
    fallbackDescription:
      'Alt du trenger for å oppfylle AML kapittel 2–8. Maler for vernerunder, AMU-møter, medarbeidersamtaler, avviksbehandling og 40-timers HMS-grunnkurs.',
    lawRefs: ['AML kap. 2–8'],
  },
  ik: {
    framework: 'ik',
    icon: BookOpen,
    color: '#5A9C76',
    fallbackName: 'Internkontrollforskriften',
    fallbackDescription:
      'Maler for systematisk HMS-arbeid iht. IK-forskriften § 5. Risikovurdering, internkontrollrutiner, årshjul og dokumentasjonskrav.',
    lawRefs: ['IK § 5'],
  },
  ia: {
    framework: 'ia',
    icon: Handshake,
    color: '#16A34A',
    fallbackName: 'IA-avtalen 2024–2028',
    fallbackDescription:
      'Maler for sykefraværsoppfølging, tilretteleggingssamtaler (uke 4/7/26) og dialogmøter med NAV.',
    lawRefs: ['Folketrygdloven kap. 25', 'IA-avtalen'],
  },
  'iso-45001': {
    framework: 'iso-45001',
    icon: BadgeCheck,
    color: '#2563EB',
    fallbackName: 'ISO 45001 — HMS-styringssystem',
    fallbackDescription:
      'Komplett pakke for ISO 45001-sertifisering. Risikovurderinger, ledelsens gjennomgåelse, internrevisjoner og kontekstanalyse.',
    lawRefs: ['ISO 45001:2018'],
  },
  'iso-9001': {
    framework: 'iso-9001',
    icon: Award,
    color: '#7C3AED',
    fallbackName: 'ISO 9001 — Kvalitetsstyring',
    fallbackDescription:
      'Maler for prosesstyring, leverandøreval., kundetilfredshet og ledelsens gjennomgåelse.',
    lawRefs: ['ISO 9001:2015'],
  },
  'iso-27001': {
    framework: 'iso-27001',
    icon: ShieldCheck,
    color: '#0EA5E9',
    fallbackName: 'ISO 27001 — Informasjonssikkerhet',
    fallbackDescription:
      'Annex A-kontroller, risikoregister, asset inventory, sikkerhetsbevissthet-kurs og hendelseshåndtering.',
    lawRefs: ['ISO/IEC 27001:2022'],
  },
  'iso-14001': {
    framework: 'iso-14001',
    icon: Leaf,
    color: '#16A34A',
    fallbackName: 'ISO 14001 — Miljøstyring',
    fallbackDescription:
      'Miljøaspekter, lovregister miljø, miljøgjennomgåelse og bærekraftsrapportering.',
    lawRefs: ['ISO 14001:2015'],
  },
  gdpr: {
    framework: 'gdpr',
    icon: Lock,
    color: '#6366F1',
    fallbackName: 'GDPR-pakken',
    fallbackDescription:
      'Behandlingsprotokoll (Art. 30), DPIA-maler, varslingsrutiner og personverninnstillinger.',
    lawRefs: ['GDPR', 'Personopplysningsloven'],
  },
  internal: {
    framework: 'internal',
    icon: Settings,
    color: '#737373',
    fallbackName: 'Intern pakke',
    fallbackDescription: 'Interne maler bygget av organisasjonen selv. Onboarding, IT-rutiner og prosjektmaler.',
    lawRefs: [],
  },
}

export function getFrameworkMeta(framework: string): FrameworkMeta {
  return FRAMEWORK_REGISTRY[framework] ?? FRAMEWORK_REGISTRY.internal
}

export const FRAMEWORK_PACK_DEFAULTS: Array<{
  framework: string
  installed: boolean
  version: string
}> = [
  { framework: 'aml-amu', installed: true, version: '2026.1' },
  { framework: 'ik', installed: true, version: '2025.4' },
  { framework: 'ia', installed: true, version: '2024.2' },
  { framework: 'iso-45001', installed: true, version: '2026.1' },
  { framework: 'iso-9001', installed: false, version: '2025.3' },
  { framework: 'iso-27001', installed: true, version: '2025.2' },
  { framework: 'iso-14001', installed: false, version: '2024.1' },
  { framework: 'gdpr', installed: true, version: '2026.1' },
  { framework: 'internal', installed: true, version: '1.0' },
]
