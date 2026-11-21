alter table public.dm_conversations
  add column if not exists is_group boolean not null default false,
  add column if not exists name text,
  add column if not exists avatar_url text,
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade;

alter table public.dm_conversations alter column user1_id drop not null;
alter table public.dm_conversations alter column user2_id drop not null;

alter table public.dm_conversations
  add constraint dm_conversations_group_shape check (
    (is_group and name is not null and owner_id is not null
      and user1_id is null and user2_id is null)
    or
    (not is_group and name is null and avatar_url is null
      and owner_id is null
      and user1_id is not null and user2_id is not null)
  );

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_id_idx
  on public.conversation_members(user_id);

create unique index if not exists conversation_members_one_owner_idx
  on public.conversation_members(conversation_id)
  where role = 'owner';

alter table public.conversation_members enable row level security;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

create policy "Members can view group membership"
on public.conversation_members
for select
to authenticated
using (
  public.is_conversation_member(conversation_members.conversation_id)
);

revoke all on public.conversation_members
  from anon, authenticated;
grant select on public.conversation_members to authenticated;

create or replace function public.validate_group_ownership(p_conversation_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_is_group boolean;
  v_owner_id uuid;
  v_owner_count integer;
begin
  select c.is_group, c.owner_id
  into v_is_group, v_owner_id
  from public.dm_conversations c
  where c.id = p_conversation_id;

  if not found then
    return;
  end if;

  if not v_is_group then
    if exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = p_conversation_id
    ) then
      raise exception 'Direct conversations cannot have group members';
    end if;
    return;
  end if;

  if v_owner_id is null then
    raise exception 'Group must have an owner';
  end if;

  select count(*)
  into v_owner_count
  from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.role = 'owner';

  if v_owner_count <> 1 then
    raise exception 'Group must have exactly one owner';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = v_owner_id
      and cm.role = 'owner'
  ) then
    raise exception 'Owner must be a member and owner';
  end if;
end;
$$;

create or replace function public.validate_changed_group_member()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.validate_group_ownership(old.conversation_id);
  elsif tg_op = 'UPDATE' then
    perform public.validate_group_ownership(old.conversation_id);
    if old.conversation_id is distinct from new.conversation_id then
      perform public.validate_group_ownership(new.conversation_id);
    end if;
  else
    perform public.validate_group_ownership(new.conversation_id);
  end if;

  return null;
end;
$$;

drop trigger if exists validate_group_membership_changes on public.conversation_members;
create constraint trigger validate_group_membership_changes
after insert or update or delete on public.conversation_members
deferrable initially deferred
for each row
execute function public.validate_changed_group_member();

create or replace function public.validate_changed_group_conversation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validate_group_ownership(new.id);
  return null;
end;
$$;

drop trigger if exists validate_group_conversation_changes on public.dm_conversations;
create constraint trigger validate_group_conversation_changes
after update of owner_id, is_group
on public.dm_conversations
deferrable initially deferred
for each row
execute function public.validate_changed_group_conversation();

create or replace function public.enforce_group_member_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_group boolean;
  v_member_count integer;
  v_conversation_id uuid;
begin
  if tg_op = 'DELETE' then
    v_conversation_id := old.conversation_id;
  else
    v_conversation_id := new.conversation_id;
  end if;

  select c.is_group
  into v_is_group
  from public.dm_conversations c
  where c.id = v_conversation_id;

  if not found or not v_is_group then
    return new;
  end if;

  select count(*)
  into v_member_count
  from public.conversation_members cm
  where cm.conversation_id = v_conversation_id;

  if v_member_count > 10 then
    raise exception 'A group cannot have more than 10 members';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_group_member_limit on public.conversation_members;
create constraint trigger enforce_group_member_limit
after insert or update
on public.conversation_members
deferrable initially deferred
for each row
execute function public.enforce_group_member_limit();

create or replace function public.create_group(
  p_name text,
  p_member_ids uuid[],
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_conversation_id uuid;
  v_member_id uuid;
  v_clean_name text := btrim(coalesce(p_name, ''));
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(v_clean_name) < 1 or char_length(v_clean_name) > 80 then
    raise exception 'Group name must be between 1 and 80 characters';
  end if;

  if p_member_ids is null then
    p_member_ids := array[]::uuid[];
  end if;

  if 1 + coalesce(array_length(p_member_ids, 1), 0) > 10 then
    raise exception 'A group cannot have more than 10 members';
  end if;

  insert into public.dm_conversations(
    is_group, name, avatar_url, owner_id, user1_id, user2_id
  )
  values (
    true, v_clean_name, p_avatar_url, v_owner_id, null, null
  )
  returning id into v_conversation_id;

  insert into public.conversation_members(
    conversation_id, user_id, role
  )
  values (v_conversation_id, v_owner_id, 'owner');

  foreach v_member_id in array p_member_ids
  loop
    if v_member_id = v_owner_id then
      continue;
    end if;

    if not exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = v_owner_id and f.addressee_id = v_member_id)
          or
          (f.requester_id = v_member_id and f.addressee_id = v_owner_id)
        )
    ) then
      raise exception 'Every invited member must be a friend';
    end if;

    insert into public.conversation_members(
      conversation_id, user_id, role
    )
    values (v_conversation_id, v_member_id, 'member')
    on conflict (conversation_id, user_id) do nothing;
  end loop;

  return v_conversation_id;
