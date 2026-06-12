create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_role') then
    create type public.workspace_role as enum ('admin', 'editor', 'reader');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_visibility') then
    create type public.project_visibility as enum ('private', 'public');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('draft', 'active', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_version_kind') then
    create type public.project_version_kind as enum ('draft', 'import', 'published');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'reader',
  invited_email text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  slug text unique,
  description text default '',
  status public.project_status not null default 'draft',
  visibility public.project_visibility not null default 'private',
  current_data_json jsonb not null default '{}'::jsonb,
  published_version_id uuid,
  legacy_file_path text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version_kind public.project_version_kind not null default 'draft',
  data_json jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  token text not null unique,
  snapshot_data_json jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_published_version_fk'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_published_version_fk
      foreign key (published_version_id) references public.project_versions (id) on delete set null;
  end if;
end $$;

create index if not exists idx_workspace_members_workspace on public.workspace_members (workspace_id);
create index if not exists idx_projects_workspace on public.projects (workspace_id, updated_at desc);
create index if not exists idx_projects_slug on public.projects (slug);
create index if not exists idx_projects_legacy_file on public.projects (legacy_file_path);
create index if not exists idx_project_versions_project on public.project_versions (project_id, created_at desc);
create index if not exists idx_project_share_links_project on public.project_share_links (project_id, created_at desc);

create or replace function public.current_workspace_role(target_workspace uuid)
returns public.workspace_role
language sql
stable
as $$
  select role
  from public.workspace_members
  where workspace_id = target_workspace
    and user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
  )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_default_workspace()
returns table (
  workspace_id uuid,
  role public.workspace_role,
  workspace_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := auth.email();
  existing_member public.workspace_members%rowtype;
  new_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, display_name, email)
  values (
    current_user_id,
    coalesce(current_email, 'Admin'),
    current_email
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    updated_at = now();

  select *
  into existing_member
  from public.workspace_members
  where user_id = current_user_id
    and status = 'active'
  order by created_at asc
  limit 1;

  if existing_member.id is not null then
    return query
    select w.id, existing_member.role, w.name
    from public.workspaces w
    where w.id = existing_member.workspace_id;
    return;
  end if;

  insert into public.workspaces (name, created_by)
  values ('Russia PL Calculator', current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (new_workspace_id, current_user_id, 'admin', 'active');

  return query
  select new_workspace_id, 'admin'::public.workspace_role, 'Russia PL Calculator'::text;
end;
$$;

revoke all on function public.ensure_default_workspace() from public;
grant execute on function public.ensure_default_workspace() to authenticated;

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_workspaces_touch_updated_at on public.workspaces;
create trigger trg_workspaces_touch_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

drop trigger if exists trg_workspace_members_touch_updated_at on public.workspace_members;
create trigger trg_workspace_members_touch_updated_at
before update on public.workspace_members
for each row execute function public.touch_updated_at();

drop trigger if exists trg_projects_touch_updated_at on public.projects;
create trigger trg_projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;
alter table public.project_share_links enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
on public.workspaces
for select
using (public.is_workspace_member(id));

drop policy if exists "workspace_members_select_member" on public.workspace_members;
create policy "workspace_members_select_member"
on public.workspace_members
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_manage_admin" on public.workspace_members;
create policy "workspace_members_manage_admin"
on public.workspace_members
for all
using (public.current_workspace_role(workspace_id) = 'admin')
with check (public.current_workspace_role(workspace_id) = 'admin');

drop policy if exists "projects_select_member_or_public" on public.projects;
create policy "projects_select_member_or_public"
on public.projects
for select
using (
  public.is_workspace_member(workspace_id)
  or visibility = 'public'
);

drop policy if exists "projects_insert_editor_or_admin" on public.projects;
create policy "projects_insert_editor_or_admin"
on public.projects
for insert
with check (
  public.current_workspace_role(workspace_id) in ('admin', 'editor')
);

drop policy if exists "projects_update_editor_or_admin" on public.projects;
create policy "projects_update_editor_or_admin"
on public.projects
for update
using (
  public.current_workspace_role(workspace_id) in ('admin', 'editor')
)
with check (
  public.current_workspace_role(workspace_id) in ('admin', 'editor')
);

drop policy if exists "projects_delete_admin" on public.projects;
create policy "projects_delete_admin"
on public.projects
for delete
using (public.current_workspace_role(workspace_id) = 'admin');

drop policy if exists "project_versions_select_member" on public.project_versions;
create policy "project_versions_select_member"
on public.project_versions
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and (
        public.is_workspace_member(p.workspace_id)
        or p.visibility = 'public'
      )
  )
);

drop policy if exists "project_versions_insert_editor_or_admin" on public.project_versions;
create policy "project_versions_insert_editor_or_admin"
on public.project_versions
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and public.current_workspace_role(p.workspace_id) in ('admin', 'editor')
  )
);

drop policy if exists "project_share_links_select_member_or_unexpired" on public.project_share_links;
create policy "project_share_links_select_member_or_unexpired"
on public.project_share_links
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and public.is_workspace_member(p.workspace_id)
  )
  or expires_at is null
  or expires_at > now()
);

drop policy if exists "project_share_links_insert_editor_or_admin" on public.project_share_links;
create policy "project_share_links_insert_editor_or_admin"
on public.project_share_links
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and public.current_workspace_role(p.workspace_id) in ('admin', 'editor')
  )
);
