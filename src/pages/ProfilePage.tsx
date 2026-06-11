import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Download,
  Home,
  KeyRound,
  LayoutGrid,
  Loader2,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { useT } from '../hooks/useT'
import { LanguageDropdown } from '../components/LanguageDropdown'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { mergeNotificationPreferences, parseNotificationPreferences } from '../lib/notificationPreferences'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type { NotificationPreferences } from '../types/notifications'
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { ToggleSwitch } from '../components/ui/FormToggles'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'

const CARD = 'rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm'
const AVATAR_BUCKET = 'profile_avatars'

function initialsFromName(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { t } = useT()
  const {
    user,
    profile,
    supabase,
    supabaseConfigured,
    organization,
    members,
    departments,
    updateDepartmentId,
    updateLearningMetadata,
    updateProfileFields,
    updateNotificationPreferences,
    updatePassword,
  } = useOrgSetupContext()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [deptId, setDeptId] = useState<string>('')
  const [safetyRep, setSafetyRep] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')

  const [busyProfile, setBusyProfile] = useState(false)
  const [busyPw, setBusyPw] = useState(false)
  const [busyAvatar, setBusyAvatar] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() =>
    parseNotificationPreferences(undefined),
  )
  const [busyNotif, setBusyNotif] = useState(false)
  const [notifMsg, setNotifMsg] = useState<string | null>(null)
  const [notifErr, setNotifErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? '')
      setPhone(profile.phone?.trim() ?? '')
      setJobTitle(profile.job_title?.trim() ?? '')
      setDeptId(profile.department_id ?? '')
      const lm = profile.learning_metadata as Record<string, unknown> | null | undefined
      setSafetyRep(lm?.is_safety_rep === true)
    }
  }, [profile])

  useEffect(() => {
    setNotifPrefs(parseNotificationPreferences(profile?.notification_preferences))
  }, [profile?.notification_preferences])

  const email = user?.email ?? profile?.email ?? ''

  const displayAvatarUrl = profile?.avatar_url?.trim() || null

  const saveProfile = async () => {
    if (!supabaseConfigured || !user) return
    setBusyProfile(true)
    setErr(null)
    setMsg(null)
    try {
      await updateProfileFields({
        display_name: name.trim() || profile?.display_name || 'Bruker',
        phone: phone.trim() || null,
        job_title: jobTitle.trim() || null,
      })
      await updateDepartmentId(deptId || null)
      await updateLearningMetadata({ is_safety_rep: safetyRep })
      setMsg(t('profile.saved'))
    } catch (e) {
      setErr(getSupabaseErrorMessage(e))
    } finally {
      setBusyProfile(false)
    }
  }

  const saveNotificationPrefs = async () => {
    setBusyNotif(true)
    setNotifErr(null)
    setNotifMsg(null)
    try {
      await updateNotificationPreferences(notifPrefs)
      setNotifMsg('Varslingsinnstillinger lagret.')
    } catch (e) {
      setNotifErr(getSupabaseErrorMessage(e))
    } finally {
      setBusyNotif(false)
    }
  }

  const savePassword = async () => {
    setPwErr(null)
    setPwMsg(null)
    if (pw1 !== pw2) {
      setPwErr(t('profile.passwordMismatch'))
      return
    }
    setBusyPw(true)
    try {
      await updatePassword(pw1)
      setPw1('')
      setPw2('')
      setPwMsg(t('profile.passwordSaved'))
    } catch (e) {
      setPwErr(getSupabaseErrorMessage(e))
    } finally {
      setBusyPw(false)
    }
  }

  const removeAvatarFiles = useCallback(async () => {
    if (!supabase || !user) return
    const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(user.id)
    if (files?.length) {
      const paths = files.map((f: { name: string }) => `${user.id}/${f.name}`)
      await supabase.storage.from(AVATAR_BUCKET).remove(paths)
    }
  }, [supabase, user])

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !supabase || !user) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setErr('Bruk JPG, PNG, WebP eller GIF.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setErr('Filen er for stor (maks 2 MB).')
      return
    }
    setBusyAvatar(true)
    setErr(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      const safeExt = ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
      const path = `${user.id}/avatar.${safeExt}`
      await removeAvatarFiles()
      const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type,
      })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      const url = pub.publicUrl
      await updateProfileFields({ avatar_url: url })
      setMsg(t('profile.saved'))
    } catch (e) {
      setErr(getSupabaseErrorMessage(e))
    } finally {
      setBusyAvatar(false)
    }
  }

  const removeAvatar = async () => {
    if (!supabase || !user) return
    setBusyAvatar(true)
    setErr(null)
    try {
      await removeAvatarFiles()
      await updateProfileFields({ avatar_url: null })
      setMsg(t('profile.saved'))
    } catch (e) {
      setErr(getSupabaseErrorMessage(e))
    } finally {
      setBusyAvatar(false)
    }
  }

  const orgInitials = useMemo(() => {
    const n = organization?.name ?? profile?.display_name ?? '?'
    return n.slice(0, 2).toUpperCase()
  }, [organization?.name, profile?.display_name])

  type ProfileNavSection = 'overview' | 'photo' | 'personalia' | 'notifications' | 'password'
  const [profileSection, setProfileSection] = useState<ProfileNavSection>('overview')

  const scrollToProfileSection = useCallback((id: string, section: ProfileNavSection) => {
    setProfileSection(section)
    queueMicrotask(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [])

  const profileHubItems: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'overview',
        label: 'Oversikt',
        icon: LayoutGrid,
        active: profileSection === 'overview',
        onClick: () => scrollToProfileSection('profile-top', 'overview'),
      },
      {
        key: 'photo',
        label: t('profile.sectionPhoto'),
        icon: Camera,
        active: profileSection === 'photo',
        onClick: () => scrollToProfileSection('profile-photo', 'photo'),
      },
      {
        key: 'personalia',
        label: t('profile.sectionPersonalia'),
        icon: User,
        active: profileSection === 'personalia',
        onClick: () => scrollToProfileSection('profile-personalia', 'personalia'),
      },
      {
        key: 'notifications',
        label: 'Varsler',
        icon: Bell,
        active: profileSection === 'notifications',
        onClick: () => scrollToProfileSection('profile-notifications', 'notifications'),
      },
      {
        key: 'password',
        label: t('profile.sectionPassword'),
        icon: KeyRound,
        active: profileSection === 'password',
        onClick: () => scrollToProfileSection('profile-password', 'password'),
      },
    ],
    [profileSection, scrollToProfileSection, t],
  )

  const profileHomeHub: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'workspace',
        label: 'Hjem',
        icon: Home,
        active: false,
        onClick: () => navigate('/'),
      },
      {
        key: 'profile',
        label: t('profile.breadcrumb'),
        icon: User,
        active: true,
        onClick: () => scrollToProfileSection('profile-top', 'overview'),
      },
    ],
    [navigate, scrollToProfileSection, t],
  )

  if (!supabaseConfigured) {
    return (
      <PageContainer py="py-6">
        <p className="text-neutral-600">Supabase er ikke konfigurert.</p>
      </PageContainer>
    )
  }

  if (!user) {
    return (
      <PageContainer py="py-6">
        <p className="text-neutral-600">
          <Link to="/login" className="text-[#1a3d32] underline">
            {t('shell.logIn')}
          </Link>
        </p>
      </PageContainer>
    )
  }

  return (
    <PageContainer py="py-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: t('profile.breadcrumb') }]}
        title={t('profile.title')}
        description={
          <>
            <p className="max-w-2xl leading-relaxed">{t('profile.heroLead')}</p>
            <p className="mt-2 text-xs text-neutral-500">{email}</p>
          </>
        }
        headerActions={
          <div className="relative shrink-0">
            {displayAvatarUrl ? (
              <img
                src={displayAvatarUrl}
                alt=""
                className="size-24 rounded-2xl border border-neutral-200/90 object-cover shadow-sm"
              />
            ) : (
              <div className="flex size-24 items-center justify-center rounded-2xl bg-[#1a3d32] text-2xl font-bold text-[#c9a227]">
                {initialsFromName(name || profile?.display_name || '??')}
              </div>
            )}
            {busyAvatar ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
                <Loader2 className="size-8 animate-spin text-[#1a3d32]" />
              </div>
            ) : null}
          </div>
        }
        menu={
          <div className="space-y-3">
            <HubMenu1Bar ariaLabel="Workspace — navigasjon" items={profileHomeHub} />
            <HubMenu1Bar ariaLabel="Profil — seksjoner" items={profileHubItems} />
          </div>
        }
      />

      <div id="profile-top" className="mt-8 grid scroll-mt-28 gap-8 lg:grid-cols-[1fr_340px] lg:gap-10">
        <div className="space-y-8">
          {/* Photo */}
          <section id="profile-photo" className="scroll-mt-28">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">{t('profile.sectionPhoto')}</h2>
            <div className={CARD}>
              <p className="text-sm text-neutral-600">{t('profile.sectionPhotoHint')}</p>
              {/* Hidden file picker; visible UI is the Button below. */}
              {/* eslint-disable-next-line no-restricted-syntax */}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => void onPickFile(e)} />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  disabled={busyAvatar}
                  onClick={() => fileRef.current?.click()}
                  icon={<Camera className="size-4" />}
                  className="rounded-full"
                >
                  {t('profile.upload')}
                </Button>
                {displayAvatarUrl ? (
                  <Button
                    variant="secondary"
                    disabled={busyAvatar}
                    onClick={() => void removeAvatar()}
                    icon={<Trash2 className="size-4" />}
                    className="rounded-full border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                  >
                    {t('profile.removePhoto')}
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          {/* Personalia + prefs */}
          <section id="profile-personalia" className="scroll-mt-28">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">{t('profile.sectionPersonalia')}</h2>
            <div className={`${CARD} space-y-4`}>
              <div>
                <label className="text-sm font-medium text-neutral-800">{t('profile.displayName')}</label>
                <StandardInput value={name} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-lg" autoComplete="name" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-800">{t('profile.email')}</label>
                <StandardInput value={email} readOnly className="mt-1 rounded-lg bg-neutral-50 text-neutral-600" />
                <p className="mt-1 text-xs text-neutral-500">{t('profile.emailReadonly')}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-neutral-800">{t('profile.phone')}</label>
                  <StandardInput
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 rounded-lg"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+47 …"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-800">{t('profile.jobTitle')}</label>
                  <StandardInput value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="mt-1 rounded-lg" placeholder="f.eks. HMS-koordinator" />
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4">
                <h3 className="text-base font-semibold text-neutral-900">{t('profile.sectionPrefs')}</h3>
                <div className="mt-3 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-800">{t('profile.locale')}</label>
                    <div className="mt-1">
                      <LanguageDropdown variant="page" />
                    </div>
                  </div>
                  {departments.length > 0 ? (
                    <div>
                      <label className="text-sm font-medium text-neutral-800">Avdeling (e-læring / statistikk)</label>
                      <div className="mt-1">
                        <SearchableSelect
                          value={deptId}
                          options={[
                            { value: '', label: '— Ikke valgt —' },
                            ...departments.map((d) => ({ value: d.id, label: d.name })),
                          ]}
                          onChange={setDeptId}
                        />
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Brukes til avdelingsbasert tavle i E-læring (ingen individuell rangering).
                      </p>
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3 text-sm font-medium text-neutral-800">
                    <ToggleSwitch
                      checked={safetyRep}
                      onChange={setSafetyRep}
                      label="HMS-representant / sikkerhetsrolle"
                    />
                    <span>
                      HMS-representant / sikkerhetsrolle
                      <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                        Brukes til læringsløp og tilganger når organisasjonen har satt opp regler.
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {err ? <p className="text-sm text-red-700">{err}</p> : null}
              {msg ? <p className="text-sm text-emerald-800">{msg}</p> : null}
              <Button
                variant="primary"
                onClick={() => void saveProfile()}
                disabled={busyProfile}
                icon={busyProfile ? <Loader2 className="size-4 animate-spin" /> : undefined}
                className="rounded-full"
              >
                {busyProfile ? t('profile.savingPersonalia') : t('profile.savePersonalia')}
              </Button>
            </div>
          </section>

          {/* Notifications */}
          <section id="profile-notifications" className="scroll-mt-28">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900">
              <Bell className="size-5 text-neutral-500" />
              Varsler
            </h2>
            <div className={`${CARD} space-y-5`}>
              <p className="text-sm text-neutral-600">
                Velg hvilke hendelser du vil følge med på. I appen vises et varselikon med ulest antall; du kan også få
                popup øverst når nye varsler dukker opp. E-post og webhook krever at plattformen er konfigurert med
                utsending (lagres her som preferanser).
              </p>

              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Kanaler</h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-start gap-3 text-sm text-neutral-800">
                    <ToggleSwitch
                      checked={notifPrefs.channels.inApp}
                      onChange={(v) =>
                        setNotifPrefs((p) =>
                          mergeNotificationPreferences(p, {
                            channels: { ...p.channels, inApp: v },
                          }),
                        )
                      }
                      label="I appen"
                    />
                    <span>
                      I appen (ikon + liste)
                      <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                        Anbefalt — varsler genereres fra oppgaver og varslingssaker du har tilgang til.
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-neutral-800">
                    <ToggleSwitch
                      checked={notifPrefs.channels.email}
                      onChange={(v) =>
                        setNotifPrefs((p) =>
                          mergeNotificationPreferences(p, {
                            channels: { ...p.channels, email: v },
                          }),
                        )
                      }
                      label="E-post"
                    />
                    <span>
                      E-post
                      <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                        Sendes til {email || 'din profil-e-post'} når utsending er aktivert i drift.
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-neutral-800">
                    <ToggleSwitch
                      checked={notifPrefs.channels.webhook}
                      onChange={(v) =>
                        setNotifPrefs((p) =>
                          mergeNotificationPreferences(p, {
                            channels: { ...p.channels, webhook: v },
                          }),
                        )
                      }
                      label="Webhook"
                    />
                    <span>
                      Webhook (HTTPS)
                      <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                        POST med JSON til din URL (f.eks. Zapier, n8n, Microsoft Power Automate).
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {notifPrefs.channels.webhook ? (
                <div className="grid gap-3 sm:grid-cols-1">
                  <div>
                    <label className="text-sm font-medium text-neutral-800">Webhook-URL</label>
                    <StandardInput
                      value={notifPrefs.webhookUrl ?? ''}
                      onChange={(e) =>
                        setNotifPrefs((p) => mergeNotificationPreferences(p, { webhookUrl: e.target.value }))
                      }
                      className="mt-1 rounded-lg"
                      placeholder="https://…"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-800">Delt hemmelighet (valgfritt)</label>
                    <StandardInput
                      type="password"
                      value={notifPrefs.webhookSecret ?? ''}
                      onChange={(e) =>
                        setNotifPrefs((p) => mergeNotificationPreferences(p, { webhookSecret: e.target.value }))
                      }
                      className="mt-1 rounded-lg"
                      placeholder="Sendes som X-Notification-Secret"
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Hva vil du varsles om?</h3>
                <div className="mt-2 space-y-2">
                  {(
                    [
                      ['tasks_sign', 'Oppgaver — signatur / godkjenning'],
                      ['tasks_due', 'Oppgaver — frist nær (7 dager)'],
                      ['whistle', 'Varslingssaker (komité/admin)'],
                      ['compliance', 'Samsvar / revisjon (kommer)'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-start gap-3 text-sm text-neutral-800">
                      <ToggleSwitch
                        checked={notifPrefs.categories[key]}
                        onChange={(v) =>
                          setNotifPrefs((p) =>
                            mergeNotificationPreferences(p, {
                              categories: { ...p.categories, [key]: v },
                            }),
                          )
                        }
                        label={label}
                      />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks-due digest cadence (H2.5) — only meaningful when the
                  tasks_due category + email channel are on. */}
              {notifPrefs.categories.tasks_due ? (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                  <h3 className="text-sm font-semibold text-neutral-900">Oppgavefrist-påminnelser på e-post</h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Én samle-e-post med dine oppgaver som nærmer seg frist eller er forfalt.
                    Krever at e-postkanalen over er slått på.
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Frekvens</p>
                      <div className="mt-1 flex gap-1.5">
                        {(
                          [
                            ['daily', 'Daglig'],
                            ['weekly', 'Ukentlig'],
                          ] as const
                        ).map(([val, label]) => (
                          <Button
                            key={val}
                            size="sm"
                            variant={notifPrefs.taskDigestFrequency === val ? 'primary' : 'secondary'}
                            onClick={() =>
                              setNotifPrefs((p) =>
                                mergeNotificationPreferences(p, { taskDigestFrequency: val }),
                              )
                            }
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-neutral-800">
                      <ToggleSwitch
                        checked={notifPrefs.taskDigestPreDue}
                        onChange={(v) =>
                          setNotifPrefs((p) => mergeNotificationPreferences(p, { taskDigestPreDue: v }))
                        }
                        label="Varsle før frist"
                      />
                      <span>
                        Varsle 3 dager før frist
                        <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                          Av = kun varsel når oppgaven er forfalt.
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-3 text-sm text-neutral-800">
                <ToggleSwitch
                  checked={notifPrefs.toastEnabled}
                  onChange={(v) =>
                    setNotifPrefs((p) => mergeNotificationPreferences(p, { toastEnabled: v }))
                  }
                  label="Popup øverst"
                />
                <span>
                  Popup øverst på skjermen ved nye uleste varsler
                  <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                    Kort banner med lenke til innholdet. Slå av hvis du foretrekker kun ikonet.
                  </span>
                </span>
              </div>

              {notifErr ? <p className="text-sm text-red-700">{notifErr}</p> : null}
              {notifMsg ? <p className="text-sm text-emerald-800">{notifMsg}</p> : null}
              <Button
                variant="primary"
                onClick={() => void saveNotificationPrefs()}
                disabled={busyNotif}
                icon={busyNotif ? <Loader2 className="size-4 animate-spin" /> : undefined}
                className="rounded-full"
              >
                {busyNotif ? 'Lagrer…' : 'Lagre varslingsinnstillinger'}
              </Button>
            </div>
          </section>

          {/* Password */}
          <section id="profile-password" className="scroll-mt-28">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900">
              <KeyRound className="size-5 text-neutral-500" />
              {t('profile.sectionPassword')}
            </h2>
            <div className={CARD}>
              <p className="text-sm text-neutral-600">{t('profile.passwordHint')}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-neutral-800">{t('profile.passwordNew')}</label>
                  <StandardInput
                    type="password"
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    className="mt-1 rounded-lg"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-800">{t('profile.passwordConfirm')}</label>
                  <StandardInput
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    className="mt-1 rounded-lg"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {pwErr ? <p className="mt-2 text-sm text-red-700">{pwErr}</p> : null}
              {pwMsg ? <p className="mt-2 text-sm text-emerald-800">{pwMsg}</p> : null}
              <Button
                variant="secondary"
                onClick={() => void savePassword()}
                disabled={busyPw || !pw1}
                icon={busyPw ? <Loader2 className="size-4 animate-spin" /> : undefined}
                className="mt-4 rounded-full"
              >
                {t('profile.passwordSave')}
              </Button>
            </div>
          </section>

          {/* GDPR self-service export (H3.8) — Art. 15/20 */}
          <section id="profile-gdpr" className="scroll-mt-28">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900">
              <Download className="size-5 text-neutral-500" />
              Mine data (GDPR)
            </h2>
            <div className={CARD}>
              <p className="text-sm text-neutral-600">
                Last ned en kopi av personopplysningene plattformen har om deg: profil,
                organisasjonstilknytning, roller og oppgaver du er ansvarlig for (GDPR art. 15
                og 20). Sletting håndteres av administrator.
              </p>
              <Button
                variant="secondary"
                className="mt-4 rounded-full"
                icon={<Download className="size-4" />}
                onClick={() => {
                  void (async () => {
                    if (!supabase) return
                    const { data, error } = await supabase.rpc('gdpr_export_my_data')
                    if (error || !data) return
                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                      type: 'application/json',
                    })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `mine-data-${new Date().toISOString().slice(0, 10)}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  })()
                }}
              >
                Last ned mine data (JSON)
              </Button>
            </div>
          </section>
        </div>

        {/* Account sidebar */}
        <aside className="space-y-6">
          <div className={CARD}>
            <h3 className="text-base font-semibold text-neutral-900">{t('profile.sectionAccount')}</h3>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#1a3d32] text-sm font-bold text-[#c9a227]">
                {orgInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('profile.accountOrg')}</p>
                <p className="font-medium text-neutral-900">{organization ? organization.name : t('profile.accountNoOrg')}</p>
                {organization?.organization_number ? (
                  <p className="mt-1 text-xs text-neutral-500">Org.nr. {organization.organization_number}</p>
                ) : null}
              </div>
            </div>
            <Link
              to="/organisation"
              className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50"
            >
              <span className="flex items-center gap-2">
                <Building2 className="size-4 shrink-0" />
                {t('profile.linkOrganisation')}
              </span>
              <ChevronRight className="size-4 shrink-0 opacity-50" />
            </Link>
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
              <Users className="size-4 text-neutral-400" />
              <span>
                {t('profile.accountMembers')}: <strong className="text-neutral-900">{members.length}</strong>
              </span>
            </div>
            <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-500">
              <span className="font-mono">ID: {user.id.slice(0, 8)}…</span>
            </div>
          </div>

          <div className={`${CARD} border-emerald-100 bg-emerald-50/40`}>
            <div className="flex gap-2">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-neutral-900">Tips</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Bruk et visningsnavn som kollegene dine kjenner igjen. Passord lagres hos innloggingsleverandøren og sendes ikke i klartekst til oss.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#1a3d32] underline-offset-2 hover:underline">
          <User className="size-4" />
          {t('profile.backHome')}
        </Link>
      </div>
    </PageContainer>
  )
}