end;
$$;

create or replace function public.invite_group_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
  v_member_id uuid;
  v_count integer;
  v_unique_new_member_count integer;
begin
  select c.owner_id
  into v_owner_id
  from public.dm_conversations c
  where c.id = p_conversation_id
    and c.is_group
  for update;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_owner_id <> v_caller_id then
    raise exception 'Only the group owner can invite members';
  end if;

  select count(*)
  into v_count
  from public.conversation_members cm
  where cm.conversation_id = p_conversation_id;

  select count(*)
  into v_unique_new_member_count
  from (
    select distinct requested_id
    from unnest(coalesce(p_member_ids, array[]::uuid[])) requested_id
    where requested_id <> v_caller_id
      and not exists (
        select 1
        from public.conversation_members cm
        where cm.conversation_id = p_conversation_id
          and cm.user_id = requested_id
      )
  ) new_members;

  if v_count + v_unique_new_member_count > 10 then
    raise exception 'A group cannot have more than 10 members';
  end if;

  foreach v_member_id in array coalesce(p_member_ids, array[]::uuid[])
  loop
    if v_member_id = v_caller_id then
      continue;
    end if;

    if not exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = v_caller_id and f.addressee_id = v_member_id)
          or
          (f.requester_id = v_member_id and f.addressee_id = v_caller_id)
        )
    ) then
      raise exception 'Every invited member must be a friend';
    end if;

    insert into public.conversation_members(conversation_id, user_id, role)
    values (p_conversation_id, v_member_id, 'member')
    on conflict (conversation_id, user_id) do nothing;
  end loop;
end;
$$;

