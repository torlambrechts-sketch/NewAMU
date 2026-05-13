// Møter — route wrapper. Renders the hub view (Oversikt). Settings live
// in the unified hub at `/admin/settings/meetings` since the consolidate-
// admin-settings refactor; the embedded "Innstillinger" root tab was
// removed as part of that cleanup.

import { MeetingsHubView } from '../../../modules/meetings/MeetingsHubView'

export function MeetingsHubPage() {
  return <MeetingsHubView />
}
