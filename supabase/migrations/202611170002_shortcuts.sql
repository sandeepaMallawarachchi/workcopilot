-- Prefix shortcuts (e.g. @github, @email) that limit the agent to chosen tasks,
-- and a one-time WhatsApp welcome for new contacts.

alter table public.agent_settings
  add column shortcuts jsonb not null default '[]'
    check (jsonb_typeof(shortcuts) = 'array' and jsonb_array_length(shortcuts) <= 10);

-- Which shortcut started this request (null = main prefix, full access).
alter table public.messages add column shortcut text;

alter table public.contacts add column welcomed_at timestamptz;

create or replace function public.accept_message(p_wa_id text,p_phone text,p_text text,p_sent_at timestamptz) returns text language plpgsql security definer set search_path='' as $$
declare s public.agent_settings; c public.contacts; conv uuid; mid uuid; jid uuid; qid bigint; prompt text; trimmed text; matched text; scope text; last_activity timestamptz;
begin
 select * into s from public.agent_settings where workspace_id='00000000-0000-0000-0000-000000000001';
 if not s.ai_enabled then return 'disabled'; end if;
 select * into c from public.contacts where workspace_id=s.workspace_id and phone=p_phone for update;
 if not found or not c.active or not c.ai_access then return 'unauthorized'; end if;
 if p_sent_at < now()-interval '23 hours' or p_sent_at>now()+interval '5 minutes' then return 'expired'; end if;
 trimmed:=regexp_replace(p_text,'^\s+','');
 -- Longest matching prefix wins (main prefix or any shortcut), case-insensitive,
 -- and it must be followed by whitespace.
 select p into matched from (
   select s.activation_prefix p
   union all
   select x->>'prefix' from jsonb_array_elements(s.shortcuts) x where x->>'prefix' ~ '^@[a-zA-Z]{1,12}$'
 ) prefixes
 where lower(left(trimmed,length(p)))=lower(p) and substring(trimmed from length(p)+1 for 1) ~ '^\s$'
 order by length(p) desc limit 1;
 if matched is not null then
  prompt:=btrim(substring(trimmed from length(matched)+1));
  scope:=case when lower(matched)=lower(s.activation_prefix) then null else lower(matched) end;
 else
  -- Follow-up window: continue the latest conversation, keeping its shortcut.
  if s.followup_minutes=0 then return 'not_activated'; end if;
  select max(m.created_at) into last_activity from public.messages m join public.conversations cv on cv.id=m.conversation_id
   where cv.contact_id=c.id and m.created_at>cv.reset_at;
  if last_activity is null or last_activity<now()-make_interval(mins=>s.followup_minutes) then return 'not_activated'; end if;
  select m.shortcut into scope from public.messages m join public.conversations cv on cv.id=m.conversation_id
   where cv.contact_id=c.id and m.role='user' and m.created_at>cv.reset_at order by m.created_at desc limit 1;
  prompt:=btrim(trimmed);
 end if;
 if length(prompt)=0 or length(prompt)>8000 then return 'empty_or_too_long'; end if;
 if exists(select 1 from public.messages where whatsapp_message_id=p_wa_id) then return 'duplicate'; end if;
 if (select count(*) from public.messages m join public.conversations cv on cv.id=m.conversation_id where cv.contact_id=c.id and m.role='user' and m.created_at>now()-interval '1 minute')>=5 then return 'rate_limited'; end if;
 insert into public.conversations(workspace_id,contact_id) values(s.workspace_id,c.id) on conflict(contact_id) do update set contact_id=excluded.contact_id returning id into conv;
 insert into public.messages(workspace_id,conversation_id,role,content,whatsapp_message_id,whatsapp_sent_at,shortcut) values(s.workspace_id,conv,'user',prompt,p_wa_id,p_sent_at,scope) on conflict(whatsapp_message_id) do nothing returning id into mid;
 if mid is null then return 'duplicate'; end if;
 insert into public.agent_jobs(workspace_id,message_id) values(s.workspace_id,mid) returning id into jid;
 select pgmq.send('ai_messages',jsonb_build_object('job_id',jid)) into qid;
 update public.agent_jobs set queue_id=qid where id=jid;
 update public.contacts set last_activity=now(),updated_at=now() where id=c.id;
 insert into public.audit_logs(workspace_id,event,entity_id) values(s.workspace_id,'message.accepted',mid::text);
 return 'accepted';
end $$;

drop trigger if exists settings_audit on public.agent_settings;
create trigger settings_audit after update of ai_enabled, activation_prefix, followup_minutes, groq_model,
  max_tool_calls, language_behavior, response_length, context_messages, context_hours, retention_days,
  email_blocked_senders, verification_codes_enabled, verification_senders, shortcuts
  on public.agent_settings for each row execute function public.audit_admin_change();
