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
