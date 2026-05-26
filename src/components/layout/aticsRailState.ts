// Rail-2 state machine. Two states — `expanded` (256px nav) and
// `hidden` (rail collapsed) — toggled by the user via the rail
// button or the [ keyboard shortcut.
//
// Storage shape:
//   atics-rail2 = 'auto' | 'expanded' | 'hidden'
//
// `auto` resolves at runtime via matchMedia (see AticsShell):
// viewports below md collapse to hidden, everything else opens
// to expanded. The legacy boolean key `atics-sub-nav-collapsed` is
// migrated on read so existing users keep their preference.
//
// (The earlier `mini` icon-only state was dropped in favour of a
// simple open/closed model — the two-click "expanded → mini →
// hidden" cycle was noisy when users just wanted to close the rail.)

export type Rail2State = 'expanded' | 'hidden'
export type Rail2Preference = 'auto' | Rail2State

const KEY = 'atics-rail2'
const LEGACY_KEY = 'atics-sub-nav-collapsed'

// Auto-state threshold. Below md, the rail eats a third of the
// viewport — hide by default. md+ defaults to expanded.
const HIDDEN_BELOW_PX = 768

export function loadRail2Pref(): Rail2Preference {
  try {
    const v = localStorage.getItem(KEY)
    // The legacy `mini` value (from the 3-state era) is migrated to
    // `expanded` — users on small screens get hidden via the auto
    // default anyway, and the mini state no longer exists.
    if (v === 'auto' || v === 'expanded' || v === 'hidden') return v
    if (v === 'mini') return 'expanded'
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy === '1') return 'hidden'
  } catch {
    /* ignore */
  }
  return 'auto'
}

export function saveRail2Pref(pref: Rail2Preference) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* ignore */
  }
}

export function autoRail2State(viewportWidth: number): Rail2State {
  return viewportWidth < HIDDEN_BELOW_PX ? 'hidden' : 'expanded'
}

export function resolveRail2State(
  pref: Rail2Preference,
  viewportWidth: number,
): Rail2State {
  return pref === 'auto' ? autoRail2State(viewportWidth) : pref
}

// Binary toggle: expanded ↔ hidden. Used by the rail-toggle button
// and the [ keyboard shortcut.
export function cycleRail2State(current: Rail2State): Rail2State {
  return current === 'expanded' ? 'hidden' : 'expanded'
}

export function rail2StateLabel(state: Rail2State): string {
  switch (state) {
    case 'expanded':
      return 'Utvidet'
    case 'hidden':
      return 'Skjult'
  }
}
