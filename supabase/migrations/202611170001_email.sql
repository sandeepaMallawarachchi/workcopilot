-- Read-only email access over IMAP, plus the opt-in verification-codes feature.

create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces,
  label text not null check (length(label) between 1 and 40),
  address text not null check (length(address) between 3 and 254),
  host text not null check (host ~ '^[a-z0-9.-]+$'),
  port int not null default 993 check (port in (993)),
  username text not null check (length(username) between 1 and 254),
  status text not null default 'connected' check (status in ('connected', 'error')),
  error text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, address)
);

-- Encrypted passwords live in a separate table that dashboard sessions cannot
-- read at all (RLS on, no policies, no grants): only the service role can.
create table public.mailbox_secrets (
  mailbox_id uuid primary key references public.mailboxes on delete cascade,
  ciphertext text not null
);

alter table public.mailboxes enable row level security;
create policy admin_read on public.mailboxes for select to authenticated
  using (public.is_admin(workspace_id));
revoke all on public.mailboxes from anon, authenticated;
grant select on public.mailboxes to authenticated;
grant all on public.mailboxes to service_role;

alter table public.mailbox_secrets enable row level security;
revoke all on public.mailbox_secrets from anon, authenticated;
grant all on public.mailbox_secrets to service_role;

create trigger mailboxes_audit after insert or update or delete on public.mailboxes
  for each row execute function public.audit_admin_change();

-- Workspace-wide email rules.
alter table public.agent_settings
  add column email_blocked_senders text[] not null default '{}'
    check (cardinality(email_blocked_senders) <= 50),
  add column verification_codes_enabled boolean not null default false,
  add column verification_senders text[] not null default '{}'
    check (cardinality(verification_senders) <= 30);

drop trigger if exists settings_audit on public.agent_settings;
create trigger settings_audit after update of ai_enabled, activation_prefix, followup_minutes, groq_model,
  max_tool_calls, language_behavior, response_length, context_messages, context_hours, retention_days,
  email_blocked_senders, verification_codes_enabled, verification_senders
  on public.agent_settings for each row execute function public.audit_admin_change();
