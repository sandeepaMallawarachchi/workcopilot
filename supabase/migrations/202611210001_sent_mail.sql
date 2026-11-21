-- Opt-in read-only access to sent mail. Off by default; the owner turns it on
-- under Integrations → Email and can then grant it per contact ("email:sent").
alter table public.agent_settings
  add column email_sent_enabled boolean not null default false;

drop trigger if exists settings_audit on public.agent_settings;
create trigger settings_audit after update of ai_enabled, activation_prefix, followup_minutes, groq_model,
  max_tool_calls, language_behavior, response_length, context_messages, context_hours, retention_days,
  email_blocked_senders, verification_codes_enabled, verification_senders, shortcuts, voice_mode,
  email_sent_enabled
  on public.agent_settings for each row execute function public.audit_admin_change();
