create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0)
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'coach', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  workout_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  unique (id, workspace_id)
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  workout_id uuid not null,
  name text not null check (char_length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  foreign key (workout_id, workspace_id)
    references public.workouts (id, workspace_id)
    on delete cascade,
  unique (id, workout_id, workspace_id)
);

create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null,
  reps integer not null default 0 check (reps >= 0),
  weight numeric(10, 2) not null default 0 check (weight >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  foreign key (workout_id, workspace_id)
    references public.workouts (id, workspace_id)
    on delete cascade,
  foreign key (exercise_id, workout_id, workspace_id)
    references public.exercises (id, workout_id, workspace_id)
    on delete cascade
);

create index if not exists idx_workspace_members_user_id on public.workspace_members (user_id);
create index if not exists idx_workouts_workspace_id_date on public.workouts (workspace_id, workout_date desc);
create index if not exists idx_exercises_workout_id_order on public.exercises (workout_id, sort_order);
create index if not exists idx_sets_exercise_id_created_at on public.sets (exercise_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_workouts_set_updated_at
before update on public.workouts
for each row
execute function public.set_updated_at();

create trigger trg_exercises_set_updated_at
before update on public.exercises
for each row
execute function public.set_updated_at();

create trigger trg_sets_set_updated_at
before update on public.sets
for each row
execute function public.set_updated_at();

create or replace function public.is_workspace_member(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = wid
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = wid
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.sets enable row level security;

drop policy if exists workspaces_select_members on public.workspaces;
create policy workspaces_select_members
on public.workspaces
for select
using (public.is_workspace_member(id));

drop policy if exists workspaces_insert_created_by on public.workspaces;
create policy workspaces_insert_created_by
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists workspaces_update_members on public.workspaces;
create policy workspaces_update_members
on public.workspaces
for update
using (public.is_workspace_member(id))
with check (public.is_workspace_member(id));

drop policy if exists workspaces_delete_members on public.workspaces;
create policy workspaces_delete_members
on public.workspaces
for delete
using (public.is_workspace_member(id));

drop policy if exists workspace_members_select_members on public.workspace_members;
create policy workspace_members_select_members
on public.workspace_members
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert_owners on public.workspace_members;
create policy workspace_members_insert_owners
on public.workspace_members
for insert
to authenticated
with check (public.is_workspace_owner(workspace_id));

drop policy if exists workspace_members_delete_owners on public.workspace_members;
create policy workspace_members_delete_owners
on public.workspace_members
for delete
using (public.is_workspace_owner(workspace_id));

drop policy if exists workouts_all_members on public.workouts;
create policy workouts_all_members
on public.workouts
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists exercises_all_members on public.exercises;
create policy exercises_all_members
on public.exercises
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists sets_all_members on public.sets;
create policy sets_all_members
on public.sets
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create or replace function public.create_workspace_with_owner(name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if name is null or char_length(trim(name)) = 0 then
    raise exception 'workspace name is required';
  end if;

  insert into public.workspaces (name, created_by)
  values (trim(name), auth.uid())
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

grant execute on function public.create_workspace_with_owner(text) to authenticated;
