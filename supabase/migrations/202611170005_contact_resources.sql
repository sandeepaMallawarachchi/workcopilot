-- Per-contact resource limits within what each integration allows.
-- Shape: {"github": ["owner/repo", ...], "gitlab": ["group/project", ...], "mailboxes": ["<uuid>", ...]}
-- A missing key means "all"; an empty list means "none".
alter table public.contacts
  add column resources jsonb not null default '{}'
    check (jsonb_typeof(resources) = 'object');
