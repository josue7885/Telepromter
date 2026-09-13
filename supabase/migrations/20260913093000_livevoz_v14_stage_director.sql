-- LiveVoz V14 Stage Director
-- Team roles, reusable device profiles, instrument parts and event execution history.

alter table public.concert_members drop constraint if exists concert_members_role_check;
alter table public.concert_members
  add constraint concert_members_role_check
  check (role in ('owner','admin','operator','musician','singer'));

create table if not exists public.device_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_name text not null default 'Principal',
  device_name text,
  instrument text,
  transpose int not null default 0 check (transpose between -12 and 12),
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(user_id, profile_name)
);

create table if not exists public.song_instrument_parts (
  song_id text not null references public.songs(id) on delete cascade,
  instrument text not null,
  note text not null default '',
  chords jsonb not null default '[]'::jsonb,
  cues jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(song_id, instrument)
);

create table if not exists public.event_runs (
  id uuid primary key default gen_random_uuid(),
  concert_id text references public.concerts(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'normal' check (mode in ('normal','serenata','boda','ensayo')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  actual_order jsonb not null default '[]'::jsonb,
  stage_log jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb
);

create index if not exists idx_event_runs_owner_started on public.event_runs(owner_id, started_at desc);
create index if not exists idx_parts_song on public.song_instrument_parts(song_id);

alter table public.device_profiles enable row level security;
alter table public.song_instrument_parts enable row level security;
alter table public.event_runs enable row level security;

drop policy if exists "device profiles own" on public.device_profiles;
create policy "device profiles own" on public.device_profiles for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "instrument parts visible" on public.song_instrument_parts;
create policy "instrument parts visible" on public.song_instrument_parts for select to authenticated
using (
  exists(select 1 from public.songs s where s.id=song_id and s.user_id=auth.uid())
  or exists(
    select 1 from public.concert_songs cs
    join public.concert_members cm on cm.concert_id=cs.concert_id
    where cs.song_id=song_id and cm.user_id=auth.uid()
  )
);

drop policy if exists "instrument parts manage" on public.song_instrument_parts;
create policy "instrument parts manage" on public.song_instrument_parts for all to authenticated
using (
  exists(select 1 from public.songs s where s.id=song_id and s.user_id=auth.uid())
  or exists(
    select 1 from public.concert_songs cs
    join public.concert_members cm on cm.concert_id=cs.concert_id
    where cs.song_id=song_id and cm.user_id=auth.uid() and cm.role in ('admin','operator')
  )
)
with check (
  exists(select 1 from public.songs s where s.id=song_id and s.user_id=auth.uid())
  or exists(
    select 1 from public.concert_songs cs
    join public.concert_members cm on cm.concert_id=cs.concert_id
    where cs.song_id=song_id and cm.user_id=auth.uid() and cm.role in ('admin','operator')
  )
);

drop policy if exists "event runs visible" on public.event_runs;
create policy "event runs visible" on public.event_runs for select to authenticated
using (
  owner_id=auth.uid()
  or exists(select 1 from public.concert_members cm where cm.concert_id=event_runs.concert_id and cm.user_id=auth.uid())
);

drop policy if exists "event runs operate" on public.event_runs;
create policy "event runs operate" on public.event_runs for all to authenticated
using (
  owner_id=auth.uid()
  or exists(select 1 from public.concert_members cm where cm.concert_id=event_runs.concert_id and cm.user_id=auth.uid() and cm.role in ('admin','operator'))
)
with check (
  owner_id=auth.uid()
  or exists(select 1 from public.concert_members cm where cm.concert_id=event_runs.concert_id and cm.user_id=auth.uid() and cm.role in ('admin','operator'))
);

-- Admins may manage setlists and members; operators may manage the live session.
drop policy if exists "members owner manage" on public.concert_members;
create policy "members owner admin manage" on public.concert_members for all to authenticated
using (
  exists(select 1 from public.concerts c where c.id=concert_id and c.owner_id=auth.uid())
  or exists(select 1 from public.concert_members self where self.concert_id=concert_members.concert_id and self.user_id=auth.uid() and self.role='admin')
)
with check (
  exists(select 1 from public.concerts c where c.id=concert_id and c.owner_id=auth.uid())
  or exists(select 1 from public.concert_members self where self.concert_id=concert_members.concert_id and self.user_id=auth.uid() and self.role='admin')
);

drop policy if exists "concert songs owner manage" on public.concert_songs;
create policy "concert songs owner admin manage" on public.concert_songs for all to authenticated
using (
  exists(select 1 from public.concerts c where c.id=concert_id and c.owner_id=auth.uid())
  or exists(select 1 from public.concert_members cm where cm.concert_id=concert_songs.concert_id and cm.user_id=auth.uid() and cm.role='admin')
)
with check (
  exists(select 1 from public.concerts c where c.id=concert_id and c.owner_id=auth.uid())
  or exists(select 1 from public.concert_members cm where cm.concert_id=concert_songs.concert_id and cm.user_id=auth.uid() and cm.role='admin')
);

drop policy if exists "live owner host write" on public.live_sessions;
create policy "live authorized host write" on public.live_sessions for all to authenticated
using (
  host_user_id=auth.uid()
  and (
    exists(select 1 from public.concerts c where c.id=concert_id and c.owner_id=auth.uid())
    or exists(select 1 from public.concert_members cm where cm.concert_id=live_sessions.concert_id and cm.user_id=auth.uid() and cm.role in ('admin','operator'))
  )
)
with check (
  host_user_id=auth.uid()
  and (
    exists(select 1 from public.concerts c where c.id=concert_id and c.owner_id=auth.uid())
    or exists(select 1 from public.concert_members cm where cm.concert_id=live_sessions.concert_id and cm.user_id=auth.uid() and cm.role in ('admin','operator'))
  )
);

create or replace function public.share_concert_by_email(p_concert_id text,p_email text,p_role text default 'musician')
returns boolean language plpgsql security definer set search_path=public as $$
declare target_user uuid;
declare caller_can_manage boolean;
begin
  select (
    c.owner_id=auth.uid()
    or exists(select 1 from public.concert_members cm where cm.concert_id=c.id and cm.user_id=auth.uid() and cm.role='admin')
  ) into caller_can_manage
  from public.concerts c where c.id=p_concert_id;

  if coalesce(caller_can_manage,false)=false then
    raise exception 'No tienes permisos para compartir este concierto';
  end if;

  select id into target_user from public.profiles where lower(email)=lower(p_email) limit 1;
  if target_user is null then raise exception 'El usuario todavía no tiene una cuenta LiveVoz'; end if;

  insert into public.concert_members(concert_id,user_id,role)
  values(p_concert_id,target_user,case when p_role in ('admin','operator','musician','singer') then p_role else 'musician' end)
  on conflict(concert_id,user_id) do update set role=excluded.role;
  return true;
end $$;
revoke all on function public.share_concert_by_email(text,text,text) from public;
grant execute on function public.share_concert_by_email(text,text,text) to authenticated;