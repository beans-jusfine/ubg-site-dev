insert into storage.buckets (id, name, public, file_size_limit)
values ('dm-attachments', 'dm-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "DM members can read their attachments" on storage.objects;
create policy "DM members can read their attachments"
on storage.objects for select to authenticated
using (bucket_id = 'dm-attachments' and exists (
  select 1 from public.dm_conversations c
  where c.id::text = (storage.foldername(name))[1]
    and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
));

drop policy if exists "DM members can upload their attachments" on storage.objects;
create policy "DM members can upload their attachments"
on storage.objects for insert to authenticated
with check (bucket_id = 'dm-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.dm_conversations c
    where c.id::text = (storage.foldername(name))[1]
      and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
  )
);

drop policy if exists "Users can delete their own DM attachments" on storage.objects;
create policy "Users can delete their own DM attachments"
on storage.objects for delete to authenticated
using (bucket_id = 'dm-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.dm_conversations c
    where c.id::text = (storage.foldername(name))[1]
      and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
  )
);
