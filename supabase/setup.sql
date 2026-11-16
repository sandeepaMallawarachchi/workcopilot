-- GENERATED: run npm run db:bundle to rebuild from supabase/migrations.
-- Fresh Supabase project setup using the dashboard SQL Editor.
-- Run the ENTIRE file once, as the project's database administrator.
-- This installs the full schema; it does not create an Auth user or password.
-- Use either this setup file OR CLI db push for initial provisioning.
-- If this file is used, see docs/DEPLOYMENT.md before future CLI migrations.

begin;

do $$
begin
  if to_regclass('public.profiles') is not null or to_regclass('public.workspaces') is not null then
    raise exception 'Application tables already exist. Do not rerun fresh setup; inspect migration history instead.';
  end if;
end $$;

-- Migration: 202611150001_foundation.sql
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgmq;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create table public.workspaces(id uuid primary key default gen_random_uuid(), name text not null);
insert into public.workspaces(id,name) values ('00000000-0000-0000-0000-000000000001','Personal workspace');
create table public.profiles(id uuid primary key references auth.users on delete cascade,workspace_id uuid not null references public.workspaces, email text not null,created_at timestamptz not null default now());
create function public.is_admin(w uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and workspace_id=w) $$;
create table public.agent_settings(
 workspace_id uuid primary key references public.workspaces,ai_enabled boolean not null default false, activation_prefix text not null default '@ai' check(activation_prefix ~ '^@[a-zA-Z]{1,12}$'),activation_mode text not null default 'prefix' check(activation_mode='prefix'),groq_model text not null default '',max_tool_calls int not null default 6 check(max_tool_calls between 1 and 10),language_behavior text not null default 'match' check(language_behavior in ('match','English','Sinhala','Singlish')),response_length int not null default 2000 check(response_length between 200 and 6000),context_messages int not null default 12 check(context_messages between 0 and 20),context_hours int not null default 24 check(context_hours between 1 and 168),retention_days int not null default 30 check(retention_days between 1 and 365),worker_until timestamptz,updated_at timestamptz not null default now());
