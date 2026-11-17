-- Per-contact integration access. NULL = all integrations (the default, so
-- existing contacts keep working); an array limits the contact to those tasks.
alter table public.contacts
  add column allowed_tasks text[]
    check (allowed_tasks <@ array[
      'github:code','github:commits','github:issues','github:pull_requests',
      'gitlab:code','gitlab:commits','gitlab:issues','gitlab:pull_requests','gitlab:pipelines',
      'email:read','email:codes'
    ]::text[]);