create or replace function public.remove_group_member(
  p_conversation_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_caller_id uuid := auth.uid();
begin
  select c.owner_id
  into v_owner_id
  from public.dm_conversations c
  where c.id = p_conversation_id
    and c.is_group
  for update;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_owner_id <> v_caller_id then
    raise exception 'Only the group owner can remove members';
  end if;

  if p_member_id = v_owner_id then
    raise exception 'The owner cannot be removed';
  end if;

  delete from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.user_id = p_member_id;
end;
$$;

create or replace function public.leave_group(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_caller_id uuid := auth.uid();
begin
  select c.owner_id
  into v_owner_id
  from public.dm_conversations c
  where c.id = p_conversation_id
    and c.is_group
  for update;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_owner_id = v_caller_id then
    raise exception 'Transfer ownership before leaving';
  end if;

  delete from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.user_id = v_caller_id;
end;
$$;

create or replace function public.transfer_group_owner(
  p_conversation_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_caller_id uuid := auth.uid();
begin
  select c.owner_id
  into v_owner_id
  from public.dm_conversations c
  where c.id = p_conversation_id
    and c.is_group
  for update;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_owner_id <> v_caller_id then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  if p_new_owner_id = v_owner_id then
    return;
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_new_owner_id
  ) then
    raise exception 'New owner must be a group member';
  end if;

  update public.conversation_members
  set role = 'member'
  where conversation_id = p_conversation_id
    and user_id = v_owner_id;

  update public.conversation_members
  set role = 'owner'
  where conversation_id = p_conversation_id
    and user_id = p_new_owner_id;

  update public.dm_conversations
  set owner_id = p_new_owner_id
  where id = p_conversation_id;
end;
$$;

create or replace function public.update_group(
  p_conversation_id uuid,
  p_name text,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_clean_name text := btrim(coalesce(p_name, ''));
begin
  select c.owner_id
  into v_owner_id
  from public.dm_conversations c
  where c.id = p_conversation_id
    and c.is_group
  for update;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Only the group owner can update the group';
  end if;

  if char_length(v_clean_name) < 1 or char_length(v_clean_name) > 80 then
    raise exception 'Group name must be between 1 and 80 characters';
  end if;

  update public.dm_conversations
  set name = v_clean_name,
      avatar_url = p_avatar_url
  where id = p_conversation_id;
end;
$$;

revoke all on function public.create_group(text, uuid[], text) from public;
revoke all on function public.invite_group_members(uuid, uuid[]) from public;
revoke all on function public.remove_group_member(uuid, uuid) from public;
revoke all on function public.leave_group(uuid) from public;
revoke all on function public.transfer_group_owner(uuid, uuid) from public;
revoke all on function public.update_group(uuid, text, text) from public;

grant execute on function public.create_group(text, uuid[], text) to authenticated;
grant execute on function public.invite_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.transfer_group_owner(uuid, uuid) to authenticated;
grant execute on function public.update_group(uuid, text, text) to authenticated;

-- Preserve existing DM access and add group membership access.
drop policy if exists "Participants can view their conversations"
  on public.dm_conversations;

create policy "Participants can view their conversations"
on public.dm_conversations
for select
to authenticated
using (
  (not is_group and (
    auth.uid() = user1_id or auth.uid() = user2_id
  ))
  or
  (is_group and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = dm_conversations.id
      and cm.user_id = auth.uid()
  ))
);

drop policy if exists "Participants can view messages"
  on public.dm_messages;
create policy "Participants can view messages"
on public.dm_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.dm_conversations c
    where c.id = dm_messages.conversation_id
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Participants can send messages"
  on public.dm_messages;
create policy "Participants can send messages"
on public.dm_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.dm_conversations c
    where c.id = dm_messages.conversation_id
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Users can edit own messages"
  on public.dm_messages;
create policy "Users can edit own messages"
on public.dm_messages
for update
to authenticated
using (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.dm_conversations c
    where c.id = dm_messages.conversation_id
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
)
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.dm_conversations c
    where c.id = dm_messages.conversation_id
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Users can delete own messages"
  on public.dm_messages;
create policy "Users can delete own messages"
on public.dm_messages
for delete
to authenticated
using (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.dm_conversations c
    where c.id = dm_messages.conversation_id
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Conversation participants can add their own reactions"
  on public.message_reactions;
create policy "Conversation participants can add their own reactions"
on public.message_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.dm_messages m
    join public.dm_conversations c on c.id = m.conversation_id
    where m.id = message_reactions.message_id
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Conversation participants can view reactions"
  on public.message_reactions;
create policy "Conversation participants can view reactions"
on public.message_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.dm_messages m
    join public.dm_conversations c on c.id = m.conversation_id
    where m.id = message_reactions.message_id
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Users can remove their own reactions"
  on public.message_reactions;
create policy "Users can remove their own reactions"
on public.message_reactions
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.dm_messages m
    join public.dm_conversations c on c.id = m.conversation_id
    where m.id = message_reactions.message_id
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

alter publication supabase_realtime add table public.dm_conversations;
alter publication supabase_realtime add table public.conversation_members;

drop policy if exists "Senders can create valid DM mentions"
  on public.dm_message_mentions;
create policy "Senders can create valid DM mentions"
on public.dm_message_mentions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.dm_messages m
    join public.dm_conversations c on c.id = m.conversation_id
    where m.id = dm_message_mentions.message_id
      and m.sender_id = auth.uid()
      and (
        (not c.is_group and (
          (
            c.user1_id = auth.uid()
            and c.user2_id = dm_message_mentions.mentioned_user_id
          )
          or
          (
            c.user2_id = auth.uid()
            and c.user1_id = dm_message_mentions.mentioned_user_id
          )
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members sender_cm
          join public.conversation_members mentioned_cm
            on mentioned_cm.conversation_id = c.id
            and mentioned_cm.user_id = dm_message_mentions.mentioned_user_id
          where sender_cm.conversation_id = c.id
            and sender_cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Users can view their own mentions"
  on public.dm_message_mentions;
create policy "Users can view their own mentions"
on public.dm_message_mentions
for select
to authenticated
using (
  mentioned_user_id = auth.uid()
);

drop policy if exists "DM participants can upload attachments"
  on storage.objects;
create policy "DM and group members can upload attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dm-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.dm_conversations c
    where c.id::text = (storage.foldername(objects.name))[1]
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "DM participants can view attachments"
  on storage.objects;
create policy "DM and group members can view attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'dm-attachments'
  and exists (
    select 1
    from public.dm_conversations c
    where c.id::text = (storage.foldername(objects.name))[1]
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Users can delete their own DM attachments"
  on storage.objects;
create policy "Users can delete their own attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dm-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.dm_conversations c
    where c.id::text = (storage.foldername(objects.name))[1]
      and (
        (not c.is_group and (
          auth.uid() = c.user1_id or auth.uid() = c.user2_id
        ))
        or
        (c.is_group and exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        ))
      )
  )
);
