create table if not exists public.dm_hidden_conversations (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.dm_hidden_conversations enable row level security;
grant select, insert, delete on public.dm_hidden_conversations to authenticated;

drop policy if exists "Users can view their hidden DMs" on public.dm_hidden_conversations;
create policy "Users can view their hidden DMs"
on public.dm_hidden_conversations for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dm_conversations c
    where c.id = dm_hidden_conversations.conversation_id
      and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
  )
);

drop policy if exists "Users can hide their own DM conversations" on public.dm_hidden_conversations;
create policy "Users can hide their own DM conversations"
on public.dm_hidden_conversations for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dm_conversations c
    where c.id = dm_hidden_conversations.conversation_id
      and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
  )
);

drop policy if exists "Users can unhide their own DM conversations" on public.dm_hidden_conversations;
create policy "Users can unhide their own DM conversations"
on public.dm_hidden_conversations for delete to authenticated
using (user_id = (select auth.uid()));
