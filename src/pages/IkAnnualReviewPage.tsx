import { IkAnnualReviewView } from '../modules/ik-annual-review'
import { IkWorkplacePageShell } from '../components/internkontroll/IkWorkplacePageShell'

/**
 * Frittstående årlig gjennomgang (IK-f § 5.8) — samme kode som fanen i Internkontroll.
 * Tilknytning: `/internkontroll/arsgjenomgang` og `modules` registry (slug: `ik-annual-review`).
 */
export function IkAnnualReviewPage() {
  return (
    <IkWorkplacePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'Årsgjennomgang' }]}
      title="Årlig gjennomgang"
      description="Lovhjemmel: internkontrollforskriften § 5.8. Dokumenter gjennomgangen, følg avvik og inspeksjonsdata, og signer."
    >
      <IkAnnualReviewView />
    </IkWorkplacePageShell>
  )
}
