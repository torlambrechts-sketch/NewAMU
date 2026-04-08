-- Per-user notification preferences (in-app, email flags, webhook URL, category toggles).
alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.notification_preferences is
  'JSON: channels (inApp, email, webhook), webhookUrl, webhookSecret, category toggles, toastEnabled. Delivery for email/webhook requires backend jobs.';
