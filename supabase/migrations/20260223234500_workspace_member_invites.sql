create or replace function public.list_workspace_members(wid uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_workspace_member(wid) then
    raise exception 'not authorized';
  end if;

  return query
  select
    wm.user_id,
    coalesce(u.email, '') as email,
    wm.role,
    wm.created_at
  from public.workspace_members wm
  left join auth.users u on u.id = wm.user_id
  where wm.workspace_id = wid
  order by
    case wm.role
      when 'owner' then 1
      when 'coach' then 2
      when 'member' then 3
      else 9
    end,
    coalesce(u.email, ''),
    wm.created_at;
end;
$$;

create or replace function public.invite_workspace_member_by_email(
  wid uuid,
  member_email text,
  member_role text default 'coach'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
  normalized_email text;
  normalized_role text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_workspace_owner(wid) then
    raise exception 'only workspace owners can invite members';
  end if;

  normalized_email := lower(trim(member_email));
  normalized_role := lower(trim(member_role));

  if normalized_email is null or char_length(normalized_email) = 0 then
    raise exception 'email is required';
  end if;

  if normalized_role not in ('coach', 'member') then
    raise exception 'invalid member role';
  end if;

  select u.id
  into target_user_id
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'User with this email was not found. Ask them to sign in once first.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (wid, target_user_id, normalized_role)
  on conflict (workspace_id, user_id)
  do update set role = excluded.role;

  return target_user_id;
end;
$$;

grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.invite_workspace_member_by_email(uuid, text, text) to authenticated;
