-- Spoken prefixes in voice notes ("AI, …", "GitHub, …"). Voice notes outside a
-- conversation are accepted provisionally and discarded (never kept, no reply)
-- when the transcript does not start with a prefix.
alter table public.messages add column needs_prefix boolean not null default false;

create or replace function public.accept_message(p_wa_id text,p_phone text,p_text text,p_sent_at timestamptz,p_media_id text default null) returns text language plpgsql security definer set search_path='' as $$
declare needs boolean:=false; s public.agent_settings; c public.contacts; conv uuid; mid uuid; jid uuid; qid bigint; prompt text; trimmed text; matched text; scope text; last_activity timestamptz;
begin
 select * into s from public.agent_settings where workspace_id='00000000-0000-0000-0000-000000000001';
 if not s.ai_enabled then return 'disabled'; end if;
 select * into c from public.contacts where workspace_id=s.workspace_id and phone=p_phone for update;
 if not found or not c.active or not c.ai_access then return 'unauthorized'; end if;
 -- Voice notes: allowed per settings and per contact; transcribed later by the worker.
 if p_media_id is not null then
  if s.voice_mode='off' or not c.can_send_voice then return 'voice_disabled'; end if;
  if length(p_media_id)>250 then return 'invalid'; end if;
 end if;
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
 if p_media_id is not null then
  -- A voice note continues the current conversation (and its shortcut) or, in
  -- 'always' mode, starts a new full-access one.
  select max(m.created_at) into last_activity from public.messages m join public.conversations cv on cv.id=m.conversation_id
   where cv.contact_id=c.id and m.created_at>cv.reset_at;
  if s.followup_minutes>0 and last_activity is not null and last_activity>=now()-make_interval(mins=>s.followup_minutes) then
   select m.shortcut into scope from public.messages m join public.conversations cv on cv.id=m.conversation_id
    where cv.contact_id=c.id and m.role='user' and m.created_at>cv.reset_at order by m.created_at desc limit 1;
  elsif s.voice_mode<>'always' then
   -- Outside a conversation: accept provisionally; the worker keeps it only if
   -- the transcript starts with a spoken prefix ("AI, …", "GitHub, …").
   needs:=true;
  end if;
  prompt:='🎙️ Voice note (transcribing…)';
 elsif matched is not null then
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
 insert into public.messages(workspace_id,conversation_id,role,content,whatsapp_message_id,whatsapp_sent_at,shortcut,media_id,voice,needs_prefix) values(s.workspace_id,conv,'user',prompt,p_wa_id,p_sent_at,scope,p_media_id,p_media_id is not null,needs) on conflict(whatsapp_message_id) do nothing returning id into mid;
 if mid is null then return 'duplicate'; end if;
 insert into public.agent_jobs(workspace_id,message_id) values(s.workspace_id,mid) returning id into jid;
 select pgmq.send('ai_messages',jsonb_build_object('job_id',jid)) into qid;
 update public.agent_jobs set queue_id=qid where id=jid;
 update public.contacts set last_activity=now(),updated_at=now() where id=c.id;
 insert into public.audit_logs(workspace_id,event,entity_id) values(s.workspace_id,'message.accepted',mid::text);
 return 'accepted';
end $$;

-- Deletes a provisional voice note and its job, releasing the queue entry and
-- the global worker lease exactly like finish_job does.
create function public.discard_message(p_job uuid, p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.agent_jobs;
begin
  select * into j from public.agent_jobs where id = p_job for update;
  if j.lease_token is distinct from p_token or j.lease_until < now() then
    raise exception 'Stale lease';
  end if;
  if not exists (select 1 from public.messages where id = j.message_id and needs_prefix) then
    raise exception 'Only provisional voice notes can be discarded';
  end if;
  perform pgmq.archive('ai_messages', j.queue_id);
  update public.agent_settings set worker_until = null where workspace_id = j.workspace_id;
  delete from public.messages where id = j.message_id; -- cascades to the job
  insert into public.audit_logs(workspace_id, event, entity_id)
    values (j.workspace_id, 'message.discarded', j.message_id::text);
end $$;

revoke all on function public.accept_message(text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.accept_message(text,text,text,timestamptz,text) to service_role;
revoke all on function public.discard_message(uuid,uuid) from public, anon, authenticated;
grant execute on function public.discard_message(uuid,uuid) to service_role;