insert into public.agent_settings(workspace_id) values ('00000000-0000-0000-0000-000000000001');
create table public.contacts(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces,display_name text not null check(length(display_name) between 1 and 100),phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),active boolean not null default true,ai_access boolean not null default false,activation_mode text not null default 'prefix' check(activation_mode='prefix'),preferred_language text check(preferred_language in ('English','Sinhala','Singlish')),last_activity timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(workspace_id,phone),unique(id,workspace_id));
create table public.conversations(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces,contact_id uuid not null unique,created_at timestamptz not null default now(),reset_at timestamptz not null default now(),foreign key(contact_id,workspace_id) references public.contacts(id,workspace_id) on delete cascade,unique(id,workspace_id));
create table public.messages(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces,conversation_id uuid not null,role text not null check(role in ('user','assistant')),content text not null check(length(content)<=12000),whatsapp_message_id text unique,whatsapp_sent_at timestamptz,sources jsonb not null default '[]',created_at timestamptz not null default now(),foreign key(conversation_id,workspace_id) references public.conversations(id,workspace_id) on delete cascade);
create index messages_history on public.messages(conversation_id,created_at desc);
create table public.integrations(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces,provider text not null check(provider in ('github','gitlab')),status text not null default 'disconnected' check(status in ('connected','disconnected','error')),account text,allowed_repositories text[] not null default '{}',last_sync_at timestamptz,error text,unique(workspace_id,provider));
insert into public.integrations(workspace_id,provider) values ('00000000-0000-0000-0000-000000000001','github'),('00000000-0000-0000-0000-000000000001','gitlab');
create table public.agent_jobs(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces,message_id uuid not null unique references public.messages on delete cascade,status text not null default 'queued' check(status in ('queued','processing','retry','completed','dead','manual_review')),attempts int not null default 0,max_attempts int not null default 3,queue_id bigint,lease_token uuid,lease_until timestamptz,error text,started_at timestamptz,finished_at timestamptz,created_at timestamptz not null default now());
create index jobs_pending on public.agent_jobs(status,created_at);
create table public.delivery_outbox(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces,job_id uuid not null references public.agent_jobs on delete cascade,part int not null,recipient text not null,body text not null check(length(body)<=3500),status text not null default 'pending' check(status in ('pending','sending','sent','failed','manual_review')),whatsapp_message_id text unique,error text,updated_at timestamptz not null default now(),unique(job_id,part));
create table public.tool_executions(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces,job_id uuid not null references public.agent_jobs on delete cascade,tool text not null,outcome text not null,duration_ms int not null,summary text,created_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces,actor_id uuid,event text not null,entity_id text,details jsonb not null default '{}',created_at timestamptz not null default now());
create index audit_recent on public.audit_logs(workspace_id,created_at desc);
create function public.audit_admin_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(workspace_id,actor_id,event,entity_id) values(coalesce(new.workspace_id,old.workspace_id),auth.uid(),tg_table_name||'.'||lower(tg_op),coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'workspace_id'));
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger contacts_audit after insert or update or delete on public.contacts for each row execute function public.audit_admin_change();
create trigger settings_audit after update of ai_enabled,activation_prefix,groq_model,max_tool_calls,language_behavior,response_length,context_messages,context_hours,retention_days on public.agent_settings for each row execute function public.audit_admin_change();
create trigger integrations_audit after update on public.integrations for each row execute function public.audit_admin_change();
-- Only trusted, manually provisioned profile rows confer access; no signup trigger.
do $$ declare t text; begin
 foreach t in array array['workspaces','profiles','contacts','conversations','messages','integrations','agent_jobs','delivery_outbox','tool_executions','agent_settings','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 if t='workspaces' then execute 'create policy admin_read on public.workspaces for select to authenticated using(public.is_admin(id))';
 else execute format('create policy admin_read on public.%I for select to authenticated using(public.is_admin(workspace_id))',t); end if;
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
-- Mutations are authenticated Next.js server actions using a server-only key after getUser + profile verification.
select pgmq.create('ai_messages');
select pgmq.create('ai_dead_letters');
create function public.accept_message(p_wa_id text,p_phone text,p_text text,p_sent_at timestamptz) returns text language plpgsql security definer set search_path='' as $$
declare s public.agent_settings; c public.contacts; conv uuid; mid uuid; jid uuid; qid bigint; prompt text; trimmed text;
begin
 select * into s from public.agent_settings where workspace_id='00000000-0000-0000-0000-000000000001';
 if not s.ai_enabled then return 'disabled'; end if;
 select * into c from public.contacts where workspace_id=s.workspace_id and phone=p_phone for update;
 if not found or not c.active or not c.ai_access then return 'unauthorized'; end if;
 if p_sent_at < now()-interval '23 hours' or p_sent_at>now()+interval '5 minutes' then return 'expired'; end if;
 trimmed:=regexp_replace(p_text,'^\s+','');
 if lower(left(trimmed,length(s.activation_prefix)))<>lower(s.activation_prefix) or substring(trimmed from length(s.activation_prefix)+1 for 1) !~ '^\s$' then return 'not_activated'; end if;
 prompt:=btrim(substring(trimmed from length(s.activation_prefix)+1));
 if length(prompt)=0 or length(prompt)>8000 then return 'empty_or_too_long'; end if;
 if exists(select 1 from public.messages where whatsapp_message_id=p_wa_id) then return 'duplicate'; end if;
 if (select count(*) from public.messages m join public.conversations cv on cv.id=m.conversation_id where cv.contact_id=c.id and m.role='user' and m.created_at>now()-interval '1 minute')>=5 then return 'rate_limited'; end if;
 insert into public.conversations(workspace_id,contact_id) values(s.workspace_id,c.id) on conflict(contact_id) do update set contact_id=excluded.contact_id returning id into conv;
 insert into public.messages(workspace_id,conversation_id,role,content,whatsapp_message_id,whatsapp_sent_at) values(s.workspace_id,conv,'user',prompt,p_wa_id,p_sent_at) on conflict(whatsapp_message_id) do nothing returning id into mid;
 if mid is null then return 'duplicate'; end if;
 insert into public.agent_jobs(workspace_id,message_id) values(s.workspace_id,mid) returning id into jid;
 select pgmq.send('ai_messages',jsonb_build_object('job_id',jid)) into qid;
 update public.agent_jobs set queue_id=qid where id=jid;
 update public.contacts set last_activity=now(),updated_at=now() where id=c.id;
 insert into public.audit_logs(workspace_id,event,entity_id) values(s.workspace_id,'message.accepted',mid::text);
 return 'accepted';
end $$;
-- One leased consumer globally for Phase 1. Queue visibility exceeds the 110s worker deadline.
create function public.claim_job() returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.agent_settings; q record; j public.agent_jobs; token uuid:=gen_random_uuid();
begin
 select * into s from public.agent_settings where workspace_id='00000000-0000-0000-0000-000000000001' for update;
 if not s.ai_enabled or s.worker_until>now() then return null; end if;
 select * into q from pgmq.read('ai_messages',180,1);
 if not found then return null; end if;
 select * into j from public.agent_jobs where id=(q.message->>'job_id')::uuid for update;
 if not found or j.status in ('completed','dead','manual_review') then perform pgmq.archive('ai_messages',q.msg_id);return null;end if;
 if j.attempts>=j.max_attempts then
 update public.agent_jobs set status='dead',error='Retry budget exhausted',finished_at=now() where id=j.id;
 perform pgmq.send('ai_dead_letters',jsonb_build_object('job_id',j.id));perform pgmq.archive('ai_messages',q.msg_id);return null;
 end if;
 update public.agent_settings set worker_until=now()+interval '180 seconds' where workspace_id=s.workspace_id;
 update public.agent_jobs set status='processing',attempts=attempts+1,lease_token=token,lease_until=now()+interval '180 seconds',started_at=coalesce(started_at,now()) where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
create function public.finish_job(p_job uuid,p_token uuid,p_status text,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare j public.agent_jobs; delay int;
begin
 select * into j from public.agent_jobs where id=p_job for update;
 if j.lease_token is distinct from p_token or j.lease_until<now() then raise exception 'Stale lease';end if;
 if p_status not in ('completed','retry','dead','manual_review') then raise exception 'Invalid status';end if;
 if p_status='retry' and j.attempts>=j.max_attempts then p_status:='dead';end if;
 update public.agent_jobs set status=p_status,error=p_error,lease_until=null,lease_token=null,finished_at=case when p_status='retry' then null else now() end where id=j.id;
 if p_status='retry' then delay:=least(900,15*power(2,j.attempts)::int);perform pgmq.set_vt('ai_messages',j.queue_id,delay);
 else perform pgmq.archive('ai_messages',j.queue_id);end if;
 if p_status in ('dead','manual_review') then perform pgmq.send('ai_dead_letters',jsonb_build_object('job_id',j.id,'reason',p_status));end if;
 update public.agent_settings set worker_until=null where workspace_id=j.workspace_id;
 insert into public.audit_logs(workspace_id,event,entity_id,details) values(j.workspace_id,'job.'||p_status,j.id::text,jsonb_build_object('attempts',j.attempts));
end $$;
-- Generation checkpoint, unique job/part outbox and lease fencing in one transaction.
create function public.save_reply(p_job uuid,p_token uuid,p_reply text,p_sources jsonb,p_parts jsonb) returns void language plpgsql security definer set search_path='' as $$
declare j public.agent_jobs; m public.messages; recipient text; part text; n int:=0;
begin
 select * into j from public.agent_jobs where id=p_job for update;
 if j.lease_token is distinct from p_token or j.lease_until<now() then raise exception 'Stale lease';end if;
 if exists(select 1 from public.delivery_outbox where job_id=j.id) then return;end if;
 select * into m from public.messages where id=j.message_id;
 select c.phone into recipient from public.contacts c join public.conversations cv on cv.contact_id=c.id where cv.id=m.conversation_id and c.active and c.ai_access;
 if recipient is null then raise exception 'Contact revoked';end if;
 insert into public.messages(workspace_id,conversation_id,role,content,sources) values(j.workspace_id,m.conversation_id,'assistant',p_reply,p_sources);
 for part in select jsonb_array_elements_text(p_parts) loop
 insert into public.delivery_outbox(workspace_id,job_id,part,recipient,body) values(j.workspace_id,j.id,n,recipient,part);n:=n+1;
 end loop;
end $$;
create function public.begin_delivery(p_outbox uuid,p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.delivery_outbox; j public.agent_jobs;
begin
 select * into o from public.delivery_outbox where id=p_outbox for update;
 select * into j from public.agent_jobs where id=o.job_id;
 if j.lease_token is distinct from p_token or j.lease_until<now() then raise exception 'Stale lease';end if;
 if not exists(select 1 from public.agent_settings where workspace_id=j.workspace_id and ai_enabled) then raise exception 'AI disabled';end if;
 if not exists(select 1 from public.contacts where workspace_id=j.workspace_id and phone=o.recipient and active and ai_access) then raise exception 'Contact revoked';end if;
 if o.status='sending' then update public.delivery_outbox set status='manual_review',error='Abandoned send: delivery uncertain' where id=o.id;return null;end if;
 if o.status<>'pending' then return null;end if;
 update public.delivery_outbox set status='sending',updated_at=now() where id=o.id returning * into o;return to_jsonb(o);
end $$;
-- Revoke default function EXECUTE grants, including queue mutation entry points.
do $$ declare f record;begin
 for f in select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('accept_message','claim_job','finish_job','save_reply','begin_delivery','audit_admin_change') loop
 execute 'revoke all on function '||f.sig||' from public,anon,authenticated';execute 'grant execute on function '||f.sig||' to service_role';end loop;
end $$;
revoke all on schema pgmq from public,anon,authenticated;

-- Migration: 202611150002_scheduler.sql
-- Populate Vault secrets project_url and internal_job_secret before enabling traffic.
create function public.kick_worker() returns void language plpgsql security definer set search_path='' as $$
declare url text; secret text;
begin
 select decrypted_secret into url from vault.decrypted_secrets where name='project_url' limit 1;
 select decrypted_secret into secret from vault.decrypted_secrets where name='internal_job_secret' limit 1;
 if url is null or secret is null then return;end if;
 perform net.http_post(url:=url||'/functions/v1/process-ai-message',headers:=jsonb_build_object('Content-Type','application/json','X-Internal-Secret',secret),body:='{}'::jsonb,timeout_milliseconds:=1000);
end $$;
revoke all on function public.kick_worker() from public,anon,authenticated;
grant execute on function public.kick_worker() to service_role;
-- pg_net dispatch occurs after transaction commit, so the job is durable before invocation.
create function public.notify_job() returns trigger language plpgsql security definer set search_path='' as $$ begin perform public.kick_worker();return new;end $$;
revoke all on function public.notify_job() from public,anon,authenticated;
create trigger job_notify after insert on public.agent_jobs for each row execute function public.notify_job();
select cron.schedule('workcopilot-recovery','* * * * *','select public.kick_worker()');
create function public.purge_expired_history() returns void language sql security definer set search_path='' as $$
 delete from public.messages m using public.agent_settings s where m.workspace_id=s.workspace_id and m.created_at<now()-make_interval(days=>s.retention_days);
 delete from public.audit_logs a using public.agent_settings s where a.workspace_id=s.workspace_id and a.created_at<now()-make_interval(days=>s.retention_days);
$$;
revoke all on function public.purge_expired_history() from public,anon,authenticated;
select cron.schedule('workcopilot-retention','17 2 * * *','select public.purge_expired_history()');

-- Migration: 202611150003_history_reset.sql
-- Serialize administrative deletion with the global claim lease to prevent a
-- deleted conversation being used by an already-running worker.
create function public.reset_conversation(p_workspace uuid,p_conversation uuid,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare until_at timestamptz;
begin
 if not exists(select 1 from public.profiles where id=p_actor and workspace_id=p_workspace) then raise exception 'Administrator required';end if;
 select worker_until into until_at from public.agent_settings where workspace_id=p_workspace for update;
 if until_at>now() then raise exception 'Wait for current processing lease to finish';end if;
 if not exists(select 1 from public.conversations where id=p_conversation and workspace_id=p_workspace) then raise exception 'Conversation not found';end if;
 delete from public.messages where workspace_id=p_workspace and conversation_id=p_conversation;
 update public.conversations set reset_at=now() where workspace_id=p_workspace and id=p_conversation;
 insert into public.audit_logs(workspace_id,actor_id,event,entity_id) values(p_workspace,p_actor,'conversation.history_deleted',p_conversation::text);
end $$;
revoke all on function public.reset_conversation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reset_conversation(uuid,uuid,uuid) to service_role;

-- Migration: 202611150004_queue_privileges.sql
-- Supabase Queues may provision pgmq_public wrappers independently of pgmq.
-- This application never exposes queue operations to dashboard sessions.
do $$
declare f record;
begin
 if exists(select 1 from pg_namespace where nspname='pgmq_public') then
   revoke all on schema pgmq_public from public,anon,authenticated;
   for f in select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='pgmq_public' loop
     execute 'revoke all on function '||f.sig||' from public,anon,authenticated';
   end loop;
 end if;
end $$;

-- Migration: 202611160001_followup_window.sql
-- Follow-up window: after an activated (@prefix) message, further messages from the
-- same authorized contact are accepted without the prefix for N minutes after the
-- latest message in that conversation. 0 disables it (prefix always required).
alter table public.agent_settings
  add column followup_minutes int not null default 10 check (followup_minutes between 0 and 60);

create or replace function public.accept_message(p_wa_id text,p_phone text,p_text text,p_sent_at timestamptz) returns text language plpgsql security definer set search_path='' as $$
declare s public.agent_settings; c public.contacts; conv uuid; mid uuid; jid uuid; qid bigint; prompt text; trimmed text; prefixed boolean; last_activity timestamptz;
begin
 select * into s from public.agent_settings where workspace_id='00000000-0000-0000-0000-000000000001';
 if not s.ai_enabled then return 'disabled'; end if;
 select * into c from public.contacts where workspace_id=s.workspace_id and phone=p_phone for update;
 if not found or not c.active or not c.ai_access then return 'unauthorized'; end if;
 if p_sent_at < now()-interval '23 hours' or p_sent_at>now()+interval '5 minutes' then return 'expired'; end if;
 trimmed:=regexp_replace(p_text,'^\s+','');
 prefixed:=lower(left(trimmed,length(s.activation_prefix)))=lower(s.activation_prefix) and substring(trimmed from length(s.activation_prefix)+1 for 1) ~ '^\s$';
 if prefixed then
  prompt:=btrim(substring(trimmed from length(s.activation_prefix)+1));
 else
  if s.followup_minutes=0 then return 'not_activated'; end if;
  select max(m.created_at) into last_activity from public.messages m join public.conversations cv on cv.id=m.conversation_id
   where cv.contact_id=c.id and m.created_at>cv.reset_at;
  if last_activity is null or last_activity<now()-make_interval(mins=>s.followup_minutes) then return 'not_activated'; end if;
  prompt:=btrim(trimmed);
 end if;
 if length(prompt)=0 or length(prompt)>8000 then return 'empty_or_too_long'; end if;
 if exists(select 1 from public.messages where whatsapp_message_id=p_wa_id) then return 'duplicate'; end if;
 if (select count(*) from public.messages m join public.conversations cv on cv.id=m.conversation_id where cv.contact_id=c.id and m.role='user' and m.created_at>now()-interval '1 minute')>=5 then return 'rate_limited'; end if;
 insert into public.conversations(workspace_id,contact_id) values(s.workspace_id,c.id) on conflict(contact_id) do update set contact_id=excluded.contact_id returning id into conv;
 insert into public.messages(workspace_id,conversation_id,role,content,whatsapp_message_id,whatsapp_sent_at) values(s.workspace_id,conv,'user',prompt,p_wa_id,p_sent_at) on conflict(whatsapp_message_id) do nothing returning id into mid;
 if mid is null then return 'duplicate'; end if;
 insert into public.agent_jobs(workspace_id,message_id) values(s.workspace_id,mid) returning id into jid;
 select pgmq.send('ai_messages',jsonb_build_object('job_id',jid)) into qid;
 update public.agent_jobs set queue_id=qid where id=jid;
 update public.contacts set last_activity=now(),updated_at=now() where id=c.id;
 insert into public.audit_logs(workspace_id,event,entity_id) values(s.workspace_id,'message.accepted',mid::text);
 return 'accepted';
end $$;

-- Record changes to the new setting in the admin audit trail like the others.
drop trigger if exists settings_audit on public.agent_settings;
create trigger settings_audit after update of ai_enabled,activation_prefix,followup_minutes,groq_model,max_tool_calls,language_behavior,response_length,context_messages,context_hours,retention_days on public.agent_settings for each row execute function public.audit_admin_change();

-- Migration: 202611160002_integration_access.sql
-- Per-integration agent access policy:
--   capabilities  - kinds of data the agent may read (all enabled by default)
--   blocked_paths - user path patterns the agent must never read, e.g. ".env*",
--                   "config/secrets/" (built-in sensitive files are always blocked)
alter table public.integrations
  add column capabilities text[] not null
    default '{code,commits,issues,pull_requests,pipelines}'
    check (capabilities <@ array['code','commits','issues','pull_requests','pipelines']::text[]),
  add column blocked_paths text[] not null default '{}'
    check (cardinality(blocked_paths) <= 50);

commit;

-- After this succeeds, create your Auth user and provision its profiles row
-- using the administrator instructions in docs/DEPLOYMENT.md.
