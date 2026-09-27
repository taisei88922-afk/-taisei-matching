-- Run once in the Supabase SQL editor. Only Vercel server functions use the service role key.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  profile_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visitor_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  visitor_id uuid,
  sender text not null check (sender in ('visitor', 'owner')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists messages_visitor_idx on public.messages(visitor_id, sender, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
-- Intentionally no anon/authenticated policies. The service role stays on the server.
