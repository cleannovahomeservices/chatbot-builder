-- PDF → system prompt generations (usage counter for plan limits)
create table if not exists public.pdf_generations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  pages int not null default 0,
  created_at timestamptz default now()
);

create index if not exists pdf_generations_user_idx on public.pdf_generations (user_id);
create index if not exists pdf_generations_user_created_idx on public.pdf_generations (user_id, created_at);
