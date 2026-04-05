/** UI strings — extend per feature; keys are stable for DB-driven i18n migration. */
export type AppLocale = 'nb' | 'en'

export const APP_LOCALES: AppLocale[] = ['nb', 'en']

export const LOCALE_LABELS: Record<AppLocale, string> = {
  nb: 'Norsk',
  en: 'English',
}

type Bundle = Record<string, string>

const nb: Bundle = {
  'shell.findAnything': 'Finn noe',
  'shell.subnavHint': 'Velg en hovedmodul over (Council, Org health, …)',
  'shell.logOut': 'Logg ut',
  'shell.logIn': 'Logg inn',
  'shell.upgrade': 'Oppgrader',
  'shell.settingsAria': 'Innstillinger og profil',
  'shell.externalAria': 'Åpne ekstern lenke',
  'shell.userProfileAria': 'Brukerprofil',
  'shell.language': 'Språk',
  'nav.council': 'Council',
  'nav.members': 'Members',
  'nav.orgHealth': 'Org health',
  'nav.hse': 'HSE',
  'nav.internalControl': 'Internkontroll',
  'nav.tasks': 'Tasks',
  'nav.learning': 'E-learning',
  'nav.admin': 'Admin',
  'profile.title': 'Profil og innstillinger',
  'profile.subtitle': 'Språk lagres i databasen og gjelder denne kontoen.',
  'profile.displayName': 'Visningsnavn',
  'profile.locale': 'Språk (grensesnitt)',
  'profile.save': 'Lagre',
  'profile.saving': 'Lagrer…',
  'profile.saved': 'Lagret.',
  'profile.loadError': 'Kunne ikke laste profil.',
  'profile.backHome': 'Tilbake til forsiden',
  'dashboard.setup.title': 'Oppsett og layout',
  'dashboard.setup.hint': 'Regionfilter, tabelltetthet og snarvei til organisasjonsoppsett.',
  'dashboard.setup.region': 'Region',
  'dashboard.setup.regionAll': 'Alle',
  'dashboard.setup.regionUsa': 'USA',
  'dashboard.setup.regionEurope': 'Europa',
  'dashboard.setup.density': 'Tabell',
  'dashboard.setup.comfortable': 'Luftig',
  'dashboard.setup.compact': 'Kompakt',
  'dashboard.setup.orgLink': 'Organisasjonsoppsett (Brønnøysund, struktur)',
  'dashboard.setup.orgLinkOnboarding': 'Fullfør organisasjonsoppsett',
  'dashboard.setup.orgLinkProfile': 'Profil og språk',
  'dashboard.setup.open': 'Oppsett',
  'dashboard.filters': 'Filter',
  'access.denied': 'Ingen tilgang',
}

const en: Bundle = {
  'shell.findAnything': 'Find anything',
  'shell.subnavHint': 'Choose a module above (Council, Org health, …)',
  'shell.logOut': 'Log out',
  'shell.logIn': 'Log in',
  'shell.upgrade': 'Upgrade',
  'shell.settingsAria': 'Settings and profile',
  'shell.externalAria': 'Open external link',
  'shell.userProfileAria': 'User profile',
  'shell.language': 'Language',
  'nav.council': 'Council',
  'nav.members': 'Members',
  'nav.orgHealth': 'Org health',
  'nav.hse': 'HSE',
  'nav.internalControl': 'Internal control',
  'nav.tasks': 'Tasks',
  'nav.learning': 'E-learning',
  'nav.admin': 'Admin',
  'profile.title': 'Profile & settings',
  'profile.subtitle': 'Language is stored in the database for this account.',
  'profile.displayName': 'Display name',
  'profile.locale': 'Interface language',
  'profile.save': 'Save',
  'profile.saving': 'Saving…',
  'profile.saved': 'Saved.',
  'profile.loadError': 'Could not load profile.',
  'profile.backHome': 'Back to home',
  'dashboard.setup.title': 'Layout & setup',
  'dashboard.setup.hint': 'Region filter, table density, and organization setup shortcut.',
  'dashboard.setup.region': 'Region',
  'dashboard.setup.regionAll': 'All',
  'dashboard.setup.regionUsa': 'USA',
  'dashboard.setup.regionEurope': 'Europe',
  'dashboard.setup.density': 'Table',
  'dashboard.setup.comfortable': 'Comfortable',
  'dashboard.setup.compact': 'Compact',
  'dashboard.setup.orgLink': 'Organization setup (Brønnøysund, structure)',
  'dashboard.setup.orgLinkOnboarding': 'Complete organization setup',
  'dashboard.setup.orgLinkProfile': 'Profile & language',
  'dashboard.setup.open': 'Setup',
  'dashboard.filters': 'Filters',
  'access.denied': 'Access denied',
}

export const STRINGS: Record<AppLocale, Bundle> = { nb, en }

export function translate(locale: AppLocale, key: string): string {
  return STRINGS[locale][key] ?? STRINGS.nb[key] ?? key
}
