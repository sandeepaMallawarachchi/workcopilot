-- Run only against an isolated migrated Supabase development database.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database.sql
begin;
do $$
declare w uuid:='00000000-0000-0000-0000-000000000001'; result text; j jsonb; before_count int;
begin
 update public.agent_settings set ai_enabled=true,worker_until=null where workspace_id=w;
 insert into public.contacts(workspace_id,display_name,phone,ai_access) values(w,'Integration test','+94770000001',true),(w,'Blocked','+94770000002',false);
 result:=public.accept_message('test.unknown','+94770000009','@ai hello',now());if result<>'unauthorized' then raise exception 'Unknown contact accepted';end if;
 result:=public.accept_message('test.blocked','+94770000002','@ai hello',now());if result<>'unauthorized' then raise exception 'Blocked contact accepted';end if;
 result:=public.accept_message('test.ordinary','+94770000001','hello',now());if result<>'not_activated' then raise exception 'Ordinary message accepted';end if;
 result:=public.accept_message('test.active','+94770000001','  @AI මේ repo එක බලන්න',now());if result<>'accepted' then raise exception 'Activated message rejected: %',result;end if;
 result:=public.accept_message('test.followup','+94770000001','thanks, and the README?',now());if result<>'accepted' then raise exception 'Follow-up within window rejected: %',result;end if;
 update public.agent_settings set followup_minutes=0 where workspace_id=w;
 result:=public.accept_message('test.nofollowup','+94770000001','another one',now());if result<>'not_activated' then raise exception 'Follow-up accepted while disabled';end if;
 update public.agent_settings set followup_minutes=10 where workspace_id=w;
 update public.conversations set reset_at=now()+interval '1 second' where contact_id=(select id from public.contacts where phone='+94770000001');
 result:=public.accept_message('test.afterreset','+94770000001','after reset',now());if result<>'not_activated' then raise exception 'Follow-up survived history reset';end if;
 select count(*) into before_count from public.agent_jobs;
 result:=public.accept_message('test.active','+94770000001','@ai duplicate',now());if result<>'duplicate' then raise exception 'Deduplication failed';end if;
 if (select count(*) from public.agent_jobs)<>before_count then raise exception 'Duplicate job created';end if;
 j:=public.claim_job();if j is null then raise exception 'Queue claim failed';end if;
 if public.claim_job() is not null then raise exception 'Concurrency limit failed';end if;
 perform public.save_reply((j->>'id')::uuid,(j->>'lease_token')::uuid,'reply','[]','["reply"]');
 perform public.save_reply((j->>'id')::uuid,(j->>'lease_token')::uuid,'reply','[]','["reply"]');
 if (select count(*) from public.delivery_outbox where job_id=(j->>'id')::uuid)<>1 then raise exception 'Outbox idempotency failed';end if;
 perform public.finish_job((j->>'id')::uuid,(j->>'lease_token')::uuid,'retry','simulated failure');
 if (select status from public.agent_jobs where id=(j->>'id')::uuid)<>'retry' then raise exception 'Retry state not saved';end if;
 if exists(select 1 from public.messages where whatsapp_message_id='test.ordinary') then raise exception 'Ordinary message persisted';end if;
 if has_function_privilege('authenticated','public.claim_job()','execute') then raise exception 'Client queue privileges leaked';end if;
 if has_table_privilege('authenticated','public.profiles','insert') then raise exception 'Client can grant admin';end if;
 update public.agent_settings set ai_enabled=false where workspace_id=w;
 result:=public.accept_message('test.off','+94770000001','@ai hello',now());if result<>'disabled' then raise exception 'Global switch failed';end if;
 raise notice 'Database acceptance, deduplication, lease, outbox, retry, privacy and privilege assertions passed';
end $$;
rollback;
