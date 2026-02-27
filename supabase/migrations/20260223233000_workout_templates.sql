create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  unique (id, workspace_id)
);

create table if not exists public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  template_id uuid not null,
  name text not null check (char_length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  foreign key (template_id, workspace_id)
    references public.workout_templates (id, workspace_id)
    on delete cascade
);

create index if not exists idx_workout_templates_workspace_id_created_at
  on public.workout_templates (workspace_id, created_at desc);
create index if not exists idx_workout_template_exercises_template_id_order
  on public.workout_template_exercises (template_id, sort_order, created_at);

alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;

drop policy if exists workout_templates_all_members on public.workout_templates;
create policy workout_templates_all_members
on public.workout_templates
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists workout_template_exercises_all_members on public.workout_template_exercises;
create policy workout_template_exercises_all_members
on public.workout_template_exercises
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop trigger if exists trg_workout_templates_set_updated_at on public.workout_templates;
create trigger trg_workout_templates_set_updated_at
before update on public.workout_templates
for each row
execute function public.set_updated_at();

drop trigger if exists trg_workout_template_exercises_set_updated_at on public.workout_template_exercises;
create trigger trg_workout_template_exercises_set_updated_at
before update on public.workout_template_exercises
for each row
execute function public.set_updated_at();
