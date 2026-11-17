-- Per-contact opt-in to view secrets and full private files (e.g. .env).
-- Off by default for everyone, including contacts with "All integrations".
alter table public.contacts
  add column can_view_secrets boolean not null default false;
