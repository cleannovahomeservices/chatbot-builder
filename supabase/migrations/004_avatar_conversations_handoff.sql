-- Hito 1: avatar / logo del chatbot
alter table chatbots add column if not exists avatar_url text;

-- Hito 3: handoff (WhatsApp/email del negocio) + pedir cita
alter table chatbots add column if not exists handoff_whatsapp text;
alter table chatbots add column if not exists handoff_email text;
alter table chatbots add column if not exists booking_url text;

-- Hito 4: quitar branding "Powered by BotLuma" (solo surte efecto en planes de pago)
alter table chatbots add column if not exists hide_branding boolean not null default false;

-- Hito 2: persistir conversaciones y mensajes
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references chatbots(id) on delete cascade,
  user_id uuid not null,
  session_id text not null,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  message_count int not null default 0,
  needs_attention boolean not null default false,
  lead_name text,
  lead_email text,
  lead_phone text,
  unique (chatbot_id, session_id)
);
create index if not exists idx_conversations_chatbot on conversations(chatbot_id, last_at desc);
create index if not exists idx_conversations_user on conversations(user_id, last_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation on messages(conversation_id, created_at asc);

alter table conversations enable row level security;
alter table messages enable row level security;

-- Storage: bucket público para avatares/logos de chatbots
insert into storage.buckets (id, name, public)
values ('chatbot-assets', 'chatbot-assets', true)
on conflict (id) do nothing;
