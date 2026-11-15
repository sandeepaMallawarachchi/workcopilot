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
