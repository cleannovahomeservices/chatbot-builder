-- Users (GitHub OAuth)
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  github_id bigint unique not null,
  github_username text not null,
  github_email text,
  github_avatar_url text,
  github_access_token text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sessions
create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Chatbots
create table if not exists public.chatbots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  system_prompt text not null,
  n8n_workflow_id text,
  n8n_webhook_url text,
  github_repo text,
  widget_injected boolean default false,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists sessions_token_idx on public.sessions (token);
create index if not exists sessions_user_idx on public.sessions (user_id);
create index if not exists chatbots_user_idx on public.chatbots (user_id);

-- RLS: all access via service role only
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.chatbots enable row level security;

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create trigger chatbots_updated_at before update on public.chatbots
  for each row execute function public.set_updated_at();
