-- My Room v0.2 Supabase schema
-- Daily Core と同じ Supabase Project に追加する想定。
-- Supabase SQL Editor で実行。

create table if not exists public.my_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'MR',
  color text not null default '#5865f2',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.my_room_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.my_rooms(id) on delete cascade,
  body text,
  image_data text,
  message_type text not null default 'text',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_my_rooms_user_id on public.my_rooms(user_id);
create index if not exists idx_my_rooms_user_sort on public.my_rooms(user_id, sort_order);
create index if not exists idx_my_room_messages_user_room_created on public.my_room_messages(user_id, room_id, created_at desc);
create index if not exists idx_my_room_messages_body on public.my_room_messages using gin (to_tsvector('simple', coalesce(body, '')));

alter table public.my_rooms enable row level security;
alter table public.my_room_messages enable row level security;

drop policy if exists "my_rooms_select_own" on public.my_rooms;
drop policy if exists "my_rooms_insert_own" on public.my_rooms;
drop policy if exists "my_rooms_update_own" on public.my_rooms;
drop policy if exists "my_rooms_delete_own" on public.my_rooms;

create policy "my_rooms_select_own"
on public.my_rooms for select
using (auth.uid() = user_id);

create policy "my_rooms_insert_own"
on public.my_rooms for insert
with check (auth.uid() = user_id);

create policy "my_rooms_update_own"
on public.my_rooms for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "my_rooms_delete_own"
on public.my_rooms for delete
using (auth.uid() = user_id);

drop policy if exists "my_room_messages_select_own" on public.my_room_messages;
drop policy if exists "my_room_messages_insert_own" on public.my_room_messages;
drop policy if exists "my_room_messages_update_own" on public.my_room_messages;
drop policy if exists "my_room_messages_delete_own" on public.my_room_messages;

create policy "my_room_messages_select_own"
on public.my_room_messages for select
using (auth.uid() = user_id);

create policy "my_room_messages_insert_own"
on public.my_room_messages for insert
with check (auth.uid() = user_id);

create policy "my_room_messages_update_own"
on public.my_room_messages for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "my_room_messages_delete_own"
on public.my_room_messages for delete
using (auth.uid() = user_id);

-- 初回ログイン後、アプリ側が Inbox / Todo / URL / 日記ネタ を自動作成します。
