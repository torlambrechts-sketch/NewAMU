// Rail-2 state machine. Replaces the boolean `subNavCollapsed` so the
// shell can move between three states (expanded / mini / hidden) and
// pick a breakpoint-aware default when the user hasn't expressed a
// preference.
//
// Storage shape:
//   atics-rail2 = 'auto' | 'expanded' | 'mini' | 'hidden'
//
// `auto` resolves at runtime via matchMedia (see AticsShell). The
// legacy boolean key `atics-sub-nav-collapsed` is migrated on read:
// users who chose 'collapsed' keep that as 'hidden'; everyone else
// lands on 'auto' so they get the breakpoint-aware default.

export type Rail2State = 'expanded' | 'mini' | 'hidden'
export type Rail2Preference = 'auto' | Rail2State

const KEY = 'atics-rail2'
const LEGACY_KEY = 'atics-sub-nav-collapsed'

// Auto-state thresholds. ≥ XL keeps the full 256px rail; lg/md fall to
// mini (56px icons) so dashboards have room; <md collapses entirely
// since the rail consumes a third of the viewport.
const MINI_BELOW_PX = 1280
const HIDDEN_BELOW_PX = 768

export function loadRail2Pref(): Rail2Preference {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'auto' || v === 'expanded' || v === 'mini' || v === 'hidden') return v
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
  if (viewportWidth < HIDDEN_BELOW_PX) return 'hidden'
  if (viewportWidth < MINI_BELOW_PX) return 'mini'
  return 'expanded'
}

export function resolveRail2State(
  pref: Rail2Preference,
  viewportWidth: number,
): Rail2State {
  return pref === 'auto' ? autoRail2State(viewportWidth) : pref
}

// Cycle forward: expanded → mini → hidden → expanded. Used by the
// toggle button and the keyboard shortcut.
export function cycleRail2State(current: Rail2State): Rail2State {
  switch (current) {
    case 'expanded':
      return 'mini'
    case 'mini':
      return 'hidden'
    case 'hidden':
      return 'expanded'
  }
}

export function rail2StateLabel(state: Rail2State): string {
  switch (state) {
    case 'expanded':
      return 'Utvidet'
    case 'mini':
      return 'Kompakt'
    case 'hidden':
      return 'Skjult'
  }
}
