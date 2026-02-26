create table if not exists public.telegram_identities (
  telegram_user_id bigint primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text,
  first_name text,
  last_name text,
  created_at timestamptz not null default timezone('utc', now()),
  last_auth_at timestamptz not null default timezone('utc', now())
);

alter table public.telegram_identities enable row level security;
