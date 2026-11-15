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
