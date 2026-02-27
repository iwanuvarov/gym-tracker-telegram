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
    coalesce(u.email::text, ''::text) as email,
    wm.role::text,
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
    coalesce(u.email::text, ''::text),
    wm.created_at;
end;
$$;

grant execute on function public.list_workspace_members(uuid) to authenticated;
