-- Run once in the Supabase SQL Editor for a new project.
create table public.residents (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 80),
 phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,25}$')
);
alter table public.residents enable row level security;
revoke all on public.residents from anon, authenticated;
grant select on public.residents to authenticated;
create policy "Signed in visitors can read roster" on public.residents
 for select to authenticated using (true);
-- Add only approved roster/contact details in the dashboard after deciding access.
create table public.machines (
 id text primary key,
 room text not null,
 kind text not null check (kind in ('washer','dryer')),
 label text not null,
 owner_id uuid references auth.users(id),
 resident_id uuid references public.residents(id),
 display_name text,
 started_at timestamptz,
 ends_at timestamptz,
 check ((owner_id is null and display_name is null and ends_at is null) or
 (owner_id is not null and display_name is not null and ends_at is not null))
);
alter table public.machines enable row level security;
revoke all on public.machines from anon, authenticated;
grant select on public.machines to authenticated;
create policy "Signed in visitors can read machine status" on public.machines
 for select to authenticated using (true);
-- A conditional UPDATE is atomic: only one visitor can claim an empty machine.
-- Definer permits controlled updates while direct table writes stay revoked.
create function public.start_cycle(machine_id text, member_id uuid, duration_minutes integer)
returns void language plpgsql security definer set search_path = '' as $$
declare resident_name text;
begin
 if auth.uid() is null then raise exception 'Please reconnect and try again.'; end if;
 select name into resident_name from public.residents where id=member_id;
 if not found then raise exception 'Choose a resident from the house roster.'; end if;
 if duration_minutes is null or duration_minutes not in (30,45,60,75,90) then
 raise exception 'Choose a valid cycle duration.'; end if;
 update public.machines set owner_id=auth.uid(), display_name=resident_name, resident_id=member_id,
 started_at=now(), ends_at=now()+make_interval(mins=>duration_minutes)
 where id=machine_id and owner_id is null;
 if not found then raise exception 'Machine is no longer available. Refresh and try another.'; end if;
end; $$;
create function public.finish_cycle(machine_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Please reconnect and try again.'; end if;
 update public.machines set owner_id=null, resident_id=null, display_name=null, started_at=null, ends_at=null
 where id=machine_id and owner_id=auth.uid();
 if not found then raise exception 'Only the person who started this cycle can finish it.'; end if;
end; $$;
revoke all on function public.start_cycle(text,uuid,integer) from public, anon, authenticated;
revoke all on function public.finish_cycle(text) from public, anon, authenticated;
grant execute on function public.start_cycle(text,uuid,integer) to authenticated;
grant execute on function public.finish_cycle(text) to authenticated;
insert into public.machines (id,room,kind,label)
 select 'R'||r||'-'||case when k='washer' then 'W' else 'D' end||n,
 case when r=1 then 'Chapter Room' else 'Bum' end,k,initcap(k)||' '||n
 from generate_series(1,2) r cross join unnest(array['washer','dryer']) k cross join generate_series(1,3) n;
