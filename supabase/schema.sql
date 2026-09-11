-- Ewidencja — wklej CAŁOŚĆ w SQL Editor (Supabase Dashboard → SQL → New query → Run).
-- Bezpieczeństwo: RLS. Anon key w aplikacji NIE omija tych reguł.

-- ---------------------------------------------------------------------------
-- Tabele
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  address text,
  distance double precision not null default 0,
  distance_type text not null default 'round_trip' check (distance_type in ('one_way', 'round_trip')),
  round_trip_rate double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  type text not null check (type in ('training', 'match')),
  weekdays text not null,
  start_time text not null,
  end_time text,
  destination_id uuid references public.destinations (id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  date date not null,
  start_time text not null,
  end_time text,
  type text not null check (type in ('training', 'match')),
  destination_id uuid references public.destinations (id) on delete set null,
  notes text,
  source text not null default 'manual',
  schedule_rule_id uuid references public.schedule_rules (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Obecność i dojazd są OSOBISTE (user + event). Nie trzymaj ich na evencie.
create table if not exists public.event_responses (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  attended boolean,
  traveled boolean,
  transport text check (transport in ('car', 'other') or transport is null),
  trip_direction text check (trip_direction in ('round_trip', 'outbound', 'return') or trip_direction is null),
  destination_id uuid references public.destinations (id) on delete set null,
  absence_note text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists idx_group_members_user on public.group_members (user_id);
create index if not exists idx_seasons_group on public.seasons (group_id);
create index if not exists idx_destinations_group on public.destinations (group_id);
create index if not exists idx_schedule_rules_group on public.schedule_rules (group_id);
create index if not exists idx_events_group_date on public.events (group_id, date);
create index if not exists idx_events_season on public.events (season_id);
create index if not exists idx_event_responses_event on public.event_responses (event_id);

create unique index if not exists events_schedule_unique
  on public.events (group_id, date, type, start_time)
  where source = 'schedule';

-- ---------------------------------------------------------------------------
-- Profile przy rejestracji
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();

-- ---------------------------------------------------------------------------
-- Funkcje pomocnicze (SECURITY DEFINER — bez rekurencji RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.join_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Nie zalogowano';
  end if;

  select id into gid
  from public.groups
  where upper(join_code) = upper(trim(p_code));

  if gid is null then
    raise exception 'Nie znaleziono grupy o tym kodzie';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return gid;
end;
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_owner(uuid) from public;
revoke all on function public.join_group(text) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.seasons enable row level security;
alter table public.destinations enable row level security;
alter table public.schedule_rules enable row level security;
alter table public.events enable row level security;
alter table public.event_responses enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- groups
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated
  using (public.is_group_member(id));

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update to authenticated
  using (public.is_group_owner(id))
  with check (public.is_group_owner(id));

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups
  for delete to authenticated
  using (public.is_group_owner(id));

-- group_members (zapis tylko przez trigger / join_group)
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or (public.is_group_owner(group_id) and user_id <> auth.uid())
  );

-- seasons / destinations / schedule / events — CRUD członków grupy
drop policy if exists seasons_all on public.seasons;
create policy seasons_all on public.seasons
  for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists destinations_all on public.destinations;
create policy destinations_all on public.destinations
  for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists schedule_rules_all on public.schedule_rules;
create policy schedule_rules_all on public.schedule_rules
  for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists events_all on public.events;
create policy events_all on public.events
  for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- responses: odczyt w grupie (dashboard), zapis tylko własny
drop policy if exists event_responses_select on public.event_responses;
create policy event_responses_select on public.event_responses
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_responses.event_id
        and public.is_group_member(e.group_id)
    )
  );

drop policy if exists event_responses_insert on public.event_responses;
create policy event_responses_insert on public.event_responses
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and public.is_group_member(e.group_id)
    )
  );

drop policy if exists event_responses_update on public.event_responses;
create policy event_responses_update on public.event_responses
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists event_responses_delete on public.event_responses;
create policy event_responses_delete on public.event_responses
  for delete to authenticated
  using (user_id = auth.uid());
