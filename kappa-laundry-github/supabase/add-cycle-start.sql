-- Only for a project that already ran the roster-enabled setup.
alter table public.machines add column if not exists started_at timestamptz;
create or replace function public.start_cycle(machine_id text, member_id uuid, duration_minutes integer)
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
create or replace function public.finish_cycle(machine_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Please reconnect and try again.'; end if;
 update public.machines set owner_id=null, resident_id=null, display_name=null, started_at=null, ends_at=null
 where id=machine_id and owner_id=auth.uid();
 if not found then raise exception 'Only the person who started this cycle can finish it.'; end if;
end; $$;
