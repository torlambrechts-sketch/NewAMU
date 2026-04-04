import { AlertTriangle } from 'lucide-react'

export function LegalDisclaimer({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-amber-300/90 bg-amber-50 text-amber-950 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      }`}
      role="note"
    >
      <div className="flex gap-2">
        <AlertTriangle className={`shrink-0 text-amber-700 ${compact ? 'size-4' : 'size-5'}`} aria-hidden />
        <div>
          <strong>Ikke juridisk rådgivning.</strong>{' '}
          {compact
            ? 'Demo lokalt i nettleser. Tilpass mot AML, varslingsregler og internkontrollforskriften.'
            : (
              <>
                Dette er et <strong>demonstrasjonsverktøy</strong> lagret lokalt i nettleseren. Det erstatter ikke
                skriftlige rutiner, BHT, arbeidstilsyn eller krav i{' '}
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
                . Ved reelle varsler: følg virksomhetens godkjente prosedyrer og ta kontakt med juridisk bistand der
                nødvendig.
              </>
            )}
        </div>
      </div>
    </div>
  )
}
