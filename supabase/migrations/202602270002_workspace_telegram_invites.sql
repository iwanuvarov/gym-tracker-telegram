create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null default 'coach' check (role in ('owner', 'coach', 'member')),
  invite_token text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_workspace_invites_workspace_id
  on public.workspace_invites (workspace_id);

create index if not exists idx_workspace_invites_expires_at
  on public.workspace_invites (expires_at);

alter table public.workspace_invites enable row level security;

revoke all on table public.workspace_invites from anon, authenticated;

drop function if exists public.create_workspace_invite_for_coach(uuid, integer);
create or replace function public.create_workspace_invite_for_coach(
  wid uuid,
  ttl_hours integer default 168
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ttl integer;
  v_token text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if wid is null then
    raise exception 'Workspace id is required';
  end if;

  if not public.is_workspace_owner(wid) then
    raise exception 'Only workspace owner can create coach invite';
  end if;

  v_ttl := greatest(1, least(coalesce(ttl_hours, 168), 24 * 30));
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.workspace_invites (
    workspace_id,
    role,
    invite_token,
    created_by,
    expires_at
  )
  values (
    wid,
    'coach',
    v_token,
    v_uid,
    timezone('utc', now()) + make_interval(hours => v_ttl)
  );

  return v_token;
end;
$$;

grant execute on function public.create_workspace_invite_for_coach(uuid, integer)
  to authenticated;

drop function if exists public.accept_workspace_invite(text);
create or replace function public.accept_workspace_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_invite public.workspace_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_token := btrim(coalesce(invite_token, ''));
  if v_token = '' then
    raise exception 'Invite token is required';
  end if;

  select *
  into v_invite
  from public.workspace_invites
  where workspace_invites.invite_token = v_token
  limit 1;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.expires_at <= timezone('utc', now()) then
    raise exception 'Invite expired';
  end if;

  if v_invite.accepted_at is not null and v_invite.accepted_by is distinct from v_uid then
    raise exception 'Invite already accepted';
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role
  )
  values (
    v_invite.workspace_id,
    v_uid,
    v_invite.role
  )
  on conflict (workspace_id, user_id)
  do update
  set role = case
    when public.workspace_members.role = 'owner' then public.workspace_members.role
    when public.workspace_members.role = 'coach' then public.workspace_members.role
    else excluded.role
  end;

  update public.workspace_invites
  set accepted_at = coalesce(accepted_at, timezone('utc', now())),
      accepted_by = coalesce(accepted_by, v_uid)
  where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invite(text)
  to authenticated;
