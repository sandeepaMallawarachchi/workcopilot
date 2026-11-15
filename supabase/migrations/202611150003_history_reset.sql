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
