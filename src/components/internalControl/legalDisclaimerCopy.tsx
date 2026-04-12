import type { ReactNode } from 'react'

/** Shared copy for LegalDisclaimer and WorkplaceNoticePanel (ROS infobox). */
export function legalDisclaimerBody({ compact }: { compact?: boolean }): ReactNode {
  if (compact) {
    return (
      <>
        <strong>Ikke juridisk rådgivning.</strong> Demo lokalt i nettleser. Tilpass mot AML, varslingsregler og
        internkontrollforskriften.
      </>
    )
  }
  return (
    <>
      <strong>Ikke juridisk rådgivning.</strong> Dette er et <strong>demonstrasjonsverktøy</strong> lagret lokalt i
      nettleseren. Det erstatter ikke skriftlige rutiner, BHT, arbeidstilsyn eller krav i{' '}
      <a href="https://lovdata.no/dokument/NL/lov/2005-06-17-62" className="font-medium underline" target="_blank" rel="noreferrer">
        arbeidsmiljøloven
      </a>
      , varslingsregelverk eller{' '}
      <a
        href="https://lovdata.no/dokument/SF/forskrift/1996-12-06-1127"
        className="font-medium underline"
        target="_blank"
        rel="noreferrer"
      >
        internkontrollforskriften
      </a>
      . Ved reelle varsler: følg virksomhetens godkjente prosedyrer og ta kontakt med juridisk bistand der nødvendig.
    </>
  )
}
